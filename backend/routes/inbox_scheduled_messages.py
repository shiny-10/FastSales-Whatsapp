"""
REST routes for WhatsApp Inbox Scheduled Messages.
  GET    /inbox/scheduled-messages          – list (with optional filters)
  POST   /inbox/scheduled-messages          – create
  DELETE /inbox/scheduled-messages/{id}     – cancel / delete
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import (
    WhatsAppInboxConversation,
    WhatsAppInboxScheduledMessage,
    WhatsAppAccount,
    Template,
    Contact,
)

router = APIRouter(prefix="/inbox/scheduled-messages", tags=["Inbox Scheduled Messages"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize(msg: WhatsAppInboxScheduledMessage) -> dict:
    return {
        "id": str(msg.id),
        "organization_id": msg.organization_id,
        "conversation_id": str(msg.conversation_id),
        "agent_id": msg.agent_id,
        "message_type": msg.message_type,
        "content": msg.content,
        "template_name": msg.template_name,
        "scheduled_at": msg.scheduled_at.isoformat() + "Z" if msg.scheduled_at else None,
        "status": msg.status,
        "created_at": msg.created_at.isoformat() + "Z" if msg.created_at else None,
    }


# ── List ───────────────────────────────────────────────────────────────────────
@router.get("", response_model=dict)
def list_scheduled_messages(
    db: Session = Depends(get_db),
    organization_id: int = Query(1),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1),
    page_size: int = Query(50),
):
    query = db.query(WhatsAppInboxScheduledMessage).filter(
        WhatsAppInboxScheduledMessage.organization_id == organization_id
    )
    if status_filter:
        query = query.filter(WhatsAppInboxScheduledMessage.status == status_filter)

    total = query.count()
    items = (
        query.order_by(WhatsAppInboxScheduledMessage.scheduled_at.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [_serialize(m) for m in items],
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


# ── Create ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_scheduled_message(payload: dict, db: Session = Depends(get_db)):
    """
    Expected payload:
    {
      "organization_id": 1,           # optional, default 1
      "customer_phone": "+91...",      # required — used to get/create conversation
      "customer_name": "...",          # optional
      "message_type": "TEXT|TEMPLATE", # default TEXT
      "content": "Hello!",             # for TEXT
      "template_name": "hello_world",  # for TEMPLATE
      "language_code": "en_US",        # optional
      "scheduled_at": "2026-07-20T10:00:00Z"  # required ISO8601
    }
    """
    organization_id: int = int(payload.get("organization_id", 1))
    customer_phone: str = payload.get("customer_phone", "").strip()
    customer_name: str | None = payload.get("customer_name")
    message_type: str = (payload.get("message_type") or "TEXT").upper()
    content: str | None = payload.get("content")
    template_name: str | None = payload.get("template_name")
    language_code: str = payload.get("language_code") or "en_US"
    scheduled_at_raw: str | None = payload.get("scheduled_at")

    # ── Validate ────────────────────────────────────────────────────────────
    if not customer_phone:
        raise HTTPException(status_code=400, detail="customer_phone is required")
    if not scheduled_at_raw:
        raise HTTPException(status_code=400, detail="scheduled_at is required")

    try:
        scheduled_at = datetime.fromisoformat(scheduled_at_raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise HTTPException(status_code=400, detail="scheduled_at must be a valid ISO8601 datetime")

    if scheduled_at <= datetime.utcnow():
        raise HTTPException(status_code=400, detail="scheduled_at must be in the future")

    if message_type == "TEXT" and not content:
        raise HTTPException(status_code=400, detail="content is required for TEXT messages")
    if message_type == "TEMPLATE" and not template_name:
        raise HTTPException(status_code=400, detail="template_name is required for TEMPLATE messages")

    # ── Get or create inbox conversation ────────────────────────────────────
    conv = (
        db.query(WhatsAppInboxConversation)
        .filter(
            WhatsAppInboxConversation.organization_id == organization_id,
            WhatsAppInboxConversation.customer_phone == customer_phone,
        )
        .first()
    )
    if not conv:
        # Try to get customer name from contacts table
        if not customer_name:
            contact = db.query(Contact).filter(Contact.phone_number == customer_phone).first()
            if contact:
                customer_name = contact.name

        conv = WhatsAppInboxConversation(
            organization_id=organization_id,
            customer_phone=customer_phone,
            customer_name=customer_name,
            status="OPEN",
            is_archived=False,
            unread_count=0,
            last_message_at=datetime.utcnow(),
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # ── Resolve template body for display ───────────────────────────────────
    display_content = content
    if message_type == "TEMPLATE" and template_name:
        tmpl = (
            db.query(Template)
            .filter(Template.template_name == template_name)
            .order_by(Template.id.desc())
            .first()
        )
        if tmpl and tmpl.template_body:
            display_content = tmpl.template_body

    # ── Persist ─────────────────────────────────────────────────────────────
    msg = WhatsAppInboxScheduledMessage(
        organization_id=organization_id,
        conversation_id=conv.id,
        agent_id=1,
        message_type=message_type,
        content=display_content,
        template_name=template_name,
        scheduled_at=scheduled_at,
        status="PENDING",
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)

    return {
        "success": True,
        "scheduled_message": _serialize(msg),
        "conversation_id": str(conv.id),
    }


# ── Cancel / Delete ────────────────────────────────────────────────────────────
@router.delete("/{message_id}", response_model=dict)
def cancel_scheduled_message(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(WhatsAppInboxScheduledMessage).filter(
        WhatsAppInboxScheduledMessage.id == message_id
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Scheduled message not found")
    if msg.status == "SENT":
        raise HTTPException(status_code=400, detail="Cannot cancel a message that has already been sent")

    db.delete(msg)
    db.commit()
    return {"success": True, "id": str(message_id)}
