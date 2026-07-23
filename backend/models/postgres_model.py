from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from core.database import Base
from sqlalchemy import JSON as JSON_TYPE


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=True)
    phone_number = Column(String(32), unique=True, nullable=True)
    email = Column(String(255), nullable=True)
    tag = Column(String(100), nullable=True)
    order_id = Column(String(100), nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    campaign_contacts = relationship("CampaignContact", back_populates="contact", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="contact", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_contacts_status", "status"),
    )


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    template_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    language = Column(String(50), nullable=True)
    header = Column(String(50), nullable=True)
    template_body = Column(Text, nullable=False)
    footer = Column(String(255), nullable=True)
    buttons = Column(JSON_TYPE, nullable=True)
    status = Column(String(50), default="active", nullable=False)
    meta_template_id = Column(String(255), nullable=True)
    meta_template_name = Column(String(255), nullable=True)
    meta_status = Column(String(50), default="PENDING", nullable=False)
    header_url = Column(String(500), nullable=True)
    header_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    campaigns = relationship("Campaign", back_populates="template")
    activity_logs = relationship("ActivityLog", back_populates="template")

    __table_args__ = (
        Index("ix_templates_status", "status"),
    )


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    status = Column(String(50), default="draft", nullable=False)
    schedule_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    template = relationship("Template", back_populates="campaigns")
    campaign_contacts = relationship("CampaignContact", back_populates="campaign", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_campaigns_status", "status"),
    )


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)

    campaign = relationship("Campaign", back_populates="campaign_contacts")
    contact = relationship("Contact", back_populates="campaign_contacts")

    __table_args__ = (
        UniqueConstraint("campaign_id", "contact_id", name="uq_campaign_contact"),
    )


class CampaignRecipient(Base):
    __tablename__ = "campaign_recipients"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    phone_number = Column(String(32), nullable=False)
    status = Column(String(50), default="sent", nullable=False)
    message_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="campaign_recipients")
    contact = relationship("Contact", back_populates="campaign_recipients")

    __table_args__ = (
        Index("ix_campaign_recipients_campaign_id", "campaign_id"),
        Index("ix_campaign_recipients_status", "status"),
    )


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(255), index=True, nullable=True)
    phone_number = Column(String(32), nullable=True)
    text = Column(Text, nullable=True)
    status = Column(String(50), default="sent", nullable=False)
    direction = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_message_logs_status", "status"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    template_name = Column(String(255), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    template = relationship("Template", back_populates="activity_logs")


