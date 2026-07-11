from pydantic import BaseModel, Field, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.db.models import SenderType, MessageType, MessageStatus


class MediaFileResponse(BaseModel):
    id: UUID
    media_id: Optional[str] = None
    file_name: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[int] = None

    model_config = {"from_attributes": True}


class ReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted_by: list[str]  # customer phones


class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    meta_message_id: Optional[str] = None
    sender_type: SenderType
    sender_id: Optional[UUID] = None
    message_type: MessageType
    content: Optional[str] = None
    caption: Optional[str] = None
    status: MessageStatus
    is_deleted: bool
    reply_to_message_id: Optional[UUID] = None
    media_files: list[MediaFileResponse] = []
    reactions: list["ReactionResponse"] = []  # noqa: F821
    created_at: datetime

    model_config = {"from_attributes": True}


class MessageListResponse(BaseModel):
    items: list[MessageResponse]
    total: int
    has_more: bool
    cursor: Optional[str] = None  # ISO timestamp for cursor-based pagination


class SendTextMessageRequest(BaseModel):
    conversation_id: UUID
    content: str = Field(..., min_length=1, max_length=4096)
    reply_to_message_id: Optional[UUID] = None


class SendMediaMessageRequest(BaseModel):
    conversation_id: UUID
    message_type: MessageType
    media_url: Optional[str] = None
    media_id: Optional[str] = None
    caption: Optional[str] = None
    file_name: Optional[str] = None
    reply_to_message_id: Optional[UUID] = None


class SendTemplateMessageRequest(BaseModel):
    conversation_id: UUID
    template_name: str
    language_code: str = "en_US"
    components: Optional[list[dict]] = None


class SendMessageRequest(BaseModel):
    conversation_id: UUID
    message_type: MessageType
    content: Optional[str] = None
    reply_to_message_id: Optional[UUID] = None
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


class ReactionResponse(BaseModel):
    id: UUID
    message_id: UUID
    emoji: str
    customer_phone: str
    created_at: datetime

    model_config = {"from_attributes": True}


# Rebuild to handle forward reference
MessageResponse.model_rebuild()
