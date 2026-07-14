from __future__ import annotations
from datetime import datetime
from core.database import SessionLocal
from models.postgres_model import WhatsAppInboxScheduledMessage, WhatsAppAccount
from services.message_service import MessageService
from schemas.whatsapp_inbox import SendTextMessageRequest, MessageResponse
import services.socket_service as socket_svc

def process_due_messages() -> None:
    """Invoked by the BackgroundScheduler every 60s."""
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        due = (
            db.query(WhatsAppInboxScheduledMessage)
            .filter(
                WhatsAppInboxScheduledMessage.status == "PENDING",
                WhatsAppInboxScheduledMessage.scheduled_at <= now,
            )
            .all()
        )
        if not due:
            return

        for msg in due:
            try:
                wa = db.query(WhatsAppAccount).filter(WhatsAppAccount.organization_id == msg.organization_id).first()
                if not wa:
                    raise ValueError(f"No WhatsApp account for organization {msg.organization_id}")

                svc = MessageService(db)
                req = SendTextMessageRequest(conversation_id=msg.conversation_id, content=msg.content or "")
                system_agent_id = 0
                reply = svc.send_text_message(req, system_agent_id, wa.phone_number_id, wa.access_token)

                socket_svc.emit_new_message(
                    msg.organization_id,
                    msg.conversation_id,
                    MessageResponse.model_validate(reply),
                )
                msg.status = "SENT"
            except Exception:
                msg.status = "FAILED"
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()
