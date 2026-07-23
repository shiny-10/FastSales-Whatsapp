from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import WhatsAppInboxAutoReply
from routes.deps import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class AutoReplyCreate(BaseModel):
    name: Optional[str] = None
    match_type: Optional[str] = "EXACT"
    pattern: Optional[str] = None
    trigger_keyword: Optional[str] = None
    response_template: Optional[str] = None
    message: Optional[str] = None
    active: Optional[bool] = True
    is_active: Optional[bool] = True


@router.get("/settings/auto-replies")
def list_auto_replies(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = db.query(WhatsAppInboxAutoReply).order_by(WhatsAppInboxAutoReply.created_at.desc()).all()
    out = [
        {
            "id": i.id,
            "name": i.trigger_keyword or "",
            "match_type": i.match_type,
            "pattern": i.trigger_keyword or "",
            "trigger_keyword": i.trigger_keyword,
            "response_template": i.message,
            "message": i.message,
            "active": i.is_active,
            "is_active": i.is_active,
        }
        for i in items
    ]
    return {"success": True, "auto_replies": out}


@router.post("/settings/auto-replies")
def create_auto_reply(
    payload: AutoReplyCreate,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    keyword = payload.trigger_keyword or payload.pattern or payload.name or ""
    msg_text = payload.message or payload.response_template or ""
    active_flag = payload.is_active if payload.is_active is not None else (payload.active if payload.active is not None else True)

    item = WhatsAppInboxAutoReply(
        trigger_keyword=keyword,
        match_type=payload.match_type or "EXACT",
        message=msg_text,
        is_active=active_flag,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"success": True, "auto_reply": {"id": item.id}}


@router.patch("/settings/auto-replies/{item_id}")
def update_auto_reply(
    item_id: int,
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(WhatsAppInboxAutoReply).filter(WhatsAppInboxAutoReply.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    if "trigger_keyword" in payload or "pattern" in payload or "name" in payload:
        item.trigger_keyword = payload.get("trigger_keyword") or payload.get("pattern") or payload.get("name")
    if "message" in payload or "response_template" in payload:
        item.message = payload.get("message") or payload.get("response_template")
    if "is_active" in payload:
        item.is_active = payload["is_active"]
    elif "active" in payload:
        item.is_active = payload["active"]
    if "match_type" in payload:
        item.match_type = payload["match_type"]

    db.commit()
    db.refresh(item)
    return {"success": True, "auto_reply": {"id": item.id}}


@router.delete("/settings/auto-replies/{item_id}")
def delete_auto_reply(
    item_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(WhatsAppInboxAutoReply).filter(WhatsAppInboxAutoReply.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(item)
    db.commit()
    return {"success": True}
