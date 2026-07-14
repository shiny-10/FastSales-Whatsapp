from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from models.postgres_model import WhatsAppAccount
from typing import Optional
import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.postgres_model import WhatsAppAccount
from schemas.whatsapp_inbox import WhatsAppConnectRequest

class WhatsAppService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = WhatsAppRepository(db)

    def validate_token(self, access_token: str, phone_number_id: str) -> dict:
        """Call Meta API to validate credentials and get phone number details."""
        meta_base_url = getattr(config, "META_BASE_URL", "https://graph.facebook.com")
        meta_api_version = getattr(config, "META_API_VERSION", "v23.0")
        url = f"{meta_base_url}/{meta_api_version}/{phone_number_id}"
        headers = {"Authorization": f"Bearer {access_token}"}

        with httpx.Client(timeout=10.0) as client:
            try:
                resp = client.get(url, headers=headers)
                resp.raise_for_status()
                return resp.json()
            except httpx.HTTPStatusError as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid Meta credentials: {e.response.text}",
                )
            except httpx.RequestError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Could not reach Meta API",
                )

    def connect(self, organization_id: int, request: WhatsAppConnectRequest) -> WhatsAppAccount:
        # Validate Meta credentials
        phone_data = self.validate_token(
            request.access_token, request.phone_number_id
        )
        display_phone = phone_data.get("display_phone_number")
        verified_name = phone_data.get("verified_name")

        account = self.repo.upsert(
            organization_id=organization_id,
            waba_id=request.waba_id,
            phone_number_id=request.phone_number_id,
            access_token=request.access_token,
            display_phone_number=display_phone,
            verified_name=verified_name,
            status="ACTIVE",
        )
        return account

    def get_account(self, organization_id: int) -> Optional[WhatsAppAccount]:
        account = self.repo.get_by_organization(organization_id)
        if account and account.status == "ACTIVE":
            try:
                self.validate_token(account.access_token, account.phone_number_id)
            except HTTPException as exc:
                if exc.status_code == status.HTTP_400_BAD_REQUEST:
                    account = self.repo.update(account.id, status="DISCONNECTED")
                    return account
                raise
        return account

    def disconnect(self, organization_id: int) -> bool:
        account = self.repo.get_by_organization(organization_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp account not found",
            )
        self.repo.update(account.id, status="DISCONNECTED")
        return True

    def get_account_by_phone_number_id(self, phone_number_id: str) -> Optional[WhatsAppAccount]:
        return self.repo.get_by_phone_number_id(phone_number_id)

# --- Repository Code ---

class WhatsAppRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_organization(self, organization_id: int) -> Optional[WhatsAppAccount]:
        return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.organization_id == organization_id).first()

    def get_by_id(self, account_id: int) -> Optional[WhatsAppAccount]:
        return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.id == account_id).first()

    def get_by_phone_number_id(self, phone_number_id: str) -> Optional[WhatsAppAccount]:
        if not phone_number_id:
            return None
        return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.phone_number_id == phone_number_id).first()

    def get_active_accounts(self) -> list[WhatsAppAccount]:
        return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").all()

    def get_any_active_account(self) -> Optional[WhatsAppAccount]:
        return self.db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first()

    def get_fallback_account(self) -> Optional[WhatsAppAccount]:
        return self.get_any_active_account()

    def create(self, **kwargs) -> WhatsAppAccount:
        account = WhatsAppAccount(**kwargs)
        self.db.add(account)
        self.db.commit()
        self.db.refresh(account)
        return account

    def update(self, account_id: int, **kwargs) -> Optional[WhatsAppAccount]:
        account = self.get_by_id(account_id)
        if account:
            for k, v in kwargs.items():
                setattr(account, k, v)
            self.db.commit()
            self.db.refresh(account)
        return account

    def delete(self, account_id: int) -> bool:
        account = self.get_by_id(account_id)
        if account:
            self.db.delete(account)
            self.db.commit()
            return True
        return False

    def upsert(self, organization_id: int, **kwargs) -> WhatsAppAccount:
        existing = self.get_by_organization(organization_id)
        if existing:
            for k, v in kwargs.items():
                setattr(existing, k, v)
            self.db.commit()
            self.db.refresh(existing)
            return existing
        return self.create(organization_id=organization_id, **kwargs)