class WhatsAppAccount(Base):
    __tablename__ = "whatsapp_accounts"

    id = Column(Integer, primary_key=True, index=True)
    waba_id = Column(String(255), nullable=False)
    phone_number_id = Column(String(255), nullable=False, unique=True)
    display_phone_number = Column(String(50), nullable=True)
    verified_name = Column(String(255), nullable=True)
    access_token = Column(Text, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    webhook_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# ─── WhatsApp Inbox Models ────────────────────────────────────────────────────

class WhatsAppInboxConversation(Base):
    __tablename__ = "whatsapp_inbox_conversations"

    id = Column(Integer, primary_key=True, index=True)
    whatsapp_account_id = Column(Integer, ForeignKey("whatsapp_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_phone = Column(String(32), nullable=False, index=True)
    customer_name = Column(String(255), nullable=True)
    assigned_agent_id = Column(Integer, nullable=True, index=True)
    status = Column(String(50), default="OPEN", nullable=False, index=True)
    is_archived = Column(Boolean, default=False, nullable=False, index=True)
    unread_count = Column(Integer, default=0, nullable=False)
    last_message_at = Column(DateTime, nullable=True, index=True)
    customer_last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    account = relationship("WhatsAppAccount", foreign_keys=[whatsapp_account_id])
    messages = relationship("WhatsAppInboxMessage", back_populates="conversation", cascade="all, delete-orphan")
    scheduled_messages = relationship("WhatsAppInboxScheduledMessage", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_whatsapp_inbox_conversations_last_msg", "last_message_at"),
    )


class WhatsAppInboxMessage(Base):
    __tablename__ = "whatsapp_inbox_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("whatsapp_inbox_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    meta_message_id = Column(String(255), nullable=True, unique=True, index=True)
    sender_type = Column(String(20), nullable=False)
    sender_id = Column(Integer, nullable=True)
    message_type = Column(String(30), default="TEXT", nullable=False)
    content = Column(Text, nullable=True)
    caption = Column(Text, nullable=True)
    status = Column(String(30), default="SENT", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    reply_to_message_id = Column(Integer, ForeignKey("whatsapp_inbox_messages.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversation = relationship("WhatsAppInboxConversation", back_populates="messages")
    media_files = relationship("WhatsAppInboxMediaFile", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("WhatsAppInboxMessageReaction", back_populates="message", cascade="all, delete-orphan")
    reply_to = relationship("WhatsAppInboxMessage", remote_side=[id])

    __table_args__ = (
        Index("ix_whatsapp_inbox_messages_created", "conversation_id", "created_at"),
    )


class WhatsAppInboxMediaFile(Base):
    __tablename__ = "whatsapp_inbox_media_files"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("whatsapp_inbox_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    media_id = Column(String(255), nullable=True)
    file_name = Column(String(255), nullable=True)
    file_url = Column(String(500), nullable=False)
    mime_type = Column(String(100), nullable=True)
    file_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("WhatsAppInboxMessage", back_populates="media_files")


class WhatsAppInboxMessageReaction(Base):
    __tablename__ = "whatsapp_inbox_message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("whatsapp_inbox_messages.id", ondelete="CASCADE"), nullable=False, index=True)
    emoji = Column(String(10), nullable=False)
    customer_phone = Column(String(32), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    message = relationship("WhatsAppInboxMessage", back_populates="reactions")

    __table_args__ = (
        UniqueConstraint("message_id", "customer_phone", name="uq_inbox_msg_reaction_customer"),
    )


class WhatsAppInboxScheduledMessage(Base):
    __tablename__ = "whatsapp_inbox_scheduled_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("whatsapp_inbox_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id = Column(Integer, nullable=False)
    message_type = Column(String(30), default="TEXT", nullable=False)
    content = Column(Text, nullable=True)
    template_name = Column(String(255), nullable=True)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    status = Column(String(30), default="PENDING", nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    conversation = relationship("WhatsAppInboxConversation", back_populates="scheduled_messages")


class WhatsAppInboxAutoReply(Base):
    __tablename__ = "whatsapp_inbox_auto_replies"

    id = Column(Integer, primary_key=True, index=True)
    trigger_keyword = Column(String(255), nullable=True)
    match_type = Column(String(50), default="EXACT", nullable=False)
    message = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class WhatsAppInboxChatbotRule(Base):
    __tablename__ = "whatsapp_inbox_chatbot_rules"

    id = Column(Integer, primary_key=True, index=True)
    keyword = Column(String(255), nullable=False)
    response = Column(Text, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    match_exact = Column(Boolean, default=False, nullable=False)
    priority = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class WhatsAppInboxCannedResponse(Base):
    __tablename__ = "whatsapp_inbox_canned_responses"

    id = Column(Integer, primary_key=True, index=True)
    shortcut = Column(String(100), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class WhatsAppInboxBroadcast(Base):
    __tablename__ = "whatsapp_inbox_broadcasts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    template_name = Column(String(255), nullable=True)
    recipients = Column(JSON_TYPE, nullable=False)
    status = Column(String(50), default="DRAFT", nullable=False)
    scheduled_at = Column(DateTime, nullable=True)
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


__all__ = [
    "ActivityLog",
    "Campaign",
    "CampaignContact",
    "CampaignRecipient",
    "Contact",
    "MessageLog",
    "Template",
    "WhatsAppAccount",
    "WhatsAppInboxConversation",
    "WhatsAppInboxMessage",
    "WhatsAppInboxMessageReaction",
    "WhatsAppInboxMediaFile",
    "WhatsAppInboxBroadcast",
    "WhatsAppInboxScheduledMessage",
    "WhatsAppInboxAutoReply",
    "WhatsAppInboxChatbotRule",
    "WhatsAppInboxCannedResponse",
    "Base",
]
