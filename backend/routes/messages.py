from fastapi import APIRouter, Depends, HTTPException, Request, status, Body
from sqlalchemy.orm import Session
from typing import List

from core.database import SessionLocal
from services.message_service import MessageService
from services.whatsapp_service import WhatsAppService
from schemas.whatsapp_inbox import (
    MessageType,
    SendMessageRequest,
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
)

router = APIRouter(prefix="/inbox/messages", tags=["Inbox Messages"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _msg_response(message) -> dict:
    return {
        "id": str(message.id),
        "conversation_id": str(message.conversation_id),
        "meta_message_id": message.meta_message_id,
        "sender_type": message.sender_type,
        "sender_id": str(message.sender_id) if message.sender_id else None,
        "message_type": message.message_type,
        "content": message.content,
        "caption": message.caption if hasattr(message, "caption") else None,
        "status": message.status,
        "is_deleted": bool(message.is_deleted) if hasattr(message, "is_deleted") else False,
        "reply_to_message_id": str(message.reply_to_message_id) if message.reply_to_message_id else None,
        "media_files": [],
        "reactions": [],
        "created_at": message.created_at.isoformat() + "Z" if message.created_at else None,
    }


@router.post("", response_model=dict)
def create_message(request: Request, payload: dict, db: Session = Depends(get_db)):
    try:
        req = SendMessageRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    org_id = 1
    header_org = request.headers.get("x-organization-id")
    if header_org:
        try:
            org_id = int(header_org)
        except ValueError:
            pass

    wa_service = WhatsAppService(db)
    account = wa_service.get_account(org_id)
    if not account or not account.access_token or not account.phone_number_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp account is not connected. Go to Settings to connect."
        )

    svc = MessageService(db)
    try:
        if req.message_type == MessageType.TEXT:
            text_req = SendTextMessageRequest(
                conversation_id=req.conversation_id,
                content=req.content or "",
                reply_to_message_id=req.reply_to_message_id,
            )
            message = svc.send_text_message(
                text_req, agent_id=1,
                phone_number_id=account.phone_number_id,
                access_token=account.access_token,
            )
        elif req.message_type in (MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT):
            media_req = SendMediaMessageRequest(
                conversation_id=req.conversation_id,
                message_type=req.message_type,
                media_url=req.media_url,
                media_id=req.media_id,
                caption=req.caption,
                file_name=req.file_name,
                reply_to_message_id=req.reply_to_message_id,
            )
            if req.message_type == MessageType.IMAGE:
                message = svc.send_image_message(media_req, agent_id=1, phone_number_id=account.phone_number_id, access_token=account.access_token)
            elif req.message_type == MessageType.VIDEO:
                message = svc.send_video_message(media_req, agent_id=1, phone_number_id=account.phone_number_id, access_token=account.access_token)
            elif req.message_type == MessageType.AUDIO:
                message = svc.send_audio_message(media_req, agent_id=1, phone_number_id=account.phone_number_id, access_token=account.access_token)
            else:
                message = svc.send_document_message(media_req, agent_id=1, phone_number_id=account.phone_number_id, access_token=account.access_token)
        elif req.message_type == MessageType.TEMPLATE:
            template_req = SendTemplateMessageRequest(
                conversation_id=req.conversation_id,
                template_name=req.template_name or "",
                language_code=req.language_code or "en_US",
                components=req.components,
            )
            message = svc.send_template_message(template_req, agent_id=1, phone_number_id=account.phone_number_id, access_token=account.access_token)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported message type")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return _msg_response(message)


@router.delete("/{message_id}", response_model=dict)
def delete_message(message_id: int, db: Session = Depends(get_db)):
    from models.postgres_model import WhatsAppInboxMessage, WhatsAppInboxConversation
    import services.socket_service as socket_svc
    msg = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    # Soft-delete: mark as deleted, clear content (like real WhatsApp "Delete for everyone")
    msg.is_deleted = True
    msg.content = None
    msg.caption = None
    db.commit()

    # Get org_id to broadcast
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == msg.conversation_id
    ).first()
    if conv:
        socket_svc.emit_message_deleted(conv.organization_id, conv.id, msg.id)

    return {"id": str(message_id), "deleted": True}


@router.delete("", response_model=dict)
def delete_messages_bulk(ids: List[int] = Body(..., embed=True), db: Session = Depends(get_db)):
    from models.postgres_model import WhatsAppInboxMessage, WhatsAppInboxConversation
    import services.socket_service as socket_svc
    if not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No message ids provided")

    msgs = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id.in_(ids)).all()
    if not msgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Messages not found")

    # Group by conversation for socket broadcasts
    conv_msg_map: dict[int, list[int]] = {}
    for m in msgs:
        m.is_deleted = True
        m.content = None
        m.caption = None
        conv_msg_map.setdefault(m.conversation_id, []).append(m.id)

    db.commit()

    # Broadcast each deletion
    for conv_id, msg_ids in conv_msg_map.items():
        conv = db.query(WhatsAppInboxConversation).filter(
            WhatsAppInboxConversation.id == conv_id
        ).first()
        if conv:
            for mid in msg_ids:
                socket_svc.emit_message_deleted(conv.organization_id, conv.id, mid)

    return {"deleted": len(ids), "ids": [str(i) for i in ids]}



