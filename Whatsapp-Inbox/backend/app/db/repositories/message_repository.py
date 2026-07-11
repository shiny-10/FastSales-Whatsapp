from uuid import UUID
from typing import Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from sqlalchemy.orm import selectinload
from app.db.models import Message, MessageStatus
from sqlalchemy import select
from sqlalchemy.orm import selectinload


class MessageRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, message_id: UUID) -> Optional[Message]:
        result = await self.db.execute(
            select(Message)
            .where(Message.id == message_id)
            .options(
                selectinload(Message.reactions),
                selectinload(Message.media_files),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_meta_id(self, meta_message_id: str) -> Optional[Message]:
        result = await self.db.execute(
            select(Message).where(Message.meta_message_id == meta_message_id)
        )
        return result.scalar_one_or_none()

    async def create(self, **kwargs) -> Message:
        message = Message(**kwargs)
        self.db.add(message)
        await self.db.flush()
        # Reload with relationships eagerly loaded so callers (and pydantic) can access them
        query = select(Message).where(Message.id == message.id).options(
            selectinload(Message.reactions),
            selectinload(Message.media_files),
        )
        result = await self.db.execute(query)
        return result.scalar_one()

    async def update(self, message_id: UUID, **kwargs) -> Optional[Message]:
        await self.db.execute(
            update(Message)
            .where(Message.id == message_id)
            .values(**kwargs)
        )
        return await self.get_by_id(message_id)

    async def update_status_by_meta_id(
        self, meta_message_id: str, status: MessageStatus
    ) -> None:
        await self.db.execute(
            update(Message)
            .where(Message.meta_message_id == meta_message_id)
            .values(status=status)
        )

    async def list_by_conversation(
        self,
        conversation_id: UUID,
        before_cursor: Optional[datetime] = None,
        page_size: int = 30,
    ) -> tuple[list[Message], int]:
        query = select(Message).where(Message.conversation_id == conversation_id)

        if before_cursor:
            query = query.where(Message.created_at < before_cursor)

        count_query = select(func.count()).select_from(
            select(Message).where(Message.conversation_id == conversation_id).subquery()
        )
        total_result = await self.db.execute(count_query)
        total = total_result.scalar_one()

        query = (
            query
            .options(
                selectinload(Message.reactions),
                selectinload(Message.media_files),
            )
            .order_by(Message.created_at.desc())
            .limit(page_size)
        )

        result = await self.db.execute(query)
        messages = list(reversed(result.scalars().all()))
        return messages, total
