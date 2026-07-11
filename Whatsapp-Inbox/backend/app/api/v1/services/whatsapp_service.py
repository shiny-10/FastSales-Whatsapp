from uuid import UUID
from typing import Optional
import httpx
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.db.repositories.whatsapp_repository import WhatsAppRepository
from app.db.models import WhatsAppAccount
from app.api.v1.schemas.whatsapp import WhatsAppConnectRequest

logger = get_logger(__name__)


class WhatsAppService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = WhatsAppRepository(db)

    async def validate_token(
        self, access_token: str, phone_number_id: str
    ) -> dict:
        """Call Meta API to validate credentials and get phone number details."""
        url = f"{settings.META_BASE_URL}/{settings.META_API_VERSION}/{phone_number_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                logger.error(f"Meta token validation failed: {e.response.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Meta credentials: {e.response.text}",
                )
            except httpx.RequestError as e:
                logger.error(f"Meta API request error: {e}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not reach Meta API",
                )

    async def connect(
        self, company_id: UUID, request: WhatsAppConnectRequest
    ) -> WhatsAppAccount:
        # Validate Meta credentials
        phone_data = await self.validate_token(
            request.access_token, request.phone_number_id
        )
        display_phone = phone_data.get("display_phone_number")
        verified_name = phone_data.get("verified_name")

        account = await self.repo.upsert(
            company_id=company_id,
            waba_id=request.waba_id,
            phone_number_id=request.phone_number_id,
            access_token=request.access_token,
            display_phone_number=display_phone,
            verified_name=verified_name,
            status="ACTIVE",
        )
        logger.info(f"WhatsApp account connected for company {company_id}")
        return account

    async def get_account(self, company_id: UUID) -> Optional[WhatsAppAccount]:
        account = await self.repo.get_by_company(company_id)
        if account and account.status == "ACTIVE":
            try:
                await self.validate_token(account.access_token, account.phone_number_id)
            except HTTPException as exc:
                if exc.status_code == status.HTTP_400_BAD_REQUEST:
                    account = await self.repo.update(account.id, status="DISCONNECTED")
                    return account
                raise
        return account

    async def disconnect(self, company_id: UUID) -> bool:
        account = await self.repo.get_by_company(company_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp account not found",
            )
        await self.repo.update(account.id, status="DISCONNECTED")
        logger.info(f"WhatsApp account disconnected for company {company_id}")
        return True

    async def get_account_by_phone_number_id(
        self, phone_number_id: str
    ) -> Optional[WhatsAppAccount]:
        return await self.repo.get_by_phone_number_id(phone_number_id)