# ── Send Location ─────────────────────────────────────────────────────────────
@router.post("/location", response_model=dict)
def send_location(payload: dict, db: Session = Depends(get_db)):
    """
    Send a location pin via WhatsApp.
    Expected: { conversation_id, latitude, longitude, name?, address? }
    """
    import httpx
    from models.postgres_model import WhatsAppInboxConversation, WhatsAppInboxMessage, WhatsAppAccount
    from datetime import datetime

    conversation_id = int(payload.get("conversation_id", 0))
    latitude = payload.get("latitude")
    longitude = payload.get("longitude")
    name = payload.get("name", "")
    address = payload.get("address", "")

    if not conversation_id or latitude is None or longitude is None:
        raise HTTPException(status_code=400, detail="conversation_id, latitude and longitude are required")

    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    wa = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.organization_id == conv.organization_id
    ).first()
    if not wa or not wa.access_token or not wa.phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp account not connected")

    from core.config import settings as cfg
    base = cfg.META_BASE_URL.rstrip("/")
    version = cfg.META_API_VERSION
    send_url = f"{base}/{version}/{wa.phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {wa.access_token}", "Content-Type": "application/json"}

    location_obj: dict = {"latitude": float(latitude), "longitude": float(longitude)}
    if name:
        location_obj["name"] = name
    if address:
        location_obj["address"] = address

    send_payload = {
        "messaging_product": "whatsapp",
        "to": conv.customer_phone.replace("+", "").replace(" ", "").replace("-", ""),
        "type": "location",
        "location": location_obj,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(send_url, json=send_payload, headers=headers)
            resp.raise_for_status()
            meta_msg_id = resp.json().get("messages", [{}])[0].get("id")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Meta API error: {e.response.text}")

    # Save to DB
    content = f"📍 {name or ''} ({latitude}, {longitude})"
    msg = WhatsAppInboxMessage(
        conversation_id=conversation_id,
        meta_message_id=meta_msg_id,
        sender_type="AGENT",
        sender_id=1,
        message_type="LOCATION",
        content=content,
        status="SENT",
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    conv.status = "PENDING"
    db.commit()
    db.refresh(msg)

    import services.socket_service as socket_svc
    from schemas.whatsapp_inbox import MessageResponse
    socket_svc.emit_new_message(conv.organization_id, conv.id, MessageResponse.model_validate(msg))

    return _msg_response(msg)


# ── Send Contact Card (vCard) ─────────────────────────────────────────────────
@router.post("/contact", response_model=dict)
def send_contact(payload: dict, db: Session = Depends(get_db)):
    """
    Send a contact card via WhatsApp.
    Expected: { conversation_id, contact_name, phone_number, email? }
    """
    import httpx
    from models.postgres_model import WhatsAppInboxConversation, WhatsAppInboxMessage, WhatsAppAccount
    from datetime import datetime

    conversation_id = int(payload.get("conversation_id", 0))
    contact_name = payload.get("contact_name", "").strip()
    phone_number = payload.get("phone_number", "").strip()
    email = payload.get("email", "").strip()

    if not conversation_id or not contact_name or not phone_number:
        raise HTTPException(status_code=400, detail="conversation_id, contact_name and phone_number are required")

    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    wa = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.organization_id == conv.organization_id
    ).first()
    if not wa or not wa.access_token or not wa.phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp account not connected")

    from core.config import settings as cfg
    base = cfg.META_BASE_URL.rstrip("/")
    version = cfg.META_API_VERSION
    send_url = f"{base}/{version}/{wa.phone_number_id}/messages"
    headers = {"Authorization": f"Bearer {wa.access_token}", "Content-Type": "application/json"}

    # Build Meta contacts payload
    name_parts = contact_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    contact_obj: dict = {
        "name": {"formatted_name": contact_name, "first_name": first_name, "last_name": last_name},
        "phones": [{"phone": phone_number, "type": "MOBILE"}],
    }
    if email:
        contact_obj["emails"] = [{"email": email, "type": "WORK"}]

    send_payload = {
        "messaging_product": "whatsapp",
        "to": conv.customer_phone.replace("+", "").replace(" ", "").replace("-", ""),
        "type": "contacts",
        "contacts": [contact_obj],
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(send_url, json=send_payload, headers=headers)
            resp.raise_for_status()
            meta_msg_id = resp.json().get("messages", [{}])[0].get("id")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f"Meta API error: {e.response.text}")

    # Save to DB
    content = f"👤 {contact_name} · {phone_number}"
    if email:
        content += f" · {email}"

    msg = WhatsAppInboxMessage(
        conversation_id=conversation_id,
        meta_message_id=meta_msg_id,
        sender_type="AGENT",
        sender_id=1,
        message_type="CONTACTS",
        content=content,
        status="SENT",
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    conv.status = "PENDING"
    db.commit()
    db.refresh(msg)

    import services.socket_service as socket_svc
    from schemas.whatsapp_inbox import MessageResponse
    socket_svc.emit_new_message(conv.organization_id, conv.id, MessageResponse.model_validate(msg))

    return _msg_response(msg)
