from fastapi import APIRouter, Request
from core.database import SessionLocal
from models.postgres_model import CampaignRecipient, MessageLog
from fastapi.responses import PlainTextResponse
import asyncio

# Services for inbox handling
from services.conversation_service import ConversationService
from services.message_service import MessageRepository
from services.websocket_manager import manager

router = APIRouter()

@router.get("/webhook")
async def verify_webhook(request: Request):
    from core.config import settings

    params = request.query_params
    # Meta sends dotted query params: hub.mode, hub.verify_token, hub.challenge
    hub_mode = params.get("hub.mode") or params.get("hub_mode")
    hub_verify_token = params.get("hub.verify_token") or params.get("hub_verify_token")
    hub_challenge = params.get("hub.challenge") or params.get("hub_challenge")

    VERIFY_TOKEN = settings.META_VERIFY_TOKEN or "fastsales123"

    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge or "")

    return PlainTextResponse("Verification failed", status_code=400)

@router.post("/webhook")
async def webhook(request: Request):
    db = SessionLocal()
    try:
          # Log headers for debugging webhook delivery
          try:
              print('WEBHOOK HEADERS:', dict(request.headers))
          except Exception:
              pass

          data = await request.json()
    except Exception:
        db.close()
        return {
          "success": False,
          "message": "Invalid JSON payload"
       } 

    try:
        value = data["entry"][0]["changes"][0]["value"]

        # -----------------------------
        # 1. STATUS UPDATES (delivered/read/failed)
        # -----------------------------
        if "statuses" in value:
            status_data = value["statuses"][0]

            message_id = status_data.get("id")
            status = status_data.get("status")

            print("📩 STATUS UPDATE:", message_id, status)

            # Update message_logs table
            msg = db.query(MessageLog).filter(
                MessageLog.message_id == message_id
            ).first()

            if msg:
                msg.status = status

            # Update campaign_recipient table
            rec = db.query(CampaignRecipient).filter(
                CampaignRecipient.message_id == message_id
            ).first()

            if rec:
                rec.status = status

        # -----------------------------
        # 2. INCOMING MESSAGES (customer replies)
        # -----------------------------
        if "messages" in value:
            msg_data = value["messages"][0]
            from_phone = msg_data.get("from")
            text_body = msg_data.get("text", {}).get("body")

            # Record generic message log for backward compatibility
            new_msg = MessageLog(
                message_id=msg_data.get("id"),
                phone_number=from_phone,
                text=text_body,
                direction="incoming",
                status="received",
                organization_id=1,
            )
            db.add(new_msg)
            db.commit()

            # Upsert inbox conversation and message using inbox services
            try:
                conv_svc = ConversationService(db)
                conv, created = conv_svc.get_or_create(1, from_phone, None, None)

                # create inbox message record
                msg_repo = MessageRepository(db)
                inbox_msg = msg_repo.create(
                    conversation_id=conv.id,
                    meta_message_id=msg_data.get("id"),
                    sender_type="CUSTOMER",
                    sender_id=None,
                    message_type="TEXT",
                    content=text_body,
                    status="RECEIVED",
                )

                # update conversation last_message_at and unread count
                conv.last_message_at = inbox_msg.created_at
                conv.unread_count = (conv.unread_count or 0) + 1
                db.commit()

                # Broadcast to org clients
                try:
                    loop = asyncio.get_event_loop()
                    loop.create_task(manager.broadcast_to_org(str(conv.organization_id or 1), {
                        "type": "new_message",
                        "conversation_id": conv.id,
                        "message": {
                            "id": inbox_msg.id,
                            "text": inbox_msg.content,
                            "direction": "incoming",
                            "created_at": inbox_msg.created_at.isoformat() if inbox_msg.created_at else None,
                        }
                    }))
                except Exception:
                    pass
            except Exception as e:
                print("Error processing inbox message:", e)

    except Exception as e:
        print("Webhook error:", str(e))
        db.rollback()

    finally:
        db.close()

    return {"status": "ok"}