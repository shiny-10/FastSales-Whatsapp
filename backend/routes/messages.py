from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

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
    from models.postgres_model import WhatsAppInboxMessage
    msg = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    db.delete(msg)
    db.commit()
    return {"id": str(message_id), "deleted": True}


@router.delete("", response_model=dict)
def delete_messages_bulk(payload: dict, db: Session = Depends(get_db)):
    from models.postgres_model import WhatsAppInboxMessage
    ids = [int(i) for i in payload.get("ids", [])]
    if not ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No message ids provided")
    db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.id.in_(ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted": len(ids), "ids": [str(i) for i in ids]}


@router.get("/{conversation_id}", response_model=list[dict])
def list_messages(conversation_id: int, db: Session = Depends(get_db)):
    svc = MessageService(db)
    messages = svc.list_messages(conversation_id)
    return [{"id": m.id, "conversation_id": m.conversation_id, "content": m.content, "status": m.status} for m in messages]

