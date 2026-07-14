from fastapi import APIRouter, Request, UploadFile, File
from core.database import SessionLocal
from models.postgres_model import ActivityLog, Organization, Template
from services.template_service import MetaTemplateService
import os
import uuid
import json
meta_template_service = MetaTemplateService()

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

        # Call meta template service asynchronously if needed
        try:
            meta_result = meta_template_service.create_template(
                template_name=template.template_name,
                category=template.category,
                language=template.language,
                body=template.template_body
            )
            if meta_result.get("id"):
                template.meta_template_id = meta_result["id"]
                template.meta_template_name = template.template_name
                template.meta_status = meta_result.get("status", "PENDING")
                db.commit()
        except Exception as e:
            print(f"Meta template creation failed: {e}")

        # Log the activity
        log_activity(
            db,
            action="created",
            template_id=template.id,
            template_name=template.template_name,
            status=template.meta_status or "PENDING",
            organization_id=organization_id
        )

        return {
            "success": True,
            "template_id": template.id,
            "meta_response": {}
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()

@router.get("/")
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
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "meta_status": t.meta_status or "PENDING"
        })

    db.close()

    return result

@router.put("/{template_id}")
def update_template(template_id: int, data: dict):
    db = SessionLocal()

    template = db.query(Template).filter(
        Template.id == template_id
    ).first()

    if not template:
        return {"success": False, "message": "Template not found"}

    template.template_name = data["template_name"]
    template.category = data["category"]    
    template.language = data["language"]
    template.header = data.get("header", "none")
    template.template_body = data["template_body"]
    template.footer = data.get("footer")
    template.buttons = data.get("buttons", [])

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
@router.get("/{template_id}/sync-status")
def sync_template_status(template_id: int):

    db = SessionLocal()

    template = db.query(Template).filter(
        Template.id == template_id
    ).first()

    if not template:
        db.close()

        return {
            "success": False,
            "message": "Template not found"
        }

    if not template.meta_template_id:
        db.close()

        return {
            "success": False,
            "message": "Meta template id missing"
        }

    meta_response = meta_template_service.get_template_status(
        template.meta_template_id
    )

    if meta_response.get("status"):
        template.meta_status = meta_response["status"]

        db.commit()
        
        # Log the sync activity
        log_activity(
            db,
            action="synced",
            template_id=template.id,
            template_name=template.template_name,
            status=template.meta_status,
            organization_id=template.organization_id
        )

    result = {
        "success": True,
        "template_id": template.id,
        "template_name": template.template_name,
        "meta_status": template.meta_status,
        "meta_response": meta_response
    }

    db.close()

    return result

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
                "created_at": activity.created_at.isoformat() if activity.created_at else None,
                "timestamp": activity.created_at.isoformat() if activity.created_at else None
            })

        db.close()
        return result

    except Exception as e:
        db.close()
        return {
            "success": False,
            "error": str(e)
        }