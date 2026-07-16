from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional

from core.database import SessionLocal
from services.conversation_service import ConversationService
from models.postgres_model import WhatsAppInboxConversation, WhatsAppInboxMessage

router = APIRouter(prefix="/inbox/conversations", tags=["Inbox Conversations"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _conv_dict(c: WhatsAppInboxConversation, preview=None, last_sender=None, last_status=None) -> dict:
    """Serialize a conversation row to the shape the frontend expects."""
    return {
        "id": str(c.id),
        "company_id": str(c.organization_id),
        "customer_phone": c.customer_phone,
        "customer_name": c.customer_name,
        "assigned_agent_id": c.assigned_agent_id,
        "status": c.status,
        "is_archived": c.is_archived,
        "unread_count": c.unread_count or 0,
        "last_message_at": c.last_message_at.isoformat() + "Z" if c.last_message_at else None,
        "last_message_preview": preview,
        "last_message_sender": last_sender,
        "last_message_status": last_status,
        "created_at": c.created_at.isoformat() + "Z" if c.created_at else None,
        "updated_at": c.updated_at.isoformat() + "Z" if c.updated_at else None,
    }


def _last_message_info(db: Session, conversation_id: int):
    """Return (preview, sender_type, status) for the latest message in a conversation."""
    msg = (
        db.query(WhatsAppInboxMessage)
        .filter(WhatsAppInboxMessage.conversation_id == conversation_id)
        .order_by(WhatsAppInboxMessage.created_at.desc())
        .first()
    )
    if not msg:
        return None, None, None

    type_labels = {
        "IMAGE": "📷 Photo",
        "VIDEO": "🎥 Video",
        "AUDIO": "🎵 Audio",
        "DOCUMENT": "📄 Document",
        "STICKER": "😊 Sticker",
    }
    preview = msg.content or type_labels.get(msg.message_type, f"[{msg.message_type}]")
    return preview, msg.sender_type, msg.status


# ── Create conversation ────────────────────────────────────────────────────────
@router.post("", response_model=dict)
def create_conversation(payload: dict, db: Session = Depends(get_db)):
    organization_id = payload.get("organization_id", 1)
    customer_phone = payload.get("customer_phone")
    customer_name = payload.get("customer_name")
    if not customer_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="customer_phone is required")
    svc = ConversationService(db)
    conversation, created = svc.get_or_create(organization_id, customer_phone, None, customer_name)
    preview, last_sender, last_status = _last_message_info(db, conversation.id)
    return {"created": created, "conversation": _conv_dict(conversation, preview, last_sender, last_status)}


# ── List conversations ─────────────────────────────────────────────────────────
@router.get("", response_model=dict)
def list_conversations(
    db: Session = Depends(get_db),
    organization_id: int = Query(1),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50),
):
    query = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.organization_id == organization_id
    )
    if status:
        query = query.filter(WhatsAppInboxConversation.status == status)
    if search:
        query = query.filter(
            or_(
                WhatsAppInboxConversation.customer_phone.ilike(f"%{search}%"),
                WhatsAppInboxConversation.customer_name.ilike(f"%{search}%"),
            )
        )
    if archived is None:
        query = query.filter(WhatsAppInboxConversation.is_archived == False)
    else:
        query = query.filter(WhatsAppInboxConversation.is_archived == archived)

    total = query.count()
    conversations = (
        query.order_by(WhatsAppInboxConversation.last_message_at.desc().nullslast())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for c in conversations:
        preview, last_sender, last_status = _last_message_info(db, c.id)
        items.append(_conv_dict(c, preview, last_sender, last_status))

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


# ── Get single conversation ────────────────────────────────────────────────────
@router.get("/{conversation_id}", response_model=dict)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    preview, last_sender, last_status = _last_message_info(db, conv.id)
    return _conv_dict(conv, preview, last_sender, last_status)


# ── Update conversation ────────────────────────────────────────────────────────
@router.patch("/{conversation_id}", response_model=dict)
def update_conversation(conversation_id: int, payload: dict, db: Session = Depends(get_db)):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    for field in ("status", "assigned_agent_id", "is_archived", "customer_name"):
        if field in payload:
            setattr(conv, field, payload[field])
    db.commit()
    db.refresh(conv)
    preview, last_sender, last_status = _last_message_info(db, conv.id)
    return _conv_dict(conv, preview, last_sender, last_status)


# ── Assign agent ───────────────────────────────────────────────────────────────
@router.post("/{conversation_id}/assign", response_model=dict)
def assign_agent(conversation_id: int, payload: dict, db: Session = Depends(get_db)):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.assigned_agent_id = payload.get("agent_id")
    db.commit()
    db.refresh(conv)
    preview, last_sender, last_status = _last_message_info(db, conv.id)
    return _conv_dict(conv, preview, last_sender, last_status)


# ── Mark as read ───────────────────────────────────────────────────────────────
@router.post("/{conversation_id}/read", response_model=dict)
def mark_as_read(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.unread_count = 0
    db.commit()
    db.refresh(conv)
    preview, last_sender, last_status = _last_message_info(db, conv.id)
    return _conv_dict(conv, preview, last_sender, last_status)


# ── Delete conversation ────────────────────────────────────────────────────────
@router.delete("/{conversation_id}", response_model=dict)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"id": str(conversation_id), "deleted": True}


# ── Get messages for conversation ──────────────────────────────────────────────
@router.get("/{conversation_id}/messages", response_model=dict)
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1),
    page_size: int = Query(50),
):
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    total = db.query(WhatsAppInboxMessage).filter(
        WhatsAppInboxMessage.conversation_id == conversation_id
    ).count()

    messages = (
        db.query(WhatsAppInboxMessage)
        .filter(WhatsAppInboxMessage.conversation_id == conversation_id)
        .order_by(WhatsAppInboxMessage.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    messages.reverse()  # chronological order

    items = [
        {
            "id": str(m.id),
            "conversation_id": str(m.conversation_id),
            "meta_message_id": m.meta_message_id,
            "sender_type": m.sender_type,
            "sender_id": str(m.sender_id) if m.sender_id else None,
            "message_type": m.message_type,
            "content": m.content,
            "caption": m.caption if hasattr(m, "caption") else None,
            "status": m.status or "SENT",
            "is_deleted": bool(m.is_deleted) if hasattr(m, "is_deleted") else False,
            "reply_to_message_id": str(m.reply_to_message_id) if m.reply_to_message_id else None,
            "media_files": [
                {
                    "id": str(mf.id),
                    "media_id": mf.media_id,
                    "file_name": mf.file_name,
                    "file_url": mf.file_url,
                    "mime_type": mf.mime_type,
                    "file_size": mf.file_size,
                }
                for mf in (m.media_files if hasattr(m, "media_files") and m.media_files else [])
            ],
            "reactions": [
                {
                    "id": str(r.id),
                    "message_id": str(r.message_id),
                    "emoji": r.emoji,
                    "customer_phone": r.customer_phone,
                    "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
                }
                for r in (m.reactions if hasattr(m, "reactions") and m.reactions else [])
            ],
            "created_at": m.created_at.isoformat() + "Z" if m.created_at else None,
        }
        for m in messages
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total,
        "cursor": None,
    }

