from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import SessionLocal
from services.message_service import MessageService

router = APIRouter(prefix="/inbox/messages", tags=["Inbox Messages"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=dict)
def create_message(payload: dict, db: Session = Depends(get_db)):
    conversation_id = payload.get("conversation_id")
    content = payload.get("content")
    if not conversation_id or not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="conversation_id and content are required")
    svc = MessageService(db)
    message = svc.send_text_message(conversation_id, content, agent_id=payload.get("agent_id"))
    return {"id": message.id, "conversation_id": message.conversation_id, "content": message.content, "status": message.status}

@router.get("/{conversation_id}", response_model=list[dict])
def list_messages(conversation_id: int, db: Session = Depends(get_db)):
    svc = MessageService(db)
    messages = svc.list_messages(conversation_id)
    return [{"id": m.id, "conversation_id": m.conversation_id, "content": m.content, "status": m.status} for m in messages]
