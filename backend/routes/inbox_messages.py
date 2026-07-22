from core.config import settings
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional
from core.database import SessionLocal
from models.postgres_model import Conversation, ConversationMessage, MessageLog
from services.meta_service import MetaWhatsAppService

from routes.deps import get_current_user
import asyncio
from services.websocket_manager import manager

router = APIRouter()

class SendMessageRequest(BaseModel):
    conversation_id: int
    to: str
    message_type: str
    template_name: Optional[str] = None
    text: Optional[str] = None

@router.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: int, limit: int = 50):
    db = SessionLocal()
    try:
        msgs = db.query(ConversationMessage).filter(ConversationMessage.conversation_id == conversation_id).order_by(ConversationMessage.created_at.asc()).limit(limit).all()
        out = []
        for m in msgs:
            out.append({
                "id": m.id,
                "conversation_id": m.conversation_id,
                "direction": m.direction,
                "text": m.text,
                "created_at": m.created_at.isoformat() + "Z" if m.created_at else None,
            })
        return {"success": True, "messages": out}
    finally:
        db.close()

@router.post("/messages/send")
def send_message(payload: SendMessageRequest, user: dict = Depends(get_current_user)):
    # Use MetaWhatsAppService to send template messages; record in MessageLog and ConversationMessage
    db = SessionLocal()
    meta_access_token = settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN
    meta_phone_number_id = settings.META_WHATSAPP_PHONE_NUMBER_ID or settings.PHONE_NUMBER_ID
    if not meta_access_token or not meta_phone_number_id:
        raise HTTPException(status_code=400, detail="WhatsApp send credentials are not configured. Set META_ACCESS_TOKEN and META_WHATSAPP_PHONE_NUMBER_ID.")

    try:
        meta = MetaWhatsAppService(meta_access_token, meta_phone_number_id)
        result = None
        if payload.message_type == "template":
            result = meta.send_template_message(payload.to, payload.template_name)
        elif payload.message_type == "text":
            result = meta.send_text_message(payload.to, payload.text or "")
        else:
            result = {"success": False, "error": "Unknown message type"}

        if isinstance(result, dict) and result.get("success") is False:
            raise HTTPException(status_code=400, detail=result.get("error", "WhatsApp send failed"))

        # Determine organization from conversation if available
        conv = db.query(Conversation).filter(Conversation.id == payload.conversation_id).first()
        org_id = conv.organization_id if conv and conv.organization_id else 1

        # Record in message_logs table
        msg_log = MessageLog(
            message_id=result.get('id') if isinstance(result, dict) else None,
            phone_number=payload.to,
            text=payload.text or payload.template_name,
            direction="outgoing",
            status="sent",
            organization_id=org_id
        )
        db.add(msg_log)
        db.commit()
        db.refresh(msg_log)

        conv_msg = ConversationMessage(
            conversation_id=payload.conversation_id,
            message_log_id=msg_log.id,
            direction="outgoing",
            message_type=payload.message_type,
            text=payload.text or payload.template_name,
            provider_message_id=result.get('id') if isinstance(result, dict) else None,
        )
        db.add(conv_msg)
        db.commit()
        db.refresh(conv_msg)

        # Broadcast new message to org
        try:
            loop = asyncio.get_event_loop()
            loop.create_task(manager.broadcast_to_org(str(org_id), {
                "type": "new_message",
                "conversation_id": payload.conversation_id,
                "message": {
                    "id": conv_msg.id,
                    "text": conv_msg.text,
                    "direction": conv_msg.direction,
                    "created_at": conv_msg.created_at.isoformat() + "Z" if conv_msg.created_at else None,
                }
            }))
        except Exception:
            pass

        return {"success": True, "message": {"id": conv_msg.id}}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()



# ── Media upload → send via Meta ─────────────────────────────────────────────
@router.post("/messages/send/media-upload")
async def send_media_upload(request: Request):
    """
    Accepts a multipart form with:
      file           — the media file
      conversation_id — inbox conversation id
      message_type   — IMAGE | VIDEO | AUDIO | DOCUMENT
      caption        — optional caption
    Uploads the file to Meta's media API and sends it via WhatsApp.
    """
    import httpx
    from fastapi import UploadFile, Form
    from core.database import SessionLocal
    from models.postgres_model import (
        WhatsAppInboxConversation, WhatsAppInboxMessage,
        WhatsAppInboxMediaFile, WhatsAppAccount,
    )
    from datetime import datetime

    form = await request.form()
    file: UploadFile = form.get("file")  # type: ignore
    conversation_id = int(form.get("conversation_id", 0))
    message_type = (form.get("message_type") or "DOCUMENT").upper()
    caption = form.get("caption") or None

    if not file or not conversation_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="file and conversation_id are required")

    db = SessionLocal()
    try:
        # Get conversation + WhatsApp account
        conv = db.query(WhatsAppInboxConversation).filter(
            WhatsAppInboxConversation.id == conversation_id
        ).first()
        if not conv:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Conversation not found")

        wa = db.query(WhatsAppAccount).filter(
            WhatsAppAccount.organization_id == conv.organization_id
        ).first()
        if not wa or not wa.access_token or not wa.phone_number_id:
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="WhatsApp account not connected")

        file_bytes = await file.read()
        mime_type = file.content_type or "application/octet-stream"
        filename = file.filename or "upload"

        from core.config import settings as cfg
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
            from fastapi import HTTPException
            raise HTTPException(status_code=502, detail="Media upload to Meta failed")

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
        msg = WhatsAppInboxMessage(
            conversation_id=conversation_id,
            meta_message_id=meta_msg_id,
            sender_type="AGENT",
            sender_id=1,
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
            file_url=None,
            mime_type=mime_type,
            file_size=len(file_bytes),
        )
        db.add(media_file)

        conv.last_message_at = datetime.utcnow()
        conv.status = "PENDING"
        db.commit()
        db.refresh(msg)

        import services.socket_service as socket_svc
        socket_svc.emit_new_message(conv.organization_id, conv.id, {
            "id": str(msg.id),
            "conversation_id": str(conv.id),
            "meta_message_id": meta_msg_id,
            "sender_type": "AGENT",
            "sender_id": "1",
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
                "file_url": None,
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
            "sender_id": "1",
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
                "file_url": None,
                "mime_type": mime_type,
                "file_size": len(file_bytes),
            }],
            "reactions": [],
            "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
        }

    except Exception as exc:
        db.rollback()
        from fastapi import HTTPException
        if isinstance(exc, HTTPException):
            raise
        raise HTTPException(status_code=502, detail=str(exc))
    finally:
        db.close()


