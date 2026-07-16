from core.config import settings
from fastapi import APIRouter
from fastapi import Body, Request
from pydantic import BaseModel
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService
from fastapi import HTTPException
from schemas.whatsapp_inbox import WhatsAppConnectRequest

from core.database import SessionLocal
from models.postgres_model import Contact, Conversation, ConversationMessage, MessageLog
from datetime import datetime
import asyncio
from services.websocket_manager import manager

router = APIRouter()

class MessageRequest(BaseModel):
    to: str
    template_name: str

meta_access_token = settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN
meta_phone_number_id = settings.META_WHATSAPP_PHONE_NUMBER_ID or settings.PHONE_NUMBER_ID
meta_service = MetaWhatsAppService(
    meta_access_token,
    meta_phone_number_id,
)

@router.post("/send")
def send_message(data: MessageRequest, request: Request):
    db = SessionLocal()
    if not meta_access_token or not meta_phone_number_id:
        return {
            "success": False,
            "error": "WhatsApp send credentials are not configured. Set META_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID.",
        }
    try:
        result = meta_service.send_template_message(
            data.to,
            data.template_name,
        )

        if isinstance(result, dict) and result.get("success") is False:
            return {
                "success": False,
                "error": result.get("error", "WhatsApp send failed"),
                "meta_response": result,
            }

        # Record in MessageLog
        # Determine org from header if provided, else fallback to 1
        try:
            org_header = request.headers.get('X-Organization-Id')
            org_id = int(org_header) if org_header else 1
        except Exception:
            org_id = 1

        msg_log = MessageLog(
            message_id=(result.get('id') if isinstance(result, dict) else None),
            phone_number=data.to,
            text=data.template_name,
            direction="outgoing",
            status="sent",
            organization_id=org_id,
        )
        db.add(msg_log)
        db.commit()
        db.refresh(msg_log)

        # Try to find contact by phone
        contact = db.query(Contact).filter(Contact.phone_number == data.to).first()
        contact_id = contact.id if contact else None

        # Find or create conversation
        conv = None
        if contact_id:
            conv = db.query(Conversation).filter(Conversation.contact_id == contact_id).first()
        if not conv:
            conv = db.query(Conversation).filter(Conversation.customer_phone == data.to).first()
        if not conv:
            conv = Conversation(
                contact_id=contact_id,
                customer_phone=data.to,
                customer_name=(contact.name if contact else None),
                status="OPEN",
                organization_id=org_id,
                last_message_at=datetime.utcnow(),
            )
            db.add(conv)
            db.commit()
            db.refresh(conv)
        else:
            conv.last_message_at = datetime.utcnow()
            db.commit()

        # Add conversation message
        conv_msg = ConversationMessage(
            conversation_id=conv.id,
            message_log_id=msg_log.id,
            direction="outgoing",
            message_type="template",
            text=data.template_name,
            provider_message_id=(result.get('id') if isinstance(result, dict) else None),
        )
        db.add(conv_msg)
        db.commit()
        db.refresh(conv_msg)

        # Broadcast new message to org clients
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(manager.broadcast_to_org(str(org_id), {
                "type": "new_message",
                "conversation_id": conv.id,
                "message": {
                    "id": conv_msg.id,
                    "text": conv_msg.text,
                    "direction": conv_msg.direction,
                    "created_at": conv_msg.created_at.isoformat() + "Z" if conv_msg.created_at else None,
                }
            }))
        except Exception:
            pass

        return {
            "success": True,
            "meta_response": result,
            "conversation_id": conv.id,
            "message_id": conv_msg.id,
        }
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()

@router.get("/info")
def get_whatsapp_info():
    result = meta_service.get_phone_number_info()
    if result.get("success") is False:
        return {
            "success": False,
            "error": result.get("error", "Failed to fetch WhatsApp info")
        }

    return {
        "success": True,
        "phone_number": result.get("display_phone_number"),
        "phone_number_id": meta_service.phone_number_id
    }

@router.get("/settings")
def get_whatsapp_settings():
    # log incoming request info for debugging
    print("GET /api/whatsapp/settings called")
    # Build default settings and merge persisted values from DB if any
    from core.database import SessionLocal
    from models.postgres_model import WhatsAppSettings

    settings = _build_settings()
    db = None
    try:
        db = SessionLocal()
        record = db.query(WhatsAppSettings).first()
        if record:
            p = record.to_dict()
            for k, v in p.items():
                if v is not None and k in settings:
                    settings[k] = v
    except Exception as e:
        # Log DB error but return default settings so UI can still load
        print("Warning: failed to read whatsapp_settings from DB:", e)
    finally:
        if db:
            db.close()

    return {"success": True, "settings": settings}

