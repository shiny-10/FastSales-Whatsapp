from typing import Optional

from fastapi import APIRouter, Request, UploadFile, File, Body
from pydantic import BaseModel
from core.database import SessionLocal
from models.postgres_model import ActivityLog, Organization, Template
from services.template_service import MetaTemplateService
import os
import uuid
import json
meta_template_service = MetaTemplateService()

class TemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    category: Optional[str] = None
    language: Optional[str] = None
    header: Optional[str] = None
    template_body: Optional[str] = None
    footer: Optional[str] = None
    buttons: Optional[list] = None

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def log_activity(db, action: str, template_id: int, template_name: str, status: str, organization_id: int = 1):
    """Helper function to log template activities"""
    try:
        activity = ActivityLog(
            action=action,
            template_id=template_id,
            template_name=template_name,
            status=status,
            organization_id=organization_id
        )
        db.add(activity)
        db.commit()
    except Exception as e:
        print(f"Error logging activity: {e}")

@router.post("/create")
async def create_template(request: Request, file: UploadFile = File(None)):
    db = SessionLocal()

    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            data = await request.json()
        else:
            form = await request.form()
            # Convert form data to dict
            data = {}
            for k in form.keys():
                data[k] = form.get(k)

        # Parse buttons if provided as JSON string
        buttons = data.get("buttons")
        if isinstance(buttons, str):
            try:
                buttons = json.loads(buttons)
            except Exception:
                buttons = []

        header = data.get("header", "none")
        organization_id = int(data.get("organization_id") or 1)

        # Create template record
        template = Template(
            template_name=data.get("template_name"),
            category=data.get("category"),
            language=data.get("language"),
            header=header,
            template_body=data.get("template_body"),
            footer=data.get("footer"),
            buttons=buttons or [],
            organization_id=organization_id
        )

        # Handle uploaded file if present
        if file is not None and getattr(file, 'filename', None):
            ext = os.path.splitext(file.filename)[1]
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

        # Call Meta template service — failure is non-blocking (save locally regardless)
        meta_warning = None
        try:
            meta_result = meta_template_service.create_template(
                template_name=template.template_name,
                category=template.category,
                language=template.language,
                body=template.template_body,
            )

            if meta_result.get("success"):
                template.meta_template_id = str(meta_result.get("id"))
                template.meta_template_name = template.template_name
                template.meta_status = meta_result.get("status", "PENDING")
            else:
                template.meta_status = "PENDING"
                # Extract a readable error from Meta's response
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

        # Log the activity
        log_activity(
            db,
            action="created",
            template_id=template.id,
            template_name=template.template_name,
            status=template.meta_status or "PENDING",
            organization_id=organization_id
        )

        response_data = {
            "success": True,
            "template_id": template.id,
        }
        if meta_warning:
            response_data["warning"] = f"Template saved locally. Meta submission: {meta_warning}"

        return response_data

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()

@router.get("")
def get_templates():
    db = SessionLocal()

    templates = db.query(Template).all()

    result = []

    for t in templates:
        org = None
        try:
            org = db.query(Organization).filter(Organization.id == t.organization_id).first()
        except Exception:
            org = None
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
            "organization_id": t.organization_id,
            "organization_name": org.name if org else None,
            "created_at": t.created_at.isoformat() + "Z" if t.created_at else None,
            "meta_status": t.meta_status or "PENDING"
        })

    db.close()

    return result

@router.put("/{template_id}")
def update_template(template_id: int, data: TemplateUpdate = Body(...)):
    db = SessionLocal()

    template = db.query(Template).filter(
        Template.id == template_id
    ).first()

    if not template:
        db.close()
        return {"success": False, "message": "Template not found"}

    if data.template_name is not None:
        template.template_name = data.template_name
    if data.category is not None:
        template.category = data.category
    if data.language is not None:
        template.language = data.language
    if data.header is not None:
        template.header = data.header
    if data.template_body is not None:
        template.template_body = data.template_body
    if data.footer is not None:
        template.footer = data.footer
    if data.buttons is not None:
        template.buttons = data.buttons

    db.commit()

    # Log the activity
    log_activity(
        db,
        action="updated",
        template_id=template.id,
        template_name=template.template_name,
        status=template.meta_status or "PENDING",
        organization_id=template.organization_id
    )

    db.close()

    return {
        "success": True,
        "message": "Template updated"
    }

