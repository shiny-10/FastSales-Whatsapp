from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional

from core.database import SessionLocal
from services.conversation_service import ConversationService
from models.postgres_model import WhatsAppInboxConversation, WhatsAppInboxMessage
from routes.deps import get_current_user

router = APIRouter(prefix="/inbox/conversations", tags=["Inbox Conversations"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=dict)
def create_conversation(payload: dict, db: Session = Depends(get_db), user: Optional[dict] = None):
    organization_id = payload.get("organization_id")
    customer_phone = payload.get("customer_phone")
    customer_name = payload.get("customer_name")
    if not organization_id or not customer_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="organization_id and customer_phone are required")
    svc = ConversationService(db)
    conversation, created = svc.get_or_create(organization_id, customer_phone, customer_name)
    return {"created": created, "conversation": {"id": conversation.id, "customer_phone": conversation.customer_phone, "status": conversation.status}}

@router.get("", response_model=dict)
def list_conversations(
    db: Session = Depends(get_db),
    organization_id: int = Query(1),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    archived: Optional[bool] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50)
):
    """List WhatsApp inbox conversations with pagination and filters."""
    query = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.organization_id == organization_id
    )

    if status:
        query = query.filter(WhatsAppInboxConversation.status == status)
    
    if search:
        from sqlalchemy import or_
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

    items = [{
        "id": str(c.id),
        "company_id": str(c.organization_id),
        "customer_phone": c.customer_phone,
        "customer_name": c.customer_name,
        "assigned_agent_id": c.assigned_agent_id,
        "status": c.status,
        "is_archived": c.is_archived,
        "unread_count": c.unread_count or 0,
        "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    } for c in conversations]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }

@router.get("/{conversation_id}", response_model=dict)
def get_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Get a single conversation by ID."""
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": str(conv.id),
        "company_id": str(conv.organization_id),
        "customer_phone": conv.customer_phone,
        "customer_name": conv.customer_name,
        "assigned_agent_id": conv.assigned_agent_id,
        "status": conv.status,
        "is_archived": conv.is_archived,
        "unread_count": conv.unread_count or 0,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }

@router.patch("/{conversation_id}", response_model=dict)
def update_conversation(conversation_id: int, payload: dict, db: Session = Depends(get_db)):
    """Update a conversation."""
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Update allowed fields
    if "status" in payload:
        conv.status = payload["status"]
    if "assigned_agent_id" in payload:
        conv.assigned_agent_id = payload["assigned_agent_id"]
    if "is_archived" in payload:
        conv.is_archived = payload["is_archived"]
    if "customer_name" in payload:
        conv.customer_name = payload["customer_name"]
    
    db.commit()
    db.refresh(conv)
    
    return {
        "id": str(conv.id),
        "company_id": str(conv.organization_id),
        "customer_phone": conv.customer_phone,
        "customer_name": conv.customer_name,
        "assigned_agent_id": conv.assigned_agent_id,
        "status": conv.status,
        "is_archived": conv.is_archived,
        "unread_count": conv.unread_count or 0,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }

@router.post("/{conversation_id}/assign", response_model=dict)
def assign_agent(conversation_id: int, payload: dict, db: Session = Depends(get_db)):
    """Assign an agent to a conversation."""
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv.assigned_agent_id = payload.get("agent_id")
    db.commit()
    db.refresh(conv)
    
    return {
        "id": str(conv.id),
        "company_id": str(conv.organization_id),
        "customer_phone": conv.customer_phone,
        "customer_name": conv.customer_name,
        "assigned_agent_id": conv.assigned_agent_id,
        "status": conv.status,
        "is_archived": conv.is_archived,
        "unread_count": conv.unread_count or 0,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }

@router.post("/{conversation_id}/read", response_model=dict)
def mark_as_read(conversation_id: int, db: Session = Depends(get_db)):
    """Mark conversation as read (reset unread count)."""
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv.unread_count = 0
    db.commit()
    db.refresh(conv)
    
    return {
        "id": str(conv.id),
        "company_id": str(conv.organization_id),
        "customer_phone": conv.customer_phone,
        "customer_name": conv.customer_name,
        "assigned_agent_id": conv.assigned_agent_id,
        "status": conv.status,
        "is_archived": conv.is_archived,
        "unread_count": conv.unread_count or 0,
        "last_message_at": conv.last_message_at.isoformat() if conv.last_message_at else None,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
    }

@router.delete("/{conversation_id}", response_model=dict)
def delete_conversation(conversation_id: int, db: Session = Depends(get_db)):
    """Delete a conversation."""
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    db.delete(conv)
    db.commit()
    
    return {"id": str(conversation_id), "deleted": True}

@router.get("/{conversation_id}/messages", response_model=dict)
def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    page: int = Query(1),
    page_size: int = Query(50)
):
    """Get messages for a conversation."""
    # Verify conversation exists
    conv = db.query(WhatsAppInboxConversation).filter(
        WhatsAppInboxConversation.id == conversation_id
    ).first()
    
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Query messages
    query = db.query(WhatsAppInboxMessage).filter(
        WhatsAppInboxMessage.conversation_id == conversation_id
    )
    
    total = query.count()
    
    messages = (
        query.order_by(WhatsAppInboxMessage.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    
    # Reverse to get chronological order
    messages.reverse()
    
    items = [{
        "id": str(m.id),
        "conversation_id": str(m.conversation_id),
        "meta_message_id": m.meta_message_id,
        "sender_type": m.sender_type,
        "message_type": m.message_type,
        "content": m.content,
        "status": m.status or "SENT",
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    } for m in messages]
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_more": (page * page_size) < total,
        "cursor": None,
    }
