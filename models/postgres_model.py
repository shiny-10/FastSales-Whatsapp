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
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from database.db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False)
    email = Column(String(255), nullable=True)
    industry = Column(String(100), nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    contacts = relationship("Contact", back_populates="organization", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="organization", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="organization", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="organization", cascade="all, delete-orphan")
    auto_replies = relationship("AutoReply", back_populates="organization", cascade="all, delete-orphan")
    chatbot_rules = relationship("ChatbotRule", back_populates="organization", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="organization", cascade="all, delete-orphan")
    message_logs = relationship("MessageLog", back_populates="organization", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=True)
    phone_number = Column(String(32), unique=True, nullable=True)
    email = Column(String(255), nullable=True)
    tag = Column(String(100), nullable=True)
    order_id = Column(String(100), nullable=True)
    status = Column(String(50), default="Active", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="contacts")
    conversations = relationship("Conversation", back_populates="contact")
    campaign_contacts = relationship("CampaignContact", back_populates="contact", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="contact", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_contacts_org_status", "organization_id", "status"),
    )


class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="SET NULL"), nullable=True, index=True)
    template_name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)
    language = Column(String(50), nullable=True)
    header = Column(String(50), nullable=True)
    template_body = Column(Text, nullable=False)
    footer = Column(String(255), nullable=True)
    buttons = Column(JSONB, nullable=True)
    status = Column(String(50), default="active", nullable=False)
    meta_template_id = Column(String(255), nullable=True)
    meta_template_name = Column(String(255), nullable=True)
    meta_status = Column(String(50), default="PENDING", nullable=False)
    header_url = Column(String(500), nullable=True)
    header_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="templates")
    campaigns = relationship("Campaign", back_populates="template")
    activity_logs = relationship("ActivityLog", back_populates="template")

    __table_args__ = (
        Index("ix_templates_org_status", "organization_id", "status"),
    )


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    campaign_name = Column(String(255), nullable=False)
    status = Column(String(50), default="draft", nullable=False)
    schedule_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="campaigns")
    template = relationship("Template", back_populates="campaigns")
    campaign_contacts = relationship("CampaignContact", back_populates="campaign", cascade="all, delete-orphan")
    campaign_recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_campaigns_org_status", "organization_id", "status"),
    )


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(50), default="pending", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

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
    status = Column(String(50), default="pending", nullable=False)
    message_id = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    campaign = relationship("Campaign", back_populates="campaign_recipients")
    contact = relationship("Contact", back_populates="campaign_recipients")

    __table_args__ = (
        UniqueConstraint("campaign_id", "phone_number", name="uq_campaign_phone"),
        Index("ix_campaign_recipients_campaign_status", "campaign_id", "status"),
    )


class MessageLog(Base):
    __tablename__ = "message_logs"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    message_id = Column(String(255), index=True, nullable=True)
    phone_number = Column(String(32), nullable=True)
    text = Column(Text, nullable=True)
    status = Column(String(50), default="sent", nullable=False)
    direction = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="message_logs")
    conversation_messages = relationship("ConversationMessage", back_populates="message_log")

    __table_args__ = (
        Index("ix_message_logs_org_status", "organization_id", "status"),
    )


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    template_id = Column(Integer, ForeignKey("templates.id", ondelete="SET NULL"), nullable=True, index=True)
    template_name = Column(String(255), nullable=True)
    status = Column(String(50), default="PENDING", nullable=False)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="activity_logs")
    template = relationship("Template", back_populates="activity_logs")


class AutoReply(Base):
    __tablename__ = "auto_replies"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    match_type = Column(String(50), nullable=False)
    pattern = Column(String(255), nullable=False)
    response_template = Column(Text, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="auto_replies")

    __table_args__ = (
        Index("ix_auto_replies_org_active", "organization_id", "active"),
    )


