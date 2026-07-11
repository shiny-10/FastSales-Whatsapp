"""
PostgreSQL Models for WhatsApp Inbox Application
All database models consolidated into a single file for easier maintenance.
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, DateTime, Enum, func, Text, ForeignKey, UniqueConstraint, BigInteger, Integer, Boolean, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base


# ========================
# ENUMS
# ========================

class ConversationStatus(str, enum.Enum):
    """Status of a conversation"""
    OPEN = "OPEN"
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class SenderType(str, enum.Enum):
    """Type of message sender"""
    CUSTOMER = "CUSTOMER"
    AGENT = "AGENT"
    SYSTEM = "SYSTEM"


class MessageType(str, enum.Enum):
    """Type of message content"""
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
    """Status of a message"""
    PENDING = "PENDING"
    SENT = "SENT"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


class BroadcastStatus(str, enum.Enum):
    """Status of a broadcast message"""
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    SENDING = "SENDING"
    DONE = "DONE"
    FAILED = "FAILED"


class ScheduledMessageStatus(str, enum.Enum):
    """Status of a scheduled message"""
    PENDING = "PENDING"
    SENT = "SENT"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


# ========================
# CORE MODELS
# ========================

class WhatsAppAccount(Base):
    """WhatsApp Business Account configuration"""
    __tablename__ = "whatsapp_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    waba_id: Mapped[str] = mapped_column(String, nullable=False)
    phone_number_id: Mapped[str] = mapped_column(String, nullable=False)
    access_token: Mapped[str] = mapped_column(String, nullable=False)
    display_phone_number: Mapped[str] = mapped_column(String, nullable=True)
    verified_name: Mapped[str] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="ACTIVE", nullable=False)
    webhook_verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Conversation(Base):
    """WhatsApp conversation between customer and agent"""
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    whatsapp_account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("whatsapp_accounts.id"), nullable=True
    )
    customer_phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=True)
    assigned_agent_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus), default=ConversationStatus.OPEN, nullable=False, index=True
    )
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
    unread_count: Mapped[int] = mapped_column(default=0)
    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", lazy="select"
    )


class Message(Base):
    """Individual message in a conversation"""
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    meta_message_id: Mapped[str] = mapped_column(String, nullable=True, unique=True, index=True)
    sender_type: Mapped[SenderType] = mapped_column(
        Enum(SenderType), nullable=False
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=True)
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType), nullable=False, default=MessageType.TEXT
    )
    content: Mapped[str] = mapped_column(Text, nullable=True)
    caption: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[MessageStatus] = mapped_column(
        Enum(MessageStatus), default=MessageStatus.PENDING, nullable=False
    )
    is_deleted: Mapped[bool] = mapped_column(default=False)
    reply_to_message_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="messages"
    )
    reactions: Mapped[list["MessageReaction"]] = relationship(
        "MessageReaction", back_populates="message", lazy="select"
    )
    media_files: Mapped[list["MediaFile"]] = relationship(
        "MediaFile", back_populates="message", lazy="select"
    )


# ========================
# MESSAGE-RELATED MODELS
# ========================

class MessageReaction(Base):
    """Emoji reactions on messages"""
    __tablename__ = "message_reactions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    emoji: Mapped[str] = mapped_column(String, nullable=False)
    customer_phone: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("message_id", "customer_phone", name="uq_reaction_message_customer"),
    )

    # Relationships
    message: Mapped["Message"] = relationship("Message", back_populates="reactions")


class MediaFile(Base):
    """Media files attached to messages"""
    __tablename__ = "media_files"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    message_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    media_id: Mapped[str] = mapped_column(String, nullable=True)  # Meta media ID
    file_name: Mapped[str] = mapped_column(String, nullable=True)
    file_url: Mapped[str] = mapped_column(String, nullable=True)   # S3 URL
    s3_key: Mapped[str] = mapped_column(String, nullable=True)
    mime_type: Mapped[str] = mapped_column(String, nullable=True)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=True)
    width: Mapped[int] = mapped_column(nullable=True)
    height: Mapped[int] = mapped_column(nullable=True)
    duration: Mapped[int] = mapped_column(nullable=True)  # seconds for audio/video
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    message: Mapped["Message"] = relationship("Message", back_populates="media_files")


# ========================
# FEATURE MODELS
# ========================

class Broadcast(Base):
    """Broadcast messages to multiple recipients"""
    __tablename__ = "broadcasts"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    recipients: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # list of phone numbers
    status: Mapped[BroadcastStatus] = mapped_column(Enum(BroadcastStatus, native_enum=False), default=BroadcastStatus.DRAFT)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ScheduledMessage(Base):
    """Messages scheduled for future delivery"""
    __tablename__ = "scheduled_messages"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    agent_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=True)
    message_type: Mapped[str] = mapped_column(String(50), default="TEXT")
    content: Mapped[str] = mapped_column(Text, nullable=True)
    media_url: Mapped[str] = mapped_column(String(1024), nullable=True)
    template_name: Mapped[str] = mapped_column(String(255), nullable=True)
    components: Mapped[list] = mapped_column(JSONB, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[ScheduledMessageStatus] = mapped_column(Enum(ScheduledMessageStatus, native_enum=False), default=ScheduledMessageStatus.PENDING)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AutoReply(Base):
    """Automatic replies to incoming messages"""
    __tablename__ = "auto_replies"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    delay_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChatbotRule(Base):
    """Chatbot rules for automatic responses"""
    __tablename__ = "chatbot_rules"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String(255), nullable=False)  # trigger keyword (case-insensitive)
    response: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    match_exact: Mapped[bool] = mapped_column(Boolean, default=False)  # False = contains, True = exact
    priority: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CannedResponse(Base):
    """Pre-written response templates"""
    __tablename__ = "canned_responses"

    id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    shortcut: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "greet", "thanks"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.db.base import Base
from app.db.models import *  # Import all models

async def create_tables():
    """Create all database tables"""
    database_url = "postgresql+asyncpg://postgres:Bubby2108@localhost:5432/whatsapp_inbox"
    
    engine = create_async_engine(database_url, echo=True)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()
    print("✅ All tables created successfully!")

if __name__ == "__main__":
    asyncio.run(create_tables())