# ── Reactions ─────────────────────────────────────────────────────────────────
@router.post("/messages/{message_id}/reactions")
def add_reaction(message_id: int, payload: dict):
    """
    Add or remove a reaction on a message.
    { emoji: "👍", customer_phone: "..." }
    Empty emoji removes the reaction.
    """
    from core.database import SessionLocal
    from services.reaction_service import ReactionService
    from schemas.whatsapp_inbox import ReactionResponse

    emoji = payload.get("emoji", "")
    customer_phone = payload.get("customer_phone") or "agent"

    db = SessionLocal()
    try:
        svc = ReactionService(db)
        reaction = svc.handle_reaction_by_message_id(
            message_id=message_id,
            emoji=emoji,
            customer_phone=str(customer_phone),
        )
        if reaction is None:
            return {"id": None, "message_id": message_id, "emoji": "", "customer_phone": customer_phone, "created_at": None}
        return ReactionResponse.model_validate(reaction).model_dump(mode="json")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


@router.get("/messages/{message_id}/reactions")
def get_reactions(message_id: int):
    """Get all reactions for a message."""
    from core.database import SessionLocal
    from services.reaction_service import ReactionService

    db = SessionLocal()
    try:
        svc = ReactionService(db)
        result = svc.get_reactions_for_message(message_id)
        return result.model_dump(mode="json")
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        db.close()


# ── Signed URL for media files ────────────────────────────────────────────────
@router.get("/media/{media_file_id}/signed-url")
def get_signed_media_url(media_file_id: int):
    """
    Return an accessible URL for a media file.
    Priority: S3 presigned URL → direct file_url → Meta CDN URL (via media_id)
    """
    from core.database import SessionLocal
    from models.postgres_model import WhatsAppInboxMediaFile, WhatsAppAccount
    from fastapi import HTTPException
    import httpx

    db = SessionLocal()
    try:
        mf = db.query(WhatsAppInboxMediaFile).filter(
            WhatsAppInboxMediaFile.id == media_file_id
        ).first()
        if not mf:
            raise HTTPException(status_code=404, detail="Media file not found")

        # 1. S3 presigned URL
        if mf.s3_key:
            try:
                from services.media_service import MediaService
                svc = MediaService(db)
                signed = svc.generate_signed_url(mf.s3_key)
                return {"signed_url": signed, "expires_in": 3600}
            except Exception:
                pass

        # 2. Direct public URL
        if mf.file_url and mf.file_url.startswith("http"):
            return {"signed_url": mf.file_url, "expires_in": 86400}

        # 3. Fetch download URL from Meta using media_id
        if mf.media_id:
            try:
                # Get WhatsApp account token
                from models.postgres_model import WhatsAppInboxMessage
                msg = db.query(WhatsAppInboxMessage).filter(
                    WhatsAppInboxMessage.id == mf.message_id
                ).first()
                conv_org_id = 1
                if msg:
                    from models.postgres_model import WhatsAppInboxConversation
                    conv = db.query(WhatsAppInboxConversation).filter(
                        WhatsAppInboxConversation.id == msg.conversation_id
                    ).first()
                    if conv:
                        conv_org_id = conv.organization_id

                wa = db.query(WhatsAppAccount).filter(
                    WhatsAppAccount.organization_id == conv_org_id
                ).first()

                if wa and wa.access_token:
                    from core.config import settings as cfg
                    base = cfg.META_BASE_URL.rstrip("/")
                    version = cfg.META_API_VERSION
                    headers = {"Authorization": f"Bearer {wa.access_token}"}

                    # Get the CDN download URL
                    r = httpx.get(
                        f"{base}/{version}/{mf.media_id}",
                        headers=headers,
                        timeout=10
                    )
                    if r.status_code == 200:
                        cdn_url = r.json().get("url")
                        if cdn_url:
                            # Cache the URL in DB for future requests
                            mf.file_url = cdn_url
                            db.commit()
                            return {"signed_url": cdn_url, "expires_in": 300}
            except Exception:
                pass

        raise HTTPException(
            status_code=404,
            detail="Media file has no accessible URL."
        )
    finally:
        db.close()
