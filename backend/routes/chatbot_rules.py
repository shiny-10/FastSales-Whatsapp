from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import WhatsAppInboxChatbotRule
from routes.deps import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize_inbox_rule(r: WhatsAppInboxChatbotRule) -> dict:
    return {
        "id": str(r.id),
        "keyword": r.keyword,
        "name": r.keyword,
        "response": r.response,
        "is_active": r.is_active,
        "active": r.is_active,
        "match_exact": r.match_exact,
        "priority": r.priority,
        "created_at": r.created_at.isoformat() + "Z" if r.created_at else None,
        "updated_at": r.updated_at.isoformat() + "Z" if r.updated_at else None,
    }


@router.get("/chatbot-rules")
def list_inbox_chatbot_rules(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rules = (
        db.query(WhatsAppInboxChatbotRule)
        .order_by(WhatsAppInboxChatbotRule.priority.desc())
        .all()
    )
    return [_serialize_inbox_rule(r) for r in rules]


@router.post("/chatbot-rules")
def create_inbox_chatbot_rule(
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = WhatsAppInboxChatbotRule(
        keyword=(payload.get("keyword") or payload.get("name") or "").strip(),
        response=(payload.get("response") or "").strip(),
        is_active=bool(payload.get("is_active", payload.get("active", True))),
        match_exact=bool(payload.get("match_exact", False)),
        priority=int(payload.get("priority", 0)),
    )
    if not rule.keyword or not rule.response:
        raise HTTPException(status_code=400, detail="keyword and response are required")
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return _serialize_inbox_rule(rule)


@router.patch("/chatbot-rules/{rule_id}")
def update_inbox_chatbot_rule(
    rule_id: int,
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.query(WhatsAppInboxChatbotRule).filter(WhatsAppInboxChatbotRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    
    if "keyword" in payload or "name" in payload:
        rule.keyword = (payload.get("keyword") or payload.get("name") or "").strip()
    if "response" in payload:
        rule.response = payload["response"]
    if "is_active" in payload:
        rule.is_active = payload["is_active"]
    elif "active" in payload:
        rule.is_active = payload["active"]
    if "match_exact" in payload:
        rule.match_exact = payload["match_exact"]
    if "priority" in payload:
        rule.priority = int(payload["priority"])

    db.commit()
    db.refresh(rule)
    return _serialize_inbox_rule(rule)


@router.delete("/chatbot-rules/{rule_id}")
def delete_inbox_chatbot_rule(
    rule_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rule = db.query(WhatsAppInboxChatbotRule).filter(WhatsAppInboxChatbotRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"success": True, "id": str(rule_id)}


class ChatbotRuleCreate(BaseModel):
    name: Optional[str] = None
    keyword: Optional[str] = None
    response: Optional[str] = None
    conditions: Optional[Any] = None
    actions: Optional[Any] = None
    priority: Optional[int] = 0
    active: Optional[bool] = True
    is_active: Optional[bool] = True


@router.get("/settings/chatbot-rules")
def list_chatbot_rules(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(WhatsAppInboxChatbotRule).order_by(WhatsAppInboxChatbotRule.priority.asc()).all()
    out = [_serialize_inbox_rule(i) for i in items]
    return {"success": True, "chatbot_rules": out}


@router.post("/settings/chatbot-rules")
def create_chatbot_rule(
    payload: ChatbotRuleCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = payload.keyword or payload.name or ""
    resp_text = payload.response or (str(payload.actions) if payload.actions else "")
    active_flag = payload.is_active if payload.is_active is not None else (payload.active if payload.active is not None else True)

    item = WhatsAppInboxChatbotRule(
        keyword=keyword,
        response=resp_text,
        priority=payload.priority or 0,
        is_active=active_flag,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"success": True, "chatbot_rule": _serialize_inbox_rule(item)}


@router.patch("/settings/chatbot-rules/{item_id}")
def update_chatbot_rule(
    item_id: int,
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return update_inbox_chatbot_rule(item_id, payload, user, db)


@router.delete("/settings/chatbot-rules/{item_id}")
def delete_chatbot_rule(
    item_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return delete_inbox_chatbot_rule(item_id, user, db)
