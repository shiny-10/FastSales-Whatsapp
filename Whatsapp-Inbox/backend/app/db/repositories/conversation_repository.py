from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, delete, or_
from sqlalchemy.orm import selectinload
from app.db.models import Conversation, ConversationStatus


class ConversationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, conversation_id: UUID) -> Optional[Conversation]:
        result = await self.db.execute(
            select(Conversation).where(Conversation.id == conversation_id)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(
        self, company_id: UUID, customer_phone: str
    ) -> Optional[Conversation]:
        result = await self.db.execute(
            select(Conversation).where(
                Conversation.company_id == company_id,
                Conversation.customer_phone == customer_phone,
                Conversation.status.in_([
                    ConversationStatus.OPEN,
                    ConversationStatus.PENDING,
                ]),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Conversation:
        conversation = Conversation(**kwargs)
        self.db.add(conversation)
        await self.db.flush()
        await self.db.refresh(conversation)
        return conversation

    async def update(self, conversation_id: UUID, **kwargs) -> Optional[Conversation]:
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(**kwargs)
        )
        return await self.get_by_id(conversation_id)

    async def list_conversations(
        self,
        company_id: UUID,
        status: Optional[ConversationStatus] = None,
        search: Optional[str] = None,
        assigned_agent_id: Optional[UUID] = None,
        archived: Optional[bool] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Conversation], int]:
        query = select(Conversation).where(Conversation.company_id == company_id)

        if status:
            query = query.where(Conversation.status == status)
        if assigned_agent_id:
            query = query.where(Conversation.assigned_agent_id == assigned_agent_id)
        if search:
            query = query.where(
                or_(
                    Conversation.customer_phone.ilike(f"%{search}%"),
                    Conversation.customer_name.ilike(f"%{search}%"),
                )
            )

        if archived is None:
            query = query.where(Conversation.is_archived == False)
        else:
            query = query.where(Conversation.is_archived == archived)

        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query.order_by(Conversation.last_message_at.desc().nullslast())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def increment_unread(self, conversation_id: UUID) -> None:
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(unread_count=Conversation.unread_count + 1)
        )

    async def reset_unread(self, conversation_id: UUID) -> None:
        await self.db.execute(
            update(Conversation)
            .where(Conversation.id == conversation_id)
            .values(unread_count=0)
        )

    async def delete(self, conversation_id: UUID) -> None:
        await self.db.execute(
            delete(Conversation).where(Conversation.id == conversation_id)
        )
