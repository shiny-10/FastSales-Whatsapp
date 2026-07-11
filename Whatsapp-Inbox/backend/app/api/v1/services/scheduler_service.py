from __future__ import annotations
"""Background scheduler: polls every 60s for due scheduled messages and sends them."""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.db.models import ScheduledMessage, ScheduledMessageStatus, WhatsAppAccount
from app.api.v1.services.message_service import MessageService
from app.api.v1.services.conversation_service import ConversationService
from app.api.v1.schemas.message import SendTextMessageRequest
from app.api.core.logging import get_logger
import app.api.v1.services.socket_service as socket_svc
from app.api.v1.schemas.message import MessageResponse

logger = get_logger(__name__)
_task: asyncio.Task | None = None


async def _run_scheduler() -> None:
    while True:
        try:
            await _process_due_messages()
        except Exception as e:
            logger.error("Scheduler error: %s", e)
        await asyncio.sleep(60)


async def _process_due_messages() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScheduledMessage).where(
                ScheduledMessage.status == ScheduledMessageStatus.PENDING,
                ScheduledMessage.scheduled_at <= now,
            )
        )
        due = result.scalars().all()
        if not due:
            return

        for msg in due:
            try:
                await _send_scheduled(db, msg)
                await db.execute(
                    update(ScheduledMessage)
                    .where(ScheduledMessage.id == msg.id)
                    .values(status=ScheduledMessageStatus.SENT)
                )
            except Exception as e:
                logger.error("Failed to send scheduled message %s: %s", msg.id, e)
                await db.execute(
                    update(ScheduledMessage)
                    .where(ScheduledMessage.id == msg.id)
                    .values(status=ScheduledMessageStatus.FAILED)
                )
        await db.commit()


async def _send_scheduled(db: AsyncSession, msg: ScheduledMessage) -> None:
    wa_result = await db.execute(
        select(WhatsAppAccount).where(WhatsAppAccount.company_id == msg.company_id)
    )
    wa = wa_result.scalar_one_or_none()
    if not wa:
        raise ValueError(f"No WhatsApp account for company {msg.company_id}")

    svc = MessageService(db)
    from uuid import UUID as _UUID
    system_agent_id = _UUID("00000000-0000-0000-0000-000000000000")
    req = SendTextMessageRequest(conversation_id=msg.conversation_id, content=msg.content or "")
    reply = await svc.send_text_message(req, system_agent_id, wa.phone_number_id, wa.access_token)
    await socket_svc.emit_new_message(
        str(msg.company_id),
        str(msg.conversation_id),
        MessageResponse.model_validate(reply),
    )
    logger.info("Sent scheduled message %s for conversation %s", msg.id, msg.conversation_id)


def start_scheduler() -> None:
    global _task
    _task = asyncio.create_task(_run_scheduler())
    logger.info("Scheduler started")


def stop_scheduler() -> None:
    global _task
    if _task:
        _task.cancel()
        _task = None