class ChatbotRule(Base):
    __tablename__ = "chatbot_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    conditions = Column(JSONB, nullable=True)
    actions = Column(JSONB, nullable=True)
    priority = Column(Integer, default=100, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="chatbot_rules")

    __table_args__ = (
        Index("ix_chatbot_rules_org_active_priority", "organization_id", "active", "priority"),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True)
    customer_phone = Column(String(32), nullable=True)
    customer_name = Column(String(255), nullable=True)
    status = Column(String(50), default="OPEN", nullable=False)
    assigned_to = Column(Integer, nullable=True)
    archived = Column(Boolean, default=False, nullable=False)
    last_message_at = Column(DateTime, nullable=True)
    metadata_json = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    organization = relationship("Organization", back_populates="conversations")
    contact = relationship("Contact", back_populates="conversations")
    messages = relationship("ConversationMessage", back_populates="conversation", cascade="all, delete-orphan")
    reads = relationship("ConversationRead", back_populates="conversation", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_conversations_org_status_last_message", "organization_id", "status", "last_message_at"),
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    message_log_id = Column(Integer, ForeignKey("message_logs.id", ondelete="SET NULL"), nullable=True, index=True)
    direction = Column(String(20), nullable=True)
    message_type = Column(String(50), nullable=True)
    text = Column(Text, nullable=True)
    provider_message_id = Column(String(255), nullable=True)
    attachments = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages")
    message_log = relationship("MessageLog", back_populates="conversation_messages")

    __table_args__ = (
        Index("ix_conversation_messages_conversation_created", "conversation_id", "created_at"),
    )


class ConversationRead(Base):
    __tablename__ = "conversation_reads"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    last_read_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="reads")

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
    )


class WhatsAppSettings(Base):
    __tablename__ = "whatsapp_settings"

    id = Column(Integer, primary_key=True, index=True)
    waba_id = Column(String(255), nullable=True)
    waba_name = Column(String(255), nullable=True)
    phone_display_name = Column(String(255), nullable=True)
    phone_number = Column(String(32), nullable=True)
    phone_quality = Column(String(50), nullable=True)
    status = Column(String(50), nullable=True)
    meta_business_account_id = Column(String(255), nullable=True)
    business_account_name = Column(String(255), nullable=True)
    connected_by = Column(String(255), nullable=True)
    connected_on = Column(DateTime, nullable=True)
    access_token_masked = Column(String(255), nullable=True)
    token_expires_on = Column(DateTime, nullable=True)
    current_limit_24h = Column(Integer, nullable=True)
    used_in_24h = Column(Integer, nullable=True)
    webhook_url = Column(String(500), nullable=True)
    webhook_token = Column(String(255), nullable=True)
    webhook_status = Column(String(50), nullable=True)
    last_ping = Column(DateTime, nullable=True)
    subscribed_events = Column(JSONB, nullable=True)

    def to_dict(self):
        return {
            "waba_id": self.waba_id,
            "waba_name": self.waba_name,
            "phone_display_name": self.phone_display_name,
            "phone_number": self.phone_number,
            "phone_quality": self.phone_quality,
            "status": self.status,
            "meta_business_account_id": self.meta_business_account_id,
            "business_account_name": self.business_account_name,
            "connected_by": self.connected_by,
            "connected_on": self.connected_on.isoformat() if self.connected_on else None,
            "access_token_masked": self.access_token_masked,
            "token_expires_on": self.token_expires_on.isoformat() if self.token_expires_on else None,
            "current_limit_24h": self.current_limit_24h,
            "used_in_24h": self.used_in_24h,
            "webhook_url": self.webhook_url,
            "webhook_token": self.webhook_token,
            "webhook_status": self.webhook_status,
            "last_ping": self.last_ping.isoformat() if self.last_ping else None,
            "subscribed_events": self.subscribed_events or [],
        }


__all__ = [
    "ActivityLog",
    "AutoReply",
    "Campaign",
    "CampaignContact",
    "CampaignRecipient",
    "ChatbotRule",
    "Contact",
    "Conversation",
    "ConversationMessage",
    "ConversationRead",
    "MessageLog",
    "Organization",
    "Template",
    "WhatsAppSettings",
    "Base",
]
