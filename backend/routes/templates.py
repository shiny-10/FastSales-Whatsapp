import json
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import ActivityLog, Template
from routes.deps import get_current_user
from services.template_service import MetaTemplateService

meta_template_service = MetaTemplateService()

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".pdf"}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_activity(db: Session, action: str, template_id: int, template_name: str, status_str: str):
    try:
        activity = ActivityLog(
            action=action,
            template_id=template_id,
            template_name=template_name,
            status=status_str,
        )
        db.add(activity)
        db.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")


@router.post("/create")
async def create_template(
    request: Request,
    file: UploadFile = File(None),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            data = await request.json()
        else:
            form = await request.form()
            data = {}
            for k in form.keys():
                data[k] = form.get(k)

        buttons = data.get("buttons")
        if isinstance(buttons, str):
            try:
                buttons = json.loads(buttons)
            except Exception:
                buttons = []

        header = data.get("header", "none")

        template = Template(
            template_name=data.get("template_name"),
            category=data.get("category"),
            language=data.get("language"),
            header=header,
            template_body=data.get("template_body"),
            footer=data.get("footer"),
            buttons=buttons or [],
        )

        if file is not None and getattr(file, "filename", None):
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail="Invalid file type for template header. Allowed: .png, .jpg, .jpeg, .pdf")
            fname = f"{uuid.uuid4().hex}{ext}"
            dest_path = os.path.join(UPLOAD_DIR, fname)
            with open(dest_path, "wb") as out_file:
                content = await file.read()
                out_file.write(content)
            template.header_url = f"/uploads/{fname}"
            template.header_filename = file.filename

        db.add(template)
        db.commit()
        db.refresh(template)

        meta_warning = None
        try:
            meta_result = meta_template_service.create_template(
                template_name=template.template_name,
                category=template.category,
                language=template.language,
                body=template.template_body,
                db=db,
            )
            if meta_result.get("success"):
                template.meta_template_id = str(meta_result.get("id"))
                template.meta_template_name = template.template_name
                template.meta_status = meta_result.get("status", "PENDING")
            else:
                template.meta_status = "PENDING"
                meta_err = meta_result.get("error", {})
                if isinstance(meta_err, dict):
                    meta_warning = (
                        meta_err.get("error_user_msg")
                        or meta_err.get("message")
                        or meta_err.get("error_data", {}).get("details")
                        or str(meta_err)
                    )
                else:
                    meta_warning = str(meta_err)
            db.commit()
        except Exception as e:
            template.meta_status = "PENDING"
            meta_warning = str(e)
            db.commit()

        log_activity(
            db, action="created",
            template_id=template.id, template_name=template.template_name,
            status_str=template.meta_status or "PENDING",
        )

        response_data = {"success": True, "template_id": template.id}
        if meta_warning:
            response_data["warning"] = f"Template saved locally. Meta submission: {meta_warning}"
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.get("/activity/recent")
def get_recent_activities(
    limit: int = 5,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    activities = db.query(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(limit).all()
    result = []
    for activity in activities:
        result.append({
            "id": activity.id,
            "action": activity.action,
            "template_id": activity.template_id,
            "template_name": activity.template_name,
            "status": activity.status,
            "created_at": activity.created_at.isoformat() + "Z" if activity.created_at else None,
            "timestamp": activity.created_at.isoformat() + "Z" if activity.created_at else None,
        })
    return result


@router.get("")
def get_templates(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        templates = db.query(Template).all()
        result = []
        for t in templates:
            result.append({
                "id": t.id,
                "template_name": t.template_name,
                "category": t.category,
                "language": t.language,
                "header": t.header or "none",
                "header_url": t.header_url,
                "header_filename": t.header_filename,
                "template_body": t.template_body,
                "footer": t.footer,
                "buttons": t.buttons or [],
                "status": t.meta_status or "PENDING",
                "created_at": t.created_at.isoformat() + "Z" if t.created_at else None,
                "meta_status": t.meta_status or "PENDING",
            })
        return result
    except Exception:
        return []


@router.post("/sync-all")
def sync_all_templates(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.template_service import sync_all_templates_from_meta
    return sync_all_templates_from_meta(db)


@router.post("/{template_id}/sync")
def sync_template_status(
    template_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        return {"success": False, "message": "Template not found"}

    sanitized_name = (template.template_name or "").lower().replace(" ", "_").replace("-", "_")
    meta_response = meta_template_service.get_template_status_by_name(sanitized_name, db=db)

    if meta_response.get("error"):
        err_msg = meta_response.get("error")
        if meta_response.get("not_found"):
            template.meta_status = "REJECTED"
            db.commit()
            return {
                "success": False,
                "template_name": template.template_name,
                "meta_status": "REJECTED",
                "message": f"Template '{sanitized_name}' not found on Meta — it may have been deleted there.",
            }
        return {
            "success": False,
            "template_name": template.template_name,
            "meta_status": template.meta_status,
            "message": f"Could not check Meta status: {err_msg}",
        }

    new_status = meta_response.get("status", template.meta_status)
    meta_id = meta_response.get("id")
    template.meta_status = new_status
    if meta_id:
        template.meta_template_id = str(meta_id)
    db.commit()

    log_activity(
        db, action="synced",
        template_id=template.id, template_name=template.template_name,
        status_str=template.meta_status,
    )

    return {
        "success": True,
        "template_name": template.template_name,
        "meta_status": template.meta_status,
        "message": f"Approval status: {template.meta_status}",
    }


@router.post("/resubmit/{template_id}")
def resubmit_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from services.template_service import normalize_language

    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        return {"success": False, "message": "Template not found"}

    normalized_lang = normalize_language(template.language or "en_US")
    meta_result = meta_template_service.create_template(
        template_name=template.template_name,
        category=template.category,
        language=normalized_lang,
        body=template.template_body,
        db=db,
    )

    if meta_result.get("success"):
        template.meta_template_id = str(meta_result.get("id"))
        template.meta_template_name = template.template_name
        template.meta_status = meta_result.get("status", "PENDING")
        template.language = normalized_lang
        db.commit()
        log_activity(db, action="resubmitted", template_id=template.id, template_name=template.template_name, status_str=template.meta_status)
        return {"success": True, "message": f"Template submitted to Meta. Status: {template.meta_status}"}
    else:
        meta_err = meta_result.get("error", {})
        err_msg = (meta_err.get("error_user_msg") or meta_err.get("message") or str(meta_err)) if isinstance(meta_err, dict) else str(meta_err)
        return {
            "success": False,
            "message": f"Meta rejected the template: {err_msg}",
            "hint": f"Language was normalized to '{normalized_lang}'.",
        }


@router.put("/{template_id}")
def update_template(
    template_id: int,
    payload: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    allowed_fields = {"template_name", "category", "language", "header", "template_body", "footer", "buttons"}
    for k, v in payload.items():
        if k in allowed_fields and hasattr(template, k):
            setattr(template, k, v)

    db.commit()
    db.refresh(template)
    log_activity(db, action="updated", template_id=template.id, template_name=template.template_name, status_str=template.meta_status)
    return {"success": True, "message": "Template updated successfully", "template_id": template.id}


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = db.query(Template).filter(Template.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    t_name = template.template_name
    db.delete(template)
    db.commit()
    log_activity(db, action="deleted", template_id=template_id, template_name=t_name, status_str="DELETED")
    return {"success": True, "message": "Template deleted successfully"}
