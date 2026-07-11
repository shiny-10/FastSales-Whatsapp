from uuid import UUID
from typing import Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.logging import get_logger
from app.db.repositories.conversation_repository import ConversationRepository
from app.db.repositories.message_repository import MessageRepository
from app.db.models import Conversation, ConversationStatus
from app.api.v1.schemas.conversation import (
    ConversationListResponse,
    ConversationResponse,
    ConversationFilters,
)

logger = get_logger(__name__)


class ConversationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ConversationRepository(db)
        self.msg_repo = MessageRepository(db)

    async def get_or_create(
        self,
        company_id: UUID,
        customer_phone: str,
        whatsapp_account_id: Optional[UUID] = None,
        customer_name: Optional[str] = None,
    ) -> tuple[Conversation, bool]:
        """Get existing open conversation or create new one."""
        existing = await self.repo.get_by_phone(company_id, customer_phone)
        if existing:
            return existing, False

        conversation = await self.repo.create(
            company_id=company_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            whatsapp_account_id=whatsapp_account_id,
            status=ConversationStatus.OPEN,
            last_message_at=datetime.now(timezone.utc),
        )
        logger.info(f"New conversation created: {conversation.id} for {customer_phone}")
        return conversation, True

    async def list_conversations(
        self, company_id: UUID, filters: ConversationFilters
    ) -> ConversationListResponse:
        conversations, total = await self.repo.list_conversations(
            company_id=company_id,
            status=filters.status,
            search=filters.search,
            assigned_agent_id=filters.assigned_agent_id,
            archived=filters.archived,
            page=filters.page,
            page_size=filters.page_size,
        )

        items = []
        for conv in conversations:
            # Get last message preview
            messages, _ = await self.msg_repo.list_by_conversation(
                conv.id, page_size=1
            )
            preview = None
            if messages:
                last = messages[-1]
                preview = last.content or f"[{last.message_type.value}]"

            resp = ConversationResponse(
                **{
                    c.key: getattr(conv, c.key)
                    for c in conv.__table__.columns
                    if c.key != "last_message_preview"
                },
                last_message_preview=preview,
            )
            items.append(resp)

        return ConversationListResponse(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            has_next=(filters.page * filters.page_size) < total,
        )

    async def get_conversation(
        self, conversation_id: UUID
    ) -> Conversation:
        conv = await self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv

    async def delete_conversation(self, conversation_id: UUID) -> None:
        conv = await self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        await self.repo.delete(conversation_id)

    async def update_conversation(
        self, conversation_id: UUID, **kwargs
    ) -> Conversation:
        conv = await self.repo.update(conversation_id, **kwargs)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        return conv

    async def assign_agent(
        self, conversation_id: UUID, agent_id: UUID
    ) -> Conversation:
        return await self.update_conversation(
            conversation_id, assigned_agent_id=agent_id
        )

    async def reset_unread(self, conversation_id: UUID) -> Conversation:
        conv = await self.repo.get_by_id(conversation_id)
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Conversation not found",
            )
        await self.repo.reset_unread(conversation_id)
        return await self.repo.get_by_id(conversation_id)

    async def touch_last_message(
        self, conversation_id: UUID, ts: Optional[datetime] = None
    ) -> None:
        ts = ts or datetime.now(timezone.utc)
        await self.repo.update(conversation_id, last_message_at=ts)
