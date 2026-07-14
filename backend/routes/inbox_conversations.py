from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import SessionLocal
from services.conversation_service import ConversationService
from models.postgres_model import WhatsAppInboxConversation

router = APIRouter(prefix="/inbox/conversations", tags=["Inbox Conversations"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=dict)
def create_conversation(payload: dict, db: Session = Depends(get_db)):
    organization_id = payload.get("organization_id")
    customer_phone = payload.get("customer_phone")
    customer_name = payload.get("customer_name")
    if not organization_id or not customer_phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="organization_id and customer_phone are required")
    svc = ConversationService(db)
    conversation, created = svc.get_or_create(organization_id, customer_phone, customer_name)
    return {"created": created, "conversation": {"id": conversation.id, "customer_phone": conversation.customer_phone, "status": conversation.status}}

@router.get("", response_model=list[dict])
def list_conversations(db: Session = Depends(get_db)):
    conversations = db.query(WhatsAppInboxConversation).order_by(WhatsAppInboxConversation.created_at.desc()).all()
    return [{"id": c.id, "customer_phone": c.customer_phone, "status": c.status, "customer_name": c.customer_name} for c in conversations]
