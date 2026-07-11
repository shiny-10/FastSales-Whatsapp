from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, Any


# ── Broadcast ──────────────────────────────────────────────────────────────────

class BroadcastCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    recipients: list[str] = Field(..., min_length=1)  # phone numbers
    scheduled_at: Optional[datetime] = None


class BroadcastUpdate(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None
    recipients: Optional[list[str]] = None
    scheduled_at: Optional[datetime] = None


class BroadcastResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    message: str
    recipients: list[str]
    status: str
    scheduled_at: Optional[datetime] = None
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Scheduled Message ──────────────────────────────────────────────────────────

class ScheduledMessageCreate(BaseModel):
    conversation_id: UUID
    message_type: str = "TEXT"
    content: Optional[str] = None
    media_url: Optional[str] = None
    template_name: Optional[str] = None
    components: Optional[list[Any]] = None
    scheduled_at: datetime


class ScheduledMessageResponse(BaseModel):
    id: UUID
    company_id: UUID
    conversation_id: UUID
    agent_id: Optional[UUID] = None
    message_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    template_name: Optional[str] = None
    components: Optional[list[Any]] = None
    scheduled_at: datetime
    status: str
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Auto Reply ─────────────────────────────────────────────────────────────────

class AutoReplyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1)
    is_active: bool = True
    delay_seconds: int = 0


class AutoReplyUpdate(BaseModel):
    name: Optional[str] = None
    message: Optional[str] = None
    is_active: Optional[bool] = None
    delay_seconds: Optional[int] = None


class AutoReplyResponse(BaseModel):
    id: UUID
    company_id: UUID
    name: str
    message: str
    is_active: bool
    delay_seconds: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Chatbot Rule ───────────────────────────────────────────────────────────────

class ChatbotRuleCreate(BaseModel):
    keyword: str = Field(..., min_length=1, max_length=255)
    response: str = Field(..., min_length=1)
    is_active: bool = True
    match_exact: bool = False
    priority: int = 0


class ChatbotRuleUpdate(BaseModel):
    keyword: Optional[str] = None
    response: Optional[str] = None
    is_active: Optional[bool] = None
    match_exact: Optional[bool] = None
    priority: Optional[int] = None


class ChatbotRuleResponse(BaseModel):
    id: UUID
    company_id: UUID
    keyword: str
    response: str
    is_active: bool
    match_exact: bool
    priority: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


# ── Canned Response ────────────────────────────────────────────────────────────

class CannedResponseCreate(BaseModel):
    shortcut: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)


class CannedResponseUpdate(BaseModel):
    shortcut: Optional[str] = None
    content: Optional[str] = None


class CannedResponseResponse(BaseModel):
    id: UUID
    company_id: UUID
    shortcut: str
    content: str
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
