from __future__ import annotations
from datetime import datetime
from core.database import SessionLocal
from models.postgres_model import WhatsAppInboxScheduledMessage, WhatsAppAccount
from services.message_service import MessageService
from schemas.whatsapp_inbox import (
    SendTextMessageRequest,
    SendTemplateMessageRequest,
    MessageResponse,
)
import services.socket_service as socket_svc


def process_due_messages() -> None:
    """Invoked by the BackgroundScheduler every 30s. Sends any PENDING
    scheduled messages whose scheduled_at has passed."""
    now = datetime.utcnow()
    db = SessionLocal()
    try:
        # Use row-level locking to avoid multiple workers processing the same
        # scheduled message concurrently. `SKIP LOCKED` ensures that rows
        # already claimed by another transaction are not returned.
        due_query = (
            db.query(WhatsAppInboxScheduledMessage)
            .filter(
                WhatsAppInboxScheduledMessage.status == "PENDING",
                WhatsAppInboxScheduledMessage.scheduled_at <= now,
            )
            .with_for_update(skip_locked=True)
        )

        due = due_query.all()
        if not due:
            return

        print(f"[scheduler] {len(due)} message(s) due at {now.isoformat()}")

        for msg in due:
            try:
                wa = (
                    db.query(WhatsAppAccount)
                    .filter(WhatsAppAccount.status == "ACTIVE")
                    .first()
                ) or db.query(WhatsAppAccount).first()

                if not wa or not wa.access_token or not wa.phone_number_id:
                    raise ValueError(
                        "No active WhatsApp account configured"
                    )

                svc = MessageService(db)
                message_type = (msg.message_type or "TEXT").upper()

                if message_type == "TEMPLATE" and msg.template_name:
                    req = SendTemplateMessageRequest(
                        conversation_id=msg.conversation_id,
                        template_name=msg.template_name,
                        language_code="en_US",
                        components=getattr(msg, "components", None),
                    )
                    reply = svc.send_template_message(
                        req,
                        agent_id=0,
                        phone_number_id=wa.phone_number_id,
                        access_token=wa.access_token,
                    )
                else:
                    req = SendTextMessageRequest(
                        conversation_id=msg.conversation_id,
                        content=msg.content or "",
                    )
                    reply = svc.send_text_message(
                        req,
                        agent_id=0,
                        phone_number_id=wa.phone_number_id,
                        access_token=wa.access_token,
                    )

                socket_svc.emit_new_message(
                    msg.conversation_id,
                    MessageResponse.model_validate(reply),
                )

                msg.status = "SENT"
                db.commit()
                print(
                    f"[scheduler] ✓ Sent scheduled msg id={msg.id} "
                    f"conv={msg.conversation_id} type={message_type}"
                )
            except Exception as exc:
                try:
                    msg.status = "FAILED"
                    db.commit()
                except Exception:
                    db.rollback()
                print(
                    f"[scheduler] ✗ Failed scheduled msg id={msg.id}: {exc}"
                )

        # Don't commit the entire batch at once. Individual message commits help avoid duplicate retries

    except Exception as exc:
        print(f"[scheduler] Error in process_due_messages: {exc}")
        db.rollback()
    finally:
        db.close()
