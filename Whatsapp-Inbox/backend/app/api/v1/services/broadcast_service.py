from __future__ import annotations
import uuid
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.models import Broadcast, BroadcastStatus, SenderType, MessageType, MessageStatus
from app.db.repositories.message_repository import MessageRepository
from app.db.repositories.conversation_repository import ConversationRepository
from app.api.v1.services.conversation_service import ConversationService
from app.api.v1.services.message_service import MessageService
from app.api.core.logging import get_logger

logger = get_logger(__name__)


class BroadcastService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, company_id: UUID, **kwargs) -> Broadcast:
        broadcast = Broadcast(id=uuid.uuid4(), company_id=company_id, **kwargs)
        self.db.add(broadcast)
        await self.db.flush()
        await self.db.refresh(broadcast)
        return broadcast

    async def list(self, company_id: UUID) -> list[Broadcast]:
        result = await self.db.execute(
            select(Broadcast).where(Broadcast.company_id == company_id).order_by(Broadcast.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, broadcast_id: UUID) -> Broadcast | None:
        result = await self.db.execute(select(Broadcast).where(Broadcast.id == broadcast_id))
        return result.scalar_one_or_none()

    async def update(self, broadcast_id: UUID, **kwargs) -> Broadcast | None:
        await self.db.execute(update(Broadcast).where(Broadcast.id == broadcast_id).values(**kwargs))
        return await self.get(broadcast_id)

    async def delete(self, broadcast_id: UUID) -> None:
        broadcast = await self.get(broadcast_id)
        if broadcast:
            await self.db.delete(broadcast)

    async def send_now(
        self,
        broadcast: Broadcast,
        phone_number_id: str,
        access_token: str,
    ) -> Broadcast:
        """Send broadcast to all recipients immediately."""
        await self.update(broadcast.id, status=BroadcastStatus.SENDING)

        msg_svc = MessageService(self.db)
        conv_svc = ConversationService(self.db)
        sent = 0
        failed = 0

        for phone in broadcast.recipients:
            try:
                conv, _ = await conv_svc.get_or_create(
                    company_id=broadcast.company_id,
                    customer_phone=phone,
                    whatsapp_account_id=None,
                )
                from app.api.v1.schemas.message import SendTextMessageRequest
                from uuid import UUID as _UUID
                req = SendTextMessageRequest(
                    conversation_id=conv.id,
                    content=broadcast.message,
                )
                system_agent_id = _UUID("00000000-0000-0000-0000-000000000000")
                await msg_svc.send_text_message(req, system_agent_id, phone_number_id, access_token)
                sent += 1
            except Exception as e:
                logger.error("Broadcast send failed for %s: %s", phone, e)
                failed += 1

        return await self.update(
            broadcast.id,
            status=BroadcastStatus.DONE,
            sent_count=sent,
            failed_count=failed,
        )
