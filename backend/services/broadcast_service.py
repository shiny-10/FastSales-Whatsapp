from __future__ import annotations
from typing import Optional
from sqlalchemy.orm import Session
from models.postgres_model import WhatsAppInboxBroadcast
from services.conversation_service import ConversationService
from services.message_service import MessageService
from schemas.whatsapp_inbox import SendTextMessageRequest

class BroadcastService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, organization_id: int, **kwargs) -> WhatsAppInboxBroadcast:
        broadcast = WhatsAppInboxBroadcast(organization_id=organization_id, **kwargs)
        self.db.add(broadcast)
        self.db.commit()
        self.db.refresh(broadcast)
        return broadcast

    def list(self, organization_id: int) -> list[WhatsAppInboxBroadcast]:
        return (
            self.db.query(WhatsAppInboxBroadcast)
            .filter(WhatsAppInboxBroadcast.organization_id == organization_id)
            .order_by(WhatsAppInboxBroadcast.created_at.desc())
            .all()
        )

    def get(self, broadcast_id: int) -> Optional[WhatsAppInboxBroadcast]:
        return self.db.query(WhatsAppInboxBroadcast).filter(WhatsAppInboxBroadcast.id == broadcast_id).first()

    def update(self, broadcast_id: int, **kwargs) -> Optional[WhatsAppInboxBroadcast]:
        broadcast = self.get(broadcast_id)
        if broadcast:
            for k, v in kwargs.items():
                setattr(broadcast, k, v)
            self.db.commit()
            self.db.refresh(broadcast)
        return broadcast

    def delete(self, broadcast_id: int) -> None:
        broadcast = self.get(broadcast_id)
        if broadcast:
            self.db.delete(broadcast)
            self.db.commit()

    def send_now(
        self,
        broadcast: WhatsAppInboxBroadcast,
        phone_number_id: str,
        access_token: str,
    ) -> WhatsAppInboxBroadcast:
        """Send broadcast to all recipients immediately."""
        self.update(broadcast.id, status="SENDING")

        msg_svc = MessageService(self.db)
        conv_svc = ConversationService(self.db)
        sent = 0
        failed = 0

        for phone in broadcast.recipients:
            try:
                conv, _ = conv_svc.get_or_create(
                    organization_id=broadcast.organization_id,
                    customer_phone=phone,
                    whatsapp_account_id=None,
                )
                req = SendTextMessageRequest(
                    conversation_id=conv.id,
                    content=broadcast.message,
                )
                system_agent_id = 0
                msg_svc.send_text_message(req, system_agent_id, phone_number_id, access_token)
                sent += 1
            except Exception:
                failed += 1

        return self.update(
            broadcast.id,
            status="DONE",
            sent_count=sent,
            failed_count=failed,
        )
