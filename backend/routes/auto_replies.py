from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from core.database import SessionLocal
from models.postgres_model import AutoReply

router = APIRouter()

class AutoReplyCreate(BaseModel):
    name: str
    match_type: str
    pattern: str
    response_template: Optional[str] = None
    active: Optional[bool] = True

@router.get("/settings/auto-replies")
def list_auto_replies():
    db = SessionLocal()
    try:
        items = db.query(AutoReply).order_by(AutoReply.created_at.desc()).all()
        out = [
            {
                "id": i.id,
                "name": i.name,
                "match_type": i.match_type,
                "pattern": i.pattern,
                "response_template": i.response_template,
                "active": i.active,
            }
            for i in items
        ]
        return {"success": True, "auto_replies": out}
    finally:
        db.close()

@router.post("/settings/auto-replies")
def create_auto_reply(payload: AutoReplyCreate):
    db = SessionLocal()
    try:
        item = AutoReply(
            name=payload.name,
            match_type=payload.match_type,
            pattern=payload.pattern,
            response_template=payload.response_template,
            active=payload.active,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return {"success": True, "auto_reply": {"id": item.id}}
    finally:
        db.close()

@router.patch("/settings/auto-replies/{item_id}")
def update_auto_reply(item_id: int, payload: dict):
    db = SessionLocal()
    try:
        item = db.query(AutoReply).filter(AutoReply.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        for k, v in payload.items():
            if hasattr(item, k):
                setattr(item, k, v)
        db.commit()
        db.refresh(item)
        return {"success": True, "auto_reply": {"id": item.id}}
    finally:
        db.close()

@router.delete("/settings/auto-replies/{item_id}")
def delete_auto_reply(item_id: int):
    db = SessionLocal()
    try:
        item = db.query(AutoReply).filter(AutoReply.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        db.delete(item)
        db.commit()
        return {"success": True}
    finally:
        db.close()
