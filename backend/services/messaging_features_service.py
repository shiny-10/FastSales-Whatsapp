from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from models.postgres_model import (
    WhatsAppInboxAutoReply,
    WhatsAppInboxChatbotRule,
    WhatsAppInboxCannedResponse,
    WhatsAppInboxScheduledMessage,
)

class AutoReplyService:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[WhatsAppInboxAutoReply]:
        return (
            self.db.query(WhatsAppInboxAutoReply)
            .order_by(WhatsAppInboxAutoReply.created_at)
            .all()
        )

    def get_active(self) -> list[WhatsAppInboxAutoReply]:
        return (
            self.db.query(WhatsAppInboxAutoReply)
            .filter(WhatsAppInboxAutoReply.is_active == True)
            .all()
        )

    def create(self, **kwargs) -> WhatsAppInboxAutoReply:
        obj = WhatsAppInboxAutoReply(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj_id: int, **kwargs) -> Optional[WhatsAppInboxAutoReply]:
        obj = self.db.query(WhatsAppInboxAutoReply).filter(WhatsAppInboxAutoReply.id == obj_id).first()
        if obj:
            for k, v in kwargs.items():
                setattr(obj, k, v)
            self.db.commit()
            self.db.refresh(obj)
        return obj

    def delete(self, obj_id: int) -> None:
        obj = self.db.query(WhatsAppInboxAutoReply).filter(WhatsAppInboxAutoReply.id == obj_id).first()
        if obj:
            self.db.delete(obj)
            self.db.commit()

class ChatbotRuleService:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[WhatsAppInboxChatbotRule]:
        return (
            self.db.query(WhatsAppInboxChatbotRule)
            .order_by(WhatsAppInboxChatbotRule.priority.desc())
            .all()
        )

    def get_active(self) -> list[WhatsAppInboxChatbotRule]:
        return (
            self.db.query(WhatsAppInboxChatbotRule)
            .filter(WhatsAppInboxChatbotRule.is_active == True)
            .order_by(WhatsAppInboxChatbotRule.priority.desc())
            .all()
        )

    def create(self, **kwargs) -> WhatsAppInboxChatbotRule:
        obj = WhatsAppInboxChatbotRule(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj_id: int, **kwargs) -> Optional[WhatsAppInboxChatbotRule]:
        obj = self.db.query(WhatsAppInboxChatbotRule).filter(WhatsAppInboxChatbotRule.id == obj_id).first()
        if obj:
            for k, v in kwargs.items():
                setattr(obj, k, v)
            self.db.commit()
            self.db.refresh(obj)
        return obj

    def delete(self, obj_id: int) -> None:
        obj = self.db.query(WhatsAppInboxChatbotRule).filter(WhatsAppInboxChatbotRule.id == obj_id).first()
        if obj:
            self.db.delete(obj)
            self.db.commit()

    def match(self, rules: list[WhatsAppInboxChatbotRule], text: str) -> Optional[WhatsAppInboxChatbotRule]:
        """Return first matching rule for incoming text."""
        lower = text.lower().strip()
        for rule in rules:
            kw = rule.keyword.lower().strip()
            if rule.match_exact:
                if lower == kw:
                    return rule
            else:
                if kw in lower:
                    return rule
        return None

class CannedResponseService:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[WhatsAppInboxCannedResponse]:
        return (
            self.db.query(WhatsAppInboxCannedResponse)
            .order_by(WhatsAppInboxCannedResponse.shortcut)
            .all()
        )

    def search(self, q: str) -> list[WhatsAppInboxCannedResponse]:
        return (
            self.db.query(WhatsAppInboxCannedResponse)
            .filter(WhatsAppInboxCannedResponse.shortcut.ilike(f"%{q}%"))
            .order_by(WhatsAppInboxCannedResponse.shortcut)
            .limit(10)
            .all()
        )

    def create(self, **kwargs) -> WhatsAppInboxCannedResponse:
        obj = WhatsAppInboxCannedResponse(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj_id: int, **kwargs) -> Optional[WhatsAppInboxCannedResponse]:
        obj = self.db.query(WhatsAppInboxCannedResponse).filter(WhatsAppInboxCannedResponse.id == obj_id).first()
        if obj:
            for k, v in kwargs.items():
                setattr(obj, k, v)
            self.db.commit()
            self.db.refresh(obj)
        return obj

    def delete(self, obj_id: int) -> None:
        obj = self.db.query(WhatsAppInboxCannedResponse).filter(WhatsAppInboxCannedResponse.id == obj_id).first()
        if obj:
            self.db.delete(obj)
            self.db.commit()

class ScheduledMessageService:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> list[WhatsAppInboxScheduledMessage]:
        return (
            self.db.query(WhatsAppInboxScheduledMessage)
            .order_by(WhatsAppInboxScheduledMessage.scheduled_at)
            .all()
        )

    def create(self, **kwargs) -> WhatsAppInboxScheduledMessage:
        obj = WhatsAppInboxScheduledMessage(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def cancel(self, obj_id: int) -> Optional[WhatsAppInboxScheduledMessage]:
        obj = self.db.query(WhatsAppInboxScheduledMessage).filter(WhatsAppInboxScheduledMessage.id == obj_id).first()
        if obj and obj.status == "PENDING":
            obj.status = "CANCELLED"
            self.db.commit()
            self.db.refresh(obj)
        return obj