@router.delete("/{template_id}")
def delete_template(template_id: int):
    db = SessionLocal()

    template = db.query(Template).filter(
        Template.id == template_id
    ).first()

    if not template:
        return {"success": False, "message": "Template not found"}

    # Log the activity before deletion
    log_activity(
        db,
        action="deleted",
        template_id=template.id,
        template_name=template.template_name,
        status=template.meta_status or "PENDING",
        organization_id=template.organization_id
    )

    db.delete(template)
    db.commit()

    db.close()

    return {
        "success": True,
        "message": "Template deleted"
    }
@router.get("/sync-status")
def sync_template_status(template_id: Optional[int] = None):
    """
    Sync template status.
    If `template_id` query param is provided, sync only that template.
    If not provided, sync all templates that have a `meta_template_id`.
    """
    db = SessionLocal()

    results = []

    templates_query = db.query(Template)
    if template_id:
        templates = templates_query.filter(Template.id == template_id).all()
    else:
        templates = templates_query.all()

    for template in templates:
        try:
            # Always look up by name — more reliable than by ID
            sanitized_name = (template.template_name or "").lower().replace(" ", "_").replace("-", "_")
            meta_response = meta_template_service.get_template_status_by_name(sanitized_name)

            if meta_response.get("error"):
                # Name not found on Meta — template may not have been submitted yet
                # Try to submit it now
                created = meta_template_service.create_template(
                    template_name=sanitized_name,
                    category=template.category,
                    language=template.language,
                    body=template.template_body,
                )
                new_id = created.get("id") or created.get("template_id")
                if new_id:
                    template.meta_template_id = str(new_id)
                    template.meta_template_name = sanitized_name
                    template.meta_status = created.get("status") or "PENDING"
                    db.commit()
                    log_activity(db, action="synced",
                        template_id=template.id, template_name=template.template_name,
                        status=template.meta_status, organization_id=template.organization_id)
                    results.append({
                        "success": True, "template_id": template.id,
                        "template_name": template.template_name,
                        "meta_status": template.meta_status,
                        "message": f"Submitted to Meta — status: {template.meta_status}",
                    })
                else:
                    meta_err = created.get("error", {})
                    if isinstance(meta_err, dict):
                        err_msg = (meta_err.get("error_user_msg") or meta_err.get("message")
                                   or meta_err.get("error_data", {}).get("details") or str(meta_err))
                    else:
                        err_msg = str(meta_err) or "Unknown Meta error"
                    results.append({
                        "success": False, "template_id": template.id,
                        "template_name": template.template_name,
                        "message": f"Meta rejected: {err_msg}",
                        "meta_status": template.meta_status or "PENDING",
                    })
            else:
                # Got status back — update local record
                new_status = meta_response.get("status", template.meta_status)
                meta_id = meta_response.get("id")
                template.meta_status = new_status
                if meta_id:
                    template.meta_template_id = str(meta_id)
                db.commit()
                log_activity(db, action="synced",
                    template_id=template.id, template_name=template.template_name,
                    status=template.meta_status, organization_id=template.organization_id)
                results.append({
                    "success": True, "template_id": template.id,
                    "template_name": template.template_name,
                    "meta_status": template.meta_status,
                    "message": f"Status updated: {template.meta_status}",
                })
        except Exception as e:
            results.append({
                "success": False, "template_id": template.id,
                "template_name": template.template_name,
                "message": str(e),
            })

    db.close()

    return {"results": results}

@router.get("/activity/recent")
def get_recent_activities(limit: int = 5):
    """Get recent template activities"""
    db = SessionLocal()

    try:
        activities = db.query(ActivityLog).order_by(
            ActivityLog.created_at.desc()
        ).limit(limit).all()

        result = []
        for activity in activities:
            result.append({
                "id": activity.id,
                "action": activity.action,
                "template_id": activity.template_id,
                "template_name": activity.template_name,
                "status": activity.status,
                "created_at": activity.created_at.isoformat() + "Z" if activity.created_at else None,
                "timestamp": activity.created_at.isoformat() + "Z" if activity.created_at else None
            })

        db.close()
        return result

    except Exception as e:
        db.close()
        return {
            "success": False,
            "error": str(e)
        }
