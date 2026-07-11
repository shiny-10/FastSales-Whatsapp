from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional


class ReactionResponse(BaseModel):
    id: UUID
    message_id: UUID
    emoji: str
    customer_phone: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReactionGrouped(BaseModel):
    emoji: str
    count: int
    customers: list[str]


class MessageReactionsResponse(BaseModel):
    message_id: UUID
    reactions: list[ReactionGrouped]
    total: int
