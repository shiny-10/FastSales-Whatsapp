"""
Chatbot rule routes.

New inbox routes (used by the settings UI):
  GET    /chatbot-rules           – list all rules for org
  POST   /chatbot-rules           – create
  PATCH  /chatbot-rules/{id}      – update
  DELETE /chatbot-rules/{id}      – delete

Legacy settings routes are kept for backward compatibility.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from core.database import SessionLocal
from models.postgres_model import ChatbotRule, WhatsAppInboxChatbotRule

router = APIRouter()


# ── New inbox chatbot rules (WhatsAppInboxChatbotRule) ────────────────────────

def _serialize_inbox_rule(r: WhatsAppInboxChatbotRule) -> dict:
    return {
        "id": str(r.id),
        "company_id": str(r.organization_id),
        "keyword": r.keyword,
        "response": r.response,
        "is_active": r.is_active,
        "match_exact": r.match_exact,
        "priority": r.priority,
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
        "updated_at": r.updated_at.isoformat() + "Z" if r.updated_at else None,
    }


@router.get("/chatbot-rules")
def list_inbox_chatbot_rules(organization_id: int = 1):
    db = SessionLocal()
    try:
        rules = (
            db.query(WhatsAppInboxChatbotRule)
            .filter(WhatsAppInboxChatbotRule.organization_id == organization_id)
            .order_by(WhatsAppInboxChatbotRule.priority.desc())
            .all()
        )
        return [_serialize_inbox_rule(r) for r in rules]
    finally:
        db.close()


@router.post("/chatbot-rules")
def create_inbox_chatbot_rule(payload: dict):
    db = SessionLocal()
    try:
        rule = WhatsAppInboxChatbotRule(
            organization_id=int(payload.get("organization_id", 1)),
            keyword=(payload.get("keyword") or "").strip(),
            response=(payload.get("response") or "").strip(),
            is_active=bool(payload.get("is_active", True)),
            match_exact=bool(payload.get("match_exact", False)),
            priority=int(payload.get("priority", 0)),
        )
        if not rule.keyword or not rule.response:
            raise HTTPException(status_code=400, detail="keyword and response are required")
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return _serialize_inbox_rule(rule)
    finally:
        db.close()


@router.patch("/chatbot-rules/{rule_id}")
def update_inbox_chatbot_rule(rule_id: int, payload: dict):
    db = SessionLocal()
    try:
        rule = db.query(WhatsAppInboxChatbotRule).filter(
            WhatsAppInboxChatbotRule.id == rule_id
        ).first()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        allowed = {"keyword", "response", "is_active", "match_exact", "priority"}
        for k, v in payload.items():
            if k in allowed:
                setattr(rule, k, v)
        db.commit()
        db.refresh(rule)
        return _serialize_inbox_rule(rule)
    finally:
        db.close()


@router.delete("/chatbot-rules/{rule_id}")
def delete_inbox_chatbot_rule(rule_id: int):
    db = SessionLocal()
    try:
        rule = db.query(WhatsAppInboxChatbotRule).filter(
            WhatsAppInboxChatbotRule.id == rule_id
        ).first()
        if not rule:
            raise HTTPException(status_code=404, detail="Rule not found")
        db.delete(rule)
        db.commit()
        return {"success": True, "id": str(rule_id)}
    finally:
        db.close()


# ── Legacy settings routes (kept for backward compatibility) ──────────────────

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
