from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.db.models import MessageReaction


class ReactionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_message_and_customer(
        self, message_id: UUID, customer_phone: str
    ) -> Optional[MessageReaction]:
        result = await self.db.execute(
            select(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.customer_phone == customer_phone,
            )
        )
        return result.scalar_one_or_none()

    async def get_by_message(self, message_id: UUID) -> list[MessageReaction]:
        result = await self.db.execute(
            select(MessageReaction).where(MessageReaction.message_id == message_id)
        )
        return result.scalars().all()

    async def create(self, **kwargs) -> MessageReaction:
        reaction = MessageReaction(**kwargs)
        self.db.add(reaction)
        await self.db.flush()
        await self.db.refresh(reaction)
        return reaction

    async def upsert(
        self, message_id: UUID, customer_phone: str, emoji: str
    ) -> MessageReaction:
        existing = await self.get_by_message_and_customer(message_id, customer_phone)
        if existing:
            existing.emoji = emoji
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        return await self.create(
            message_id=message_id,
            customer_phone=customer_phone,
            emoji=emoji,
        )

    async def delete_by_message_and_customer(
        self, message_id: UUID, customer_phone: str
    ) -> None:
        await self.db.execute(
            delete(MessageReaction).where(
                MessageReaction.message_id == message_id,
                MessageReaction.customer_phone == customer_phone,
            )
        )