def _build_settings():
    # Aggregate WhatsApp configuration and stats for frontend settings view
    result = meta_service.get_phone_number_info()

    # compute message usage in last 24 hours
    from core.database import SessionLocal
    from models.postgres_model import MessageLog
    from datetime import datetime, timedelta

    db = SessionLocal()
    try:
        since = datetime.utcnow() - timedelta(hours=24)
        used = db.query(MessageLog).filter(MessageLog.created_at >= since).count()
    except Exception:
        used = 0
    finally:
        db.close()

    settings = {
        "waba_id": meta_service.phone_number_id or "",
        "waba_name": "FastSales CRM",
        "phone_display_name": result.get("display_phone_number") if isinstance(result, dict) else "",
        "phone_number": result.get("display_phone_number") if isinstance(result, dict) else "",
        "phone_quality": "High Quality",
        "status": "Connected" if not result.get("success") is False else "Disconnected",
        "meta_business_account_id": "",
        "business_account_name": "FastSales Technologies",
        "connected_by": "admin@fastsales.com",
        "connected_on": "12 Jun 2026, 10:15 AM",
        "access_token_masked": "************",
        "token_expires_on": "26 Jun 2026, 10:15 AM",
        "current_limit_24h": 1000,
        "used_in_24h": used,
        "webhook_url": "https://your-domain.com/webhook/whatsapp",
        "webhook_token": "fastsales_webhook_token_123",
        "webhook_status": "Active",
        "last_ping": "29 Jun 2026, 10:22 AM",
        "subscribed_events": ["messages", "message_status", "delivery", "read", "account_alerts"],
    }

    return settings

@router.put("/settings")
def update_whatsapp_settings(payload: dict = Body(...)):
    print("PUT /api/whatsapp/settings called with payload keys:", list(payload.keys()))
    # Persist partial updates to the whatsapp_settings table
    from core.database import SessionLocal
    from models.postgres_model import WhatsAppSettings
    db = SessionLocal()
    try:
        record = db.query(WhatsAppSettings).first()
        if not record:
            record = WhatsAppSettings()
            db.add(record)

        # Only update known fields
        for k, v in payload.items():
            if hasattr(record, k):
                setattr(record, k, v)

        db.commit()
        db.refresh(record)
        # Build merged settings to return
        base = _build_settings()
        p = record.to_dict()
        for k, v in p.items():
            if v is not None and k in base:
                base[k] = v

        return {"success": True, "settings": base}
    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()

@router.post("/actions/rotate-token")
def rotate_token():
    # Placeholder - rotation requires administrative steps
    return {"success": True, "message": "Token rotated (placeholder)"}

@router.post("/actions/disconnect")
def disconnect_account():
    # Placeholder for disconnecting Meta account
    return {"success": True, "message": "Disconnected (placeholder)"}

@router.get("/activity-logs")
def get_activity_logs(limit: int = 25):
    from core.database import SessionLocal
    from models.postgres_model import MessageLog

    db = SessionLocal()
    try:
        logs = db.query(MessageLog).order_by(MessageLog.created_at.desc()).limit(limit).all()
        result = []
        for l in logs:
            result.append({
                "id": l.id,
                "phone_number": l.phone_number,
                "message": l.text,
                "status": l.status,
                "direction": l.direction,
                "time": l.created_at.isoformat() + "Z" if l.created_at else None,
            })
    finally:
        db.close()

    return {"success": True, "logs": result}


# --- Account management endpoints for frontend hooks ---
@router.post("/connect")
def connect_whatsapp(payload: WhatsAppConnectRequest, request: Request):
    db = SessionLocal()
    try:
        svc = WhatsAppService(db)
        # organization id may come from header or default to 1
        try:
            org_id = int(request.headers.get("X-Organization-Id") or 1)
        except Exception:
            org_id = 1

        account = svc.connect(org_id, payload)
        return {"success": True, "account": {
            "id": account.id,
            "organization_id": account.organization_id,
            "waba_id": account.waba_id,
            "phone_number_id": account.phone_number_id,
            "display_phone_number": account.display_phone_number,
            "verified_name": account.verified_name,
            "status": account.status,
        }}
    except HTTPException as e:
        return {"success": False, "error": str(e.detail)}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()


@router.get("/account")
def get_account(request: Request):
    db = SessionLocal()
    try:
        try:
            org_id = int(request.headers.get("X-Organization-Id") or 1)
        except Exception:
            org_id = 1

        svc = WhatsAppService(db)
        account = svc.get_account(org_id)
        if not account:
            return {"connected": False, "account": None, "message": "No WhatsApp account connected"}

        return {"connected": True, "account": {
            "id": account.id,
            "organization_id": account.organization_id,
            "waba_id": account.waba_id,
            "phone_number_id": account.phone_number_id,
            "display_phone_number": account.display_phone_number,
            "verified_name": account.verified_name,
            "status": account.status,
        }, "message": "Account connected"}
    except Exception as e:
        return {"connected": False, "account": None, "message": str(e)}
    finally:
        db.close()


@router.delete("/disconnect")
def disconnect_account(request: Request):
    db = SessionLocal()
    try:
        try:
            org_id = int(request.headers.get("X-Organization-Id") or 1)
        except Exception:
            org_id = 1

        svc = WhatsAppService(db)
        svc.disconnect(org_id)
        return {"success": True, "message": "Disconnected"}
    except HTTPException as e:
        return {"success": False, "error": str(e.detail)}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()

