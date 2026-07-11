from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import datetime
from typing import Optional


class WhatsAppConnectRequest(BaseModel):
    waba_id: str = Field(..., min_length=1, description="WhatsApp Business Account ID")
    phone_number_id: str = Field(..., min_length=1, description="Phone Number ID")
    access_token: str = Field(..., min_length=1, description="Meta Access Token")


class WhatsAppAccountResponse(BaseModel):
    id: UUID
    company_id: UUID
    waba_id: str
    phone_number_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    status: str
    webhook_verified: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WhatsAppStatusResponse(BaseModel):
    connected: bool
    account: Optional[WhatsAppAccountResponse] = None
    message: str
