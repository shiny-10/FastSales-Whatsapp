from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from datetime import datetime
from typing import Optional, Any
import enum

# ─── Enums & Literals ─────────────────────────────────────────────────────────

class ConversationStatus(str, enum.Enum):
    OPEN = "OPEN"
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"

class SenderType(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"

class MessageType(str, enum.Enum):
    TEXT = "TEXT"
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    AUDIO = "AUDIO"
    DOCUMENT = "DOCUMENT"
    TEMPLATE = "TEMPLATE"
    STICKER = "STICKER"
    LOCATION = "LOCATION"
    CONTACTS = "CONTACTS"
    INTERACTIVE = "INTERACTIVE"
    REACTION = "REACTION"
    UNSUPPORTED = "UNSUPPORTED"

class MessageStatus(str, enum.Enum):
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"

# ─── WhatsApp Account Schemas ──────────────────────────────────────────────────

class WhatsAppConnectRequest(BaseModel):
    waba_id: str = Field(..., min_length=1, description="WhatsApp Business Account ID")
    phone_number_id: str = Field(..., min_length=1, description="Phone Number ID")
    access_token: str = Field(..., min_length=1, description="Meta Access Token")

class WhatsAppAccountResponse(BaseModel):
    id: int
    organization_id: int
    waba_id: str
    phone_number_id: str
    display_phone_number: Optional[str] = None
    verified_name: Optional[str] = None
    status: str
    webhook_verified: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WhatsAppStatusResponse(BaseModel):
    connected: bool
    account: Optional[WhatsAppAccountResponse] = None
    message: str

# ─── Reaction Schemas ──────────────────────────────────────────────────────────

class ReactionResponse(BaseModel):
    id: int
    message_id: int
    emoji: str
    customer_phone: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReactionGrouped(BaseModel):
    emoji: str
    count: int
    customers: list[str]

class MessageReactionsResponse(BaseModel):
    message_id: int
    reactions: list[ReactionGrouped]
    total: int

# ─── Media File Schemas ────────────────────────────────────────────────────────

class MediaFileResponse(BaseModel):
    id: int
    media_id: Optional[str] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None

    class Config:
        from_attributes = True

class SignedUrlResponse(BaseModel):
    signed_url: str
    expires_in: int

# ─── Message Schemas ───────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    meta_message_id: Optional[str] = None
    sender_type: str  # CUSTOMER, AGENT, SYSTEM
    sender_id: Optional[int] = None
    message_type: str  # TEXT, IMAGE, etc.
    content: Optional[str] = None
    caption: Optional[str] = None
    status: str  # PENDING, SENT, etc.
    is_deleted: bool
    reply_to_message_id: Optional[int] = None
    media_files: list[MediaFileResponse] = []
    reactions: list[ReactionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True

class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    total: int
    has_more: bool
    cursor: Optional[str] = None  # ISO timestamp for cursor-based pagination

class SendTextMessageRequest(BaseModel):
    conversation_id: int
    content: str = Field(..., min_length=1, max_length=4096)
    reply_to_message_id: Optional[int] = None

class SendMediaMessageRequest(BaseModel):
    conversation_id: int
    message_type: MessageType
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    file_name: Optional[str] = None
    reply_to_message_id: Optional[int] = None

class SendTemplateMessageRequest(BaseModel):
    conversation_id: int
    template_name: str
    language_code: str = "en_US"
    components: Optional[list[dict]] = None

class SendMessageRequest(BaseModel):
    conversation_id: int
    message_type: MessageType
    content: Optional[str] = None
    reply_to_message_id: Optional[int] = None
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    file_name: Optional[str] = None
    template_name: Optional[str] = None
    language_code: str = "en_US"
    components: Optional[list[dict]] = None

    @model_validator(mode="after")
    def validate_message_payload(self):
        if self.message_type == MessageType.TEXT and not self.content:
            raise ValueError("content is required for TEXT messages")

        if self.message_type in (
            MessageType.IMAGE,
            MessageType.VIDEO,
            MessageType.AUDIO,
            MessageType.DOCUMENT,
        ) and not (self.media_url or self.media_id):
            raise ValueError("media_url or media_id is required for media messages")

        if self.message_type == MessageType.TEMPLATE and not self.template_name:
            raise ValueError("template_name is required for TEMPLATE messages")

        return self

class MessageUpdateRequest(BaseModel):
    status: Optional[MessageStatus] = None

# ─── Conversation Schemas ──────────────────────────────────────────────────────

class ConversationResponse(BaseModel):
    id: int
    organization_id: int
    customer_phone: str
    customer_name: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    status: str
    is_archived: bool = False
    unread_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    last_message_preview: Optional[str] = None

    class Config:
        from_attributes = True

class ConversationListResponse(BaseModel):
    items: list[ConversationResponse]
    total: int
    page: int
    page_size: int
    has_next: bool

class ConversationCreateRequest(BaseModel):
    customer_phone: str = Field(..., min_length=5, max_length=32)
    customer_name: Optional[str] = None

class ConversationUpdateRequest(BaseModel):
    status: Optional[ConversationStatus] = None
    customer_name: Optional[str] = None
    is_archived: Optional[bool] = None

class AssignAgentRequest(BaseModel):
    agent_id: int

class ConversationFilters(BaseModel):
    status: Optional[ConversationStatus] = None
    search: Optional[str] = None
    assigned_agent_id: Optional[int] = None
    archived: Optional[bool] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

# ─── Messaging Features Schemas ────────────────────────────────────────────────

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
    id: int
    organization_id: int
    name: str
    message: str
    recipients: list[str]
    status: str
    scheduled_at: Optional[datetime] = None
    sent_count: int
    failed_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ScheduledMessageCreate(BaseModel):
    conversation_id: int
    message_type: str = "TEXT"
    content: Optional[str] = None
    media_url: Optional[str] = None
    template_name: Optional[str] = None
    components: Optional[list[Any]] = None
    scheduled_at: datetime

class ScheduledMessageResponse(BaseModel):
    id: int
    organization_id: int
    conversation_id: int
    agent_id: Optional[int] = None
    message_type: str
    content: Optional[str] = None
    media_url: Optional[str] = None
    template_name: Optional[str] = None
    components: Optional[list[Any]] = None
    scheduled_at: datetime
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

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
    id: int
    organization_id: int
    name: str
    message: str
    is_active: bool
    delay_seconds: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

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
    id: int
    organization_id: int
    keyword: str
    response: str
    is_active: bool
    match_exact: bool
    priority: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class CannedResponseCreate(BaseModel):
    shortcut: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1)

class CannedResponseUpdate(BaseModel):
    shortcut: Optional[str] = None
    content: Optional[str] = None

class CannedResponseResponse(BaseModel):
    id: int
    organization_id: int
    shortcut: str
    content: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
