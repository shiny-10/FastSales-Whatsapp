from __future__ import annotations
import uuid
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.db.models import AutoReply, ChatbotRule, CannedResponse, ScheduledMessage, ScheduledMessageStatus


class AutoReplyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, company_id: UUID) -> list[AutoReply]:
        r = await self.db.execute(select(AutoReply).where(AutoReply.company_id == company_id).order_by(AutoReply.created_at))
        return list(r.scalars().all())

    async def get_active(self, company_id: UUID) -> list[AutoReply]:
        r = await self.db.execute(select(AutoReply).where(AutoReply.company_id == company_id, AutoReply.is_active == True))
        return list(r.scalars().all())

    async def create(self, company_id: UUID, **kwargs) -> AutoReply:
        obj = AutoReply(id=uuid.uuid4(), company_id=company_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj_id: UUID, **kwargs) -> AutoReply | None:
        await self.db.execute(update(AutoReply).where(AutoReply.id == obj_id).values(**kwargs))
        r = await self.db.execute(select(AutoReply).where(AutoReply.id == obj_id))
        return r.scalar_one_or_none()

    async def delete(self, obj_id: UUID) -> None:
        await self.db.execute(delete(AutoReply).where(AutoReply.id == obj_id))


class ChatbotRuleService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, company_id: UUID) -> list[ChatbotRule]:
        r = await self.db.execute(select(ChatbotRule).where(ChatbotRule.company_id == company_id).order_by(ChatbotRule.priority.desc()))
        return list(r.scalars().all())

    async def get_active(self, company_id: UUID) -> list[ChatbotRule]:
        r = await self.db.execute(
            select(ChatbotRule)
            .where(ChatbotRule.company_id == company_id, ChatbotRule.is_active == True)
            .order_by(ChatbotRule.priority.desc())
        )
        return list(r.scalars().all())

    async def create(self, company_id: UUID, **kwargs) -> ChatbotRule:
        obj = ChatbotRule(id=uuid.uuid4(), company_id=company_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj_id: UUID, **kwargs) -> ChatbotRule | None:
        await self.db.execute(update(ChatbotRule).where(ChatbotRule.id == obj_id).values(**kwargs))
        r = await self.db.execute(select(ChatbotRule).where(ChatbotRule.id == obj_id))
        return r.scalar_one_or_none()

    async def delete(self, obj_id: UUID) -> None:
        await self.db.execute(delete(ChatbotRule).where(ChatbotRule.id == obj_id))

    def match(self, rules: list[ChatbotRule], text: str) -> ChatbotRule | None:
        """Return first matching rule for incoming text."""
        lower = text.lower().strip()
        for rule in rules:
            kw = rule.keyword.lower().strip()
            if rule.match_exact:
                if lower == kw:
                    return rule
            else:
                if kw in lower:
                    return rule
        return None


class CannedResponseService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, company_id: UUID) -> list[CannedResponse]:
        r = await self.db.execute(select(CannedResponse).where(CannedResponse.company_id == company_id).order_by(CannedResponse.shortcut))
        return list(r.scalars().all())

    async def search(self, company_id: UUID, q: str) -> list[CannedResponse]:
        r = await self.db.execute(
            select(CannedResponse)
            .where(CannedResponse.company_id == company_id, CannedResponse.shortcut.ilike(f"%{q}%"))
            .order_by(CannedResponse.shortcut)
            .limit(10)
        )
        return list(r.scalars().all())

    async def create(self, company_id: UUID, **kwargs) -> CannedResponse:
        obj = CannedResponse(id=uuid.uuid4(), company_id=company_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def update(self, obj_id: UUID, **kwargs) -> CannedResponse | None:
        await self.db.execute(update(CannedResponse).where(CannedResponse.id == obj_id).values(**kwargs))
        r = await self.db.execute(select(CannedResponse).where(CannedResponse.id == obj_id))
        return r.scalar_one_or_none()

    async def delete(self, obj_id: UUID) -> None:
        await self.db.execute(delete(CannedResponse).where(CannedResponse.id == obj_id))


class ScheduledMessageService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, company_id: UUID) -> list[ScheduledMessage]:
        r = await self.db.execute(
            select(ScheduledMessage)
            .where(ScheduledMessage.company_id == company_id)
            .order_by(ScheduledMessage.scheduled_at)
        )
        return list(r.scalars().all())

    async def create(self, company_id: UUID, **kwargs) -> ScheduledMessage:
        obj = ScheduledMessage(id=uuid.uuid4(), company_id=company_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def cancel(self, obj_id: UUID) -> ScheduledMessage | None:
        await self.db.execute(
            update(ScheduledMessage)
            .where(ScheduledMessage.id == obj_id, ScheduledMessage.status == ScheduledMessageStatus.PENDING)
            .values(status=ScheduledMessageStatus.CANCELLED)
        )
        r = await self.db.execute(select(ScheduledMessage).where(ScheduledMessage.id == obj_id))
        return r.scalar_one_or_none()
