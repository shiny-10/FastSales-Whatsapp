from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from database.db import SessionLocal
from models.postgres_model import Conversation, ConversationMessage, MessageLog
from services.meta_service import MetaWhatsAppService
from config import ACCESS_TOKEN, PHONE_NUMBER_ID
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
                "created_at": m.created_at.isoformat() if m.created_at else None,
            })
        return {"success": True, "messages": out}
    finally:
        db.close()


@router.post("/messages/send")
def send_message(payload: SendMessageRequest, user: dict = Depends(get_current_user)):
    # Use MetaWhatsAppService to send template messages; record in MessageLog and ConversationMessage
    db = SessionLocal()
    try:
        meta = MetaWhatsAppService(ACCESS_TOKEN, PHONE_NUMBER_ID)
        result = None
        if payload.message_type == "template":
            result = meta.send_template_message(payload.to, payload.template_name)
        elif payload.message_type == "text":
            result = meta.send_text_message(payload.to, payload.text or "")
        else:
            result = {"success": False, "error": "Unknown message type"}

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
                    "created_at": conv_msg.created_at.isoformat() if conv_msg.created_at else None,
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
