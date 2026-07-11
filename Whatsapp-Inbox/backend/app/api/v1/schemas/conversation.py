from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from app.db.models import ConversationStatus


class ConversationResponse(BaseModel):
    id: UUID
    company_id: UUID
    customer_phone: str
    customer_name: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
    status: ConversationStatus
    is_archived: bool = False
    unread_count: int
    last_message_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    last_message_preview: Optional[str] = None

    model_config = {"from_attributes": True}


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
    agent_id: UUID


class ConversationFilters(BaseModel):
    status: Optional[ConversationStatus] = None
    search: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
    archived: Optional[bool] = None
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
