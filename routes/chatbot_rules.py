from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from database.db import SessionLocal
from models.postgres_model import ChatbotRule

router = APIRouter()


class ChatbotRuleCreate(BaseModel):
    name: str
    conditions: Optional[Any] = None
    actions: Optional[Any] = None
    priority: Optional[int] = 100
    active: Optional[bool] = True


@router.get("/settings/chatbot-rules")
def list_chatbot_rules():
    db = SessionLocal()
    try:
        items = db.query(ChatbotRule).order_by(ChatbotRule.priority.asc()).all()
        out = [
            {
                "id": i.id,
                "name": i.name,
                "conditions": i.conditions,
                "actions": i.actions,
                "priority": i.priority,
                "active": i.active,
            }
            for i in items
        ]
        return {"success": True, "chatbot_rules": out}
    finally:
        db.close()


@router.post("/settings/chatbot-rules")
def create_chatbot_rule(payload: ChatbotRuleCreate):
    db = SessionLocal()
    try:
        item = ChatbotRule(
            name=payload.name,
            conditions=payload.conditions,
            actions=payload.actions,
            priority=payload.priority,
            active=payload.active,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return {"success": True, "chatbot_rule": {"id": item.id}}
    finally:
        db.close()


@router.patch("/settings/chatbot-rules/{item_id}")
def update_chatbot_rule(item_id: int, payload: dict):
    db = SessionLocal()
    try:
        item = db.query(ChatbotRule).filter(ChatbotRule.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        for k, v in payload.items():
            if hasattr(item, k):
                setattr(item, k, v)
        db.commit()
        db.refresh(item)
        return {"success": True, "chatbot_rule": {"id": item.id}}
    finally:
        db.close()


@router.delete("/settings/chatbot-rules/{item_id}")
def delete_chatbot_rule(item_id: int):
    db = SessionLocal()
    try:
        item = db.query(ChatbotRule).filter(ChatbotRule.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        db.delete(item)
        db.commit()
        return {"success": True}
    finally:
        db.close()
