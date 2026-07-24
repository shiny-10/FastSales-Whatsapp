from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import Contact, MessageLog, WhatsAppAccount
from routes.deps import get_current_user
from schemas.whatsapp_inbox import WhatsAppConnectRequest
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MessageRequest(BaseModel):
    to: str
    template_name: str


@router.post("/send")
def send_message(
    data: MessageRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first() or db.query(WhatsAppAccount).first()
    if not account or not account.access_token or not account.phone_number_id:
        return {
            "success": False,
            "error": "WhatsApp account is not configured. Go to Settings → Configuration to connect your account.",
        }

    svc = MetaWhatsAppService(account.access_token, account.phone_number_id)

    from models.postgres_model import Template
    tmpl = db.query(Template).filter(Template.template_name == data.template_name).first()
    language_code = (tmpl.language or "en_US") if tmpl else "en_US"

    result = svc.send_template_message(
        data.to,
        data.template_name,
        language_code=language_code,
    )

    if isinstance(result, dict) and result.get("success") is False:
        meta_err = result.get("error")
        if isinstance(meta_err, dict):
            err_msg = (
                meta_err.get("error_user_msg")
                or meta_err.get("message")
                or (meta_err.get("error_data") or {}).get("details")
                or str(meta_err)
            )
        else:
            err_msg = str(meta_err)
        return {
            "success": False,
            "error": err_msg,
            "meta_response": result,
        }

    meta_msg_id = None
    if isinstance(result, dict):
        meta_msg_id = (
            result.get("messages", [{}])[0].get("id")
            if isinstance(result.get("messages"), list)
            else result.get("id")
        )

    msg_log = MessageLog(
        message_id=meta_msg_id,
        phone_number=data.to,
        text=data.template_name,
        direction="outgoing",
        status="sent",
    )
    db.add(msg_log)
    db.commit()
    db.refresh(msg_log)

    # ── Populate WhatsApp Inbox models for live inbox UI ──
    try:
        clean_phone = data.to.replace("+", "").replace(" ", "").replace("-", "").strip()
        from services.conversation_service import ConversationService
        from models.postgres_model import WhatsAppInboxMessage, Contact
        from services import socket_service
        from schemas.whatsapp_inbox import MessageResponse

        contact = db.query(Contact).filter(Contact.phone_number == data.to).first()
        conv_svc = ConversationService(db)
        inbox_conv, _ = conv_svc.get_or_create(
            customer_phone=clean_phone,
            customer_name=contact.name if contact else None,
            whatsapp_account_id=account.id,
        )

        template_body_text = tmpl.template_body if (tmpl and tmpl.template_body) else f"[Template: {data.template_name}]"

        inbox_msg = WhatsAppInboxMessage(
            conversation_id=inbox_conv.id,
            meta_message_id=meta_msg_id,
            sender_type="AGENT",
            message_type="TEMPLATE",
            content=template_body_text,
            status="SENT" if meta_msg_id else "FAILED",
        )
        db.add(inbox_msg)

        inbox_conv.last_message_at = datetime.utcnow()
        inbox_conv.status = "OPEN"
        db.commit()
        db.refresh(inbox_msg)

        try:
            socket_svc.emit_new_message(inbox_conv.id, MessageResponse.model_validate(inbox_msg))
        except Exception as e:
            print(f"[send_message] Socket broadcast warning: {e}")
    except Exception as e:
        print(f"[send_message] Error creating inbox message record: {e}")

    response_payload = {
        "success": True,
        "result": result,
        "message_id": msg_log.id,
    }
    try:
        response_payload["message"] = MessageResponse.model_validate(inbox_msg).model_dump(mode="json")
    except Exception:
        pass

    return response_payload


@router.post("/connect")
def connect_whatsapp(
    payload: WhatsAppConnectRequest,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc = WhatsAppService(db)
        account = svc.connect(payload)
        return {
            "success": True,
            "account": {
                "id": account.id,
                "waba_id": account.waba_id,
                "phone_number_id": account.phone_number_id,
                "display_phone_number": account.display_phone_number,
                "verified_name": account.verified_name,
                "status": account.status,
            },
        }
    except HTTPException as e:
        return {"success": False, "error": str(e.detail)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/account")
def get_account(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc = WhatsAppService(db)
        account = svc.get_account()
        if not account:
            return {"connected": False, "account": None, "message": "No WhatsApp account connected"}

        return {
            "connected": True,
            "account": {
                "id": account.id,
                "waba_id": account.waba_id,
                "phone_number_id": account.phone_number_id,
                "display_phone_number": account.display_phone_number,
                "verified_name": account.verified_name,
                "status": account.status,
            },
            "message": "Account connected",
        }
    except Exception as e:
        return {"connected": False, "account": None, "message": str(e)}


@router.delete("/disconnect")
def disconnect_account(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        svc = WhatsAppService(db)
        svc.disconnect()
        return {"success": True, "message": "Disconnected"}
    except HTTPException as e:
        return {"success": False, "error": str(e.detail)}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/status")
def get_status(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first() or db.query(WhatsAppAccount).first()
    if not account:
        return {"connected": False, "status": "DISCONNECTED"}
    return {
        "connected": account.status == "ACTIVE",
        "status": account.status,
        "phone_number_id": account.phone_number_id,
        "display_phone_number": account.display_phone_number,
    }
