from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from core.database import SessionLocal
from routes.deps import get_current_user
from models.postgres_model import Contact, Conversation, ConversationMessage

router = APIRouter()

class ConversationCreateRequest(BaseModel):
    contact_id: Optional[int] = None
    customer_phone: Optional[str] = None
    customer_name: Optional[str] = None

@router.post("/conversations")
def create_conversation(payload: ConversationCreateRequest):
    db = SessionLocal()
    try:
        # Try to find existing conversation by contact or phone
        conv = None
        if payload.contact_id:
            conv = db.query(Conversation).filter(Conversation.contact_id == payload.contact_id).first()
        if not conv and payload.customer_phone:
            conv = db.query(Conversation).filter(Conversation.customer_phone == payload.customer_phone).first()

        if conv:
            return {"success": True, "conversation": {
                "id": conv.id,
                "contact_id": conv.contact_id,
                "customer_phone": conv.customer_phone,
                "customer_name": conv.customer_name,
                "status": conv.status,
            }}

        conv = Conversation(
            contact_id=payload.contact_id,
            customer_phone=payload.customer_phone,
            customer_name=payload.customer_name,
            status="OPEN"
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

        return {"success": True, "conversation": {"id": conv.id}}
    finally:
        db.close()

@router.get("/conversations")
def list_conversations(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        q = db.query(Conversation)
        if status:
            q = q.filter(Conversation.status == status)
        items = q.order_by(Conversation.last_message_at.desc().nullslast()).limit(100).all()
        out = []
        for c in items:
            # unread count per user: incoming messages after last_read_at
            last_read = None
            try:
                from models.postgres_model import ConversationRead
                rr = db.query(ConversationRead).filter(ConversationRead.conversation_id == c.id, ConversationRead.user_id == int(user.get('id'))).first()
                last_read = rr.last_read_at if rr else None
            except Exception:
                last_read = None

            q_msg = db.query(ConversationMessage).filter(ConversationMessage.conversation_id == c.id, ConversationMessage.direction == 'incoming')
            if last_read:
                q_msg = q_msg.filter(ConversationMessage.created_at > last_read)
            unread = q_msg.count()

            out.append({
                "id": c.id,
                "contact_id": c.contact_id,
                "customer_phone": c.customer_phone,
                "customer_name": c.customer_name,
                "status": c.status,
                "last_message_at": c.last_message_at.isoformat() if c.last_message_at else None,
                "unread_count": unread,
            })
        return {"success": True, "conversations": out}
    finally:
        db.close()

@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, user: dict = Depends(get_current_user)):
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
        # update last_read_at for this user
        try:
            from models.postgres_model import ConversationRead
            from datetime import datetime
            rr = db.query(ConversationRead).filter(ConversationRead.conversation_id == conversation_id, ConversationRead.user_id == int(user.get('id'))).first()
            if rr:
                rr.last_read_at = datetime.utcnow()
            else:
                rr = ConversationRead(conversation_id=conversation_id, user_id=int(user.get('id')))
                db.add(rr)
            db.commit()
        except Exception:
            db.rollback()

        return {"success": True, "conversation": {
            "id": conv.id,
            "contact_id": conv.contact_id,
            "customer_phone": conv.customer_phone,
            "customer_name": conv.customer_name,
            "status": conv.status,
        }}
    finally:
        db.close()
