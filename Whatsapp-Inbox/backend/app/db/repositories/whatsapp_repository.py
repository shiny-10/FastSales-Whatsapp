from uuid import UUID
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.db.models import WhatsAppAccount


async def _get_single_active_account(db: AsyncSession) -> Optional[WhatsAppAccount]:
    result = await db.execute(
        select(WhatsAppAccount).where(WhatsAppAccount.status == "ACTIVE")
    )
    accounts = result.scalars().all()
    return accounts[0] if len(accounts) == 1 else None


class WhatsAppRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_company(self, company_id: UUID) -> Optional[WhatsAppAccount]:
        result = await self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.company_id == company_id)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, account_id: UUID) -> Optional[WhatsAppAccount]:
        result = await self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.id == account_id)
        )
        return result.scalar_one_or_none()

    async def get_by_phone_number_id(self, phone_number_id: str) -> Optional[WhatsAppAccount]:
        if not phone_number_id:
            return None
        result = await self.db.execute(
            select(WhatsAppAccount).where(
                WhatsAppAccount.phone_number_id == phone_number_id
            )
        )
        return result.scalar_one_or_none()

    async def get_active_accounts(self) -> list[WhatsAppAccount]:
        result = await self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.status == "ACTIVE")
        )
        return result.scalars().all()

    async def get_any_active_account(self) -> Optional[WhatsAppAccount]:
        result = await self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.status == "ACTIVE")
        )
        accounts = result.scalars().all()
        return accounts[0] if accounts else None

    async def get_fallback_account(self) -> Optional[WhatsAppAccount]:
        return await _get_single_active_account(self.db)

    async def create(self, **kwargs) -> WhatsAppAccount:
        account = WhatsAppAccount(**kwargs)
        self.db.add(account)
        await self.db.flush()
        await self.db.refresh(account)
        return account

    async def update(self, account_id: UUID, **kwargs) -> Optional[WhatsAppAccount]:
        await self.db.execute(
            update(WhatsAppAccount)
            .where(WhatsAppAccount.id == account_id)
            .values(**kwargs)
        )
        return await self.get_by_id(account_id)

    async def delete(self, account_id: UUID) -> bool:
        account = await self.get_by_id(account_id)
        if account:
            await self.db.delete(account)
            return True
        return False

    async def upsert(self, company_id: UUID, **kwargs) -> WhatsAppAccount:
        existing = await self.get_by_company(company_id)
        if existing:
            for k, v in kwargs.items():
                setattr(existing, k, v)
            await self.db.flush()
            await self.db.refresh(existing)
            return existing
        return await self.create(company_id=company_id, **kwargs)
