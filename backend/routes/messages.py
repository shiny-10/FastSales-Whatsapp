from datetime import datetime
from typing import List, Optional
import httpx

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, status, Body
from sqlalchemy.orm import Session

from core.database import SessionLocal
from core.config import settings as cfg
from models.postgres_model import (
    WhatsAppInboxConversation,
    WhatsAppInboxMessage,
    WhatsAppInboxMediaFile,
    WhatsAppAccount,
)
from routes.deps import get_current_user
from schemas.whatsapp_inbox import (
    MessageType,
    SendMessageRequest,
    SendTextMessageRequest,
    SendMediaMessageRequest,
    SendTemplateMessageRequest,
    ReactionResponse,
)
from services.message_service import MessageService
from services.whatsapp_service import WhatsAppService
from services.reaction_service import ReactionService
from services.media_service import MediaService
import services.socket_service as socket_svc

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
def create_message(
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        req = SendMessageRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    wa_service = WhatsAppService(db)
    account = wa_service.get_account()
    if not account or not account.access_token or not account.phone_number_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WhatsApp account is not connected. Go to Settings to connect.",
        )

    agent_id = user.get("id", 1)
    svc = MessageService(db)
    try:
        if req.message_type == MessageType.TEXT:
            text_req = SendTextMessageRequest(
                conversation_id=req.conversation_id,
                content=req.content or "",
                reply_to_message_id=req.reply_to_message_id,
            )
            message = svc.send_text_message(
                text_req,
                agent_id=agent_id,
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
                message = svc.send_image_message(media_req, agent_id=agent_id, phone_number_id=account.phone_number_id, access_token=account.access_token)
            elif req.message_type == MessageType.VIDEO:
                message = svc.send_video_message(media_req, agent_id=agent_id, phone_number_id=account.phone_number_id, access_token=account.access_token)
            elif req.message_type == MessageType.AUDIO:
                message = svc.send_audio_message(media_req, agent_id=agent_id, phone_number_id=account.phone_number_id, access_token=account.access_token)
            else:
                message = svc.send_document_message(media_req, agent_id=agent_id, phone_number_id=account.phone_number_id, access_token=account.access_token)
        elif req.message_type == MessageType.TEMPLATE:
            template_req = SendTemplateMessageRequest(
                conversation_id=req.conversation_id,
                template_name=req.template_name or "",
                language_code=req.language_code or "en_US",
                components=req.components,
            )
            message = svc.send_template_message(template_req, agent_id=agent_id, phone_number_id=account.phone_number_id, access_token=account.access_token)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported message type")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))

    return _msg_response(message)


@router.post("/send/media-upload")
async def send_media_upload(
    request: Request,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    form = await request.form()
    file: UploadFile = form.get("file")  # type: ignore
    conversation_id = int(form.get("conversation_id", 0))
    message_type = (form.get("message_type") or "DOCUMENT").upper()
    caption = form.get("caption") or None

    if not file or not conversation_id:
        raise HTTPException(status_code=400, detail="file and conversation_id are required")

    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    wa = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first() or db.query(WhatsAppAccount).first()
    if not wa or not wa.access_token or not wa.phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp account not connected")

    file_bytes = await file.read()
    mime_type = file.content_type or "application/octet-stream"
    filename = file.filename or "upload"

    base = cfg.META_BASE_URL.rstrip("/")
    version = cfg.META_API_VERSION

    # Step 1: Upload media to Meta
    upload_url = f"{base}/{version}/{wa.phone_number_id}/media"
    headers = {"Authorization": f"Bearer {wa.access_token}"}

    with httpx.Client(timeout=60.0) as client:
        upload_resp = client.post(
            upload_url,
            headers=headers,
            files={"file": (filename, file_bytes, mime_type)},
            data={"messaging_product": "whatsapp"},
        )
        upload_resp.raise_for_status()
        meta_media_id = upload_resp.json().get("id")

    if not meta_media_id:
        raise HTTPException(status_code=502, detail="Media upload to Meta failed")

    # Optional: resolve the Meta media download URL so the UI can display media immediately.
    media_url = ""
    try:
        svc = MediaService(db)
        media_url = svc.get_meta_media_url(meta_media_id, wa.access_token)
    except Exception:
        media_url = ""

    # Step 2: Send message via Meta
    type_key = message_type.lower()
    media_payload: dict = {"id": meta_media_id}
    if caption and type_key in ("image", "video", "document"):
        media_payload["caption"] = caption
    if type_key == "document":
        media_payload["filename"] = filename

    send_url = f"{base}/{version}/{wa.phone_number_id}/messages"
    send_payload = {
        "messaging_product": "whatsapp",
        "to": conv.customer_phone.replace("+", "").replace(" ", "").replace("-", ""),
        "type": type_key,
        type_key: media_payload,
    }

    with httpx.Client(timeout=30.0) as client:
        send_resp = client.post(
            send_url,
            json=send_payload,
            headers={**headers, "Content-Type": "application/json"},
        )
        send_resp.raise_for_status()
        meta_msg_id = send_resp.json().get("messages", [{}])[0].get("id")

    # Step 3: Save to DB
    agent_id = user.get("id", 1)
    msg = WhatsAppInboxMessage(
        conversation_id=conversation_id,
        meta_message_id=meta_msg_id,
        sender_type="AGENT",
        sender_id=agent_id,
        message_type=message_type,
        content=None,
        caption=caption,
        status="SENT",
    )
    db.add(msg)
    db.flush()

    media_file = WhatsAppInboxMediaFile(
        message_id=msg.id,
        media_id=meta_media_id,
        file_name=filename,
        file_url=media_url,
        mime_type=mime_type,
        file_size=len(file_bytes),
    )
    db.add(media_file)

    conv.last_message_at = datetime.utcnow()
    conv.status = "PENDING"
    db.commit()
    db.refresh(msg)

    socket_svc.emit_new_message(conv.id, {
        "id": str(msg.id),
        "conversation_id": str(conv.id),
        "meta_message_id": meta_msg_id,
        "sender_type": "AGENT",
        "sender_id": str(agent_id),
        "message_type": message_type,
        "content": caption,
        "caption": caption,
        "status": "SENT",
        "is_deleted": False,
        "reply_to_message_id": None,
        "media_files": [{
            "id": str(media_file.id),
            "media_id": meta_media_id,
            "file_name": filename,
            "file_url": media_url,
            "mime_type": mime_type,
            "file_size": len(file_bytes),
        }],
        "reactions": [],
        "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
    })

    return {
        "id": str(msg.id),
        "conversation_id": str(conv.id),
        "meta_message_id": meta_msg_id,
        "sender_type": "AGENT",
        "sender_id": str(agent_id),
        "message_type": message_type,
        "content": caption,
        "caption": caption,
        "status": "SENT",
        "is_deleted": False,
        "reply_to_message_id": None,
        "media_files": [{
            "id": str(media_file.id),
            "media_id": meta_media_id,
            "file_name": filename,
            "file_url": media_url,
            "mime_type": mime_type,
            "file_size": len(file_bytes),
        }],
        "reactions": [],
        "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
    }


@router.delete("/{message_id}", response_model=dict)
def delete_message(
    message_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    msg = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    msg.is_deleted = True
    msg.content = None
    msg.caption = None
    db.commit()

    socket_svc.emit_message_deleted(msg.conversation_id, msg.id)
    return {"id": str(message_id), "deleted": True}


@router.delete("", response_model=dict)
def delete_messages_bulk(
    ids: List[int] = Body(..., embed=True),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No message ids provided")

    msgs = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id.in_(ids)).all()
    if not msgs:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Messages not found")

    for m in msgs:
        m.is_deleted = True
        m.content = None
        m.caption = None
        socket_svc.emit_message_deleted(m.conversation_id, m.id)

    db.commit()
    return {"deleted": len(ids), "ids": [str(i) for i in ids]}


@router.post("/location", response_model=dict)
def send_location(
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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

    wa = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first() or db.query(WhatsAppAccount).first()
    if not wa or not wa.access_token or not wa.phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp account not connected")

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

    agent_id = user.get("id", 1)
    content = f"📍 {name or ''} ({latitude}, {longitude})"
    msg = WhatsAppInboxMessage(
        conversation_id=conversation_id,
        meta_message_id=meta_msg_id,
        sender_type="AGENT",
        sender_id=agent_id,
        message_type="LOCATION",
        content=content,
        status="SENT",
    )
    db.add(msg)
    conv.last_message_at = datetime.utcnow()
    conv.status = "PENDING"
    db.commit()
    db.refresh(msg)

    socket_svc.emit_new_message(conv.id, _msg_response(msg))
    return _msg_response(msg)


@router.post("/{message_id}/reactions")
def add_reaction(
    message_id: int,
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    emoji = payload.get("emoji", "")
    customer_phone = payload.get("customer_phone") or "agent"

    svc = ReactionService(db)
    reaction = svc.handle_reaction_by_message_id(
        message_id=message_id,
        emoji=emoji,
        customer_phone=str(customer_phone),
    )
    if reaction is None:
        return {"id": None, "message_id": message_id, "emoji": "", "customer_phone": customer_phone, "created_at": None}
    return ReactionResponse.model_validate(reaction).model_dump(mode="json")


@router.get("/{message_id}/reactions")
def get_reactions(
    message_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReactionService(db)
    result = svc.get_reactions_for_message(message_id)
    return result.model_dump(mode="json")


@router.get("/media/{media_file_id}/signed-url")
def get_signed_media_url(
    media_file_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    mf = db.query(WhatsAppInboxMediaFile).filter(
        WhatsAppInboxMediaFile.id == media_file_id
    ).first()
    if not mf:
        raise HTTPException(status_code=404, detail="Media file not found")

    if mf.file_url and mf.file_url.startswith("http"):
        return {"signed_url": mf.file_url, "expires_in": 86400}

    if mf.media_id:
        try:
            wa = db.query(WhatsAppAccount).filter(WhatsAppAccount.status == "ACTIVE").first() or db.query(WhatsAppAccount).first()
            if wa and wa.access_token:
                base = cfg.META_BASE_URL.rstrip("/")
                version = cfg.META_API_VERSION
                headers = {"Authorization": f"Bearer {wa.access_token}"}

                r = httpx.get(
                    f"{base}/{version}/{mf.media_id}",
                    headers=headers,
                    timeout=10,
                )
                if r.status_code == 200:
                    cdn_url = r.json().get("url")
                    if cdn_url:
                        mf.file_url = cdn_url
                        db.commit()
                        return {"signed_url": cdn_url, "expires_in": 300}
        except Exception:
            pass

    raise HTTPException(status_code=404, detail="Media file has no accessible URL.")
