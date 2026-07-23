from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template
from routes.deps import get_current_user
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CampaignCreate(BaseModel):
    campaign_name: str
    template_id: int
    contact_ids: List[int]
    schedule_time: Optional[str] = None


class CampaignUpdate(BaseModel):
    campaign_name: Optional[str] = None
    template_id: Optional[int] = None
    contact_ids: Optional[List[int]] = None


def _meta_service(db: Session) -> MetaWhatsAppService:
    account = WhatsAppService(db).get_account()
    if not account or not account.access_token or not account.phone_number_id:
        raise ValueError("WhatsApp account not connected. Go to Settings → Configuration.")
    return MetaWhatsAppService(
        access_token=account.access_token,
        phone_number_id=account.phone_number_id,
    )


@router.post("/create-campaign")
def create_campaign(
    data: CampaignCreate = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    template = db.query(Template).filter(Template.id == data.template_id).first()
    if not template:
        return {"success": False, "message": "Template not found"}

    campaign = Campaign(
        campaign_name=data.campaign_name,
        template_id=data.template_id,
        status="scheduled" if data.schedule_time else "running",
        schedule_time=datetime.fromisoformat(data.schedule_time) if data.schedule_time else None,
    )

    db.add(campaign)
    db.commit()
    db.refresh(campaign)

    if data.schedule_time:
        for contact_id in data.contact_ids:
            campaign_contact = CampaignContact(campaign_id=campaign.id, contact_id=contact_id)
            db.add(campaign_contact)
        db.commit()
        return {
            "success": True,
            "campaign_id": campaign.id,
            "message": "Campaign scheduled successfully",
        }

    results = []
    try:
        meta = _meta_service(db)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    for contact_id in data.contact_ids:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            continue

        existing_cc = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign.id,
            CampaignContact.contact_id == contact_id,
        ).first()
        if not existing_cc:
            db.add(CampaignContact(campaign_id=campaign.id, contact_id=contact_id))

        phone = contact.phone_number
        message_text = template.template_body or ""
        message_text = message_text.replace("{{name}}", contact.name or "")

        result = meta.send_template_message(
            phone,
            template.template_name,
            language_code=template.language or "en_US",
        )

        message_id = None
        if result.get("messages"):
            message_id = result["messages"][0].get("id")

        msg = MessageLog(
            message_id=message_id,
            phone_number=phone,
            text=message_text,
            direction="outgoing",
            status="sent",
        )
        db.add(msg)

        rec = CampaignRecipient(
            campaign_id=campaign.id,
            phone_number=phone,
            contact_id=contact.id,
            status="sent",
            message_id=message_id,
        )
        db.add(rec)

        # ── Record to WhatsApp Inbox for live inbox & incoming reply tracking ──
        try:
            from services.conversation_service import ConversationService
            ConversationService(db).record_outgoing_inbox_message(
                customer_phone=phone,
                content=message_text,
                message_type="TEMPLATE",
                meta_message_id=message_id,
                customer_name=contact.name if contact else None,
            )
        except Exception as e:
            print(f"[create_campaign] Error recording to inbox: {e}")

        results.append({"contact_id": contact.id, "phone": phone, "message_id": message_id})

    campaign.status = "completed"
    db.commit()

    return {"success": True, "campaign_id": campaign.id, "results": results}


@router.get("/details/{campaign_id}")
def get_campaign_details(
    campaign_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "error": "Campaign not found"}

    campaign_contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).all()
    contact_ids = [cc.contact_id for cc in campaign_contacts]

    return {
        "success": True,
        "campaign": {
            "id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "template_id": campaign.template_id,
            "status": campaign.status,
            "contact_ids": contact_ids,
        },
    }


@router.put("/update/{campaign_id}")
def update_campaign(
    campaign_id: int,
    data: CampaignUpdate = Body(...),
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "error": "Campaign not found"}

    if data.campaign_name is not None:
        campaign.campaign_name = data.campaign_name

    if data.template_id is not None:
        template = db.query(Template).filter(Template.id == data.template_id).first()
        if not template:
            return {"success": False, "error": "Template not found"}
        campaign.template_id = data.template_id

    if data.contact_ids is not None:
        db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).delete(synchronize_session=False)
        for contact_id in set(data.contact_ids):
            db.add(CampaignContact(campaign_id=campaign_id, contact_id=contact_id))

    db.commit()
    db.refresh(campaign)

    return {
        "success": True,
        "message": "Campaign updated successfully",
        "campaign": {
            "id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "template_id": campaign.template_id,
            "status": campaign.status,
        },
    }


@router.get("/list")
def list_campaigns(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    result = []
    for campaign in campaigns:
        contact_count = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign.id).count()
        template = db.query(Template).filter(Template.id == campaign.template_id).first()
        result.append({
            "id": campaign.id,
            "campaign_name": campaign.campaign_name,
            "status": campaign.status,
            "contact_count": contact_count,
            "created_at": campaign.created_at,
            "template_id": campaign.template_id,
            "template_name": template.template_name if template else "Unknown",
        })
    return {"success": True, "campaigns": result}


@router.get("/{campaign_id}")
def get_campaign(
    campaign_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "message": "Campaign not found"}

    return {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "status": campaign.status,
        "created_at": campaign.created_at,
    }


@router.get("/{campaign_id}/analytics")
def campaign_analytics(
    campaign_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "message": "Campaign not found"}

    recipients = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == campaign_id).all()
    total_recipients = len(recipients)

    sent = len([r for r in recipients if r.status == "sent"])
    delivered = len([r for r in recipients if r.status == "delivered"])
    read = len([r for r in recipients if r.status == "read"])
    failed = len([r for r in recipients if r.status == "failed"])
    contact_count = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).count()

    return {
        "campaign_id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "contact_count": contact_count,
        "total_recipients": total_recipients,
        "sent": sent,
        "delivered": delivered,
        "read": read,
        "failed": failed,
    }


@router.get("/{campaign_id}/recipients")
def campaign_recipients(
    campaign_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "message": "Campaign not found"}

    template = db.query(Template).filter(Template.id == campaign.template_id).first()
    recipients = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == campaign_id).all()

    phone_set = {r.phone_number for r in recipients}
    msg_logs = db.query(MessageLog).filter(MessageLog.phone_number.in_(phone_set)).order_by(MessageLog.created_at.desc()).all()
    latest_log: dict[str, MessageLog] = {}
    for log in msg_logs:
        if log.phone_number not in latest_log:
            latest_log[log.phone_number] = log

    contact_lookup: dict[str, Contact] = {}
    if recipients:
        contact_ids = [r.contact_id for r in recipients if r.contact_id]
        contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
        for c in contacts:
            contact_lookup[str(c.id)] = c

    rows = []
    for r in recipients:
        contact = contact_lookup.get(str(r.contact_id)) if r.contact_id else None
        log = latest_log.get(r.phone_number)
        effective_status = (log.status if log else r.status) or "sent"

        rows.append({
            "contact_id": r.contact_id,
            "contact_name": contact.name if contact else None,
            "phone_number": r.phone_number,
            "message_id": r.message_id,
            "status": effective_status,
            "sent_at": log.created_at.isoformat() + "Z" if log and log.created_at else (
                r.created_at.isoformat() + "Z" if r.created_at else None
            ),
        })

    statuses = [row["status"] for row in rows]
    summary = {
        "total": len(rows),
        "sent": statuses.count("sent"),
        "delivered": statuses.count("delivered"),
        "read": statuses.count("read"),
        "failed": statuses.count("failed"),
        "pending": statuses.count("pending"),
    }

    return {
        "success": True,
        "campaign_id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "campaign_status": campaign.status,
        "template_name": template.template_name if template else None,
        "created_at": campaign.created_at.isoformat() + "Z" if campaign.created_at else None,
        "summary": summary,
        "recipients": rows,
    }


@router.post("/run-campaign")
def run_campaign(
    data: dict,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign_id = data.get("campaign_id")
    if not campaign_id:
        return {"success": False, "error": "campaign_id is required"}

    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "error": "Campaign not found"}

    if not campaign.template_id:
        return {"success": False, "error": "Campaign has no template assigned"}

    template = db.query(Template).filter(Template.id == campaign.template_id).first()
    if not template:
        return {"success": False, "error": "Template not found"}

    template_name = (template.meta_template_name or template.template_name or "").lower().replace(" ", "_").replace("-", "_")
    language_code = template.language or "en_US"

    campaign_contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).all()
    if not campaign_contacts:
        return {"success": False, "error": "No contacts in this campaign"}

    try:
        meta = _meta_service(db)
    except ValueError as e:
        return {"success": False, "error": str(e)}

    results = []
    sent_count = 0
    failed_count = 0

    for cc in campaign_contacts:
        contact = db.query(Contact).filter(Contact.id == cc.contact_id).first()
        if not contact or not contact.phone_number:
            failed_count += 1
            continue

        phone = contact.phone_number
        result = meta.send_template_message(
            to=phone,
            template_name=template_name,
            language_code=language_code,
        )

        message_id = None
        status_val = "failed"
        if result.get("messages"):
            message_id = result["messages"][0].get("id")
            status_val = "sent"
            sent_count += 1
        else:
            failed_count += 1

        msg = MessageLog(
            message_id=message_id,
            phone_number=phone,
            text=f"[Template: {template_name}]",
            direction="outgoing",
            status=status_val,
        )
        db.add(msg)

        existing_rec = db.query(CampaignRecipient).filter(
            CampaignRecipient.campaign_id == campaign.id,
            CampaignRecipient.phone_number == phone,
        ).first()

        if existing_rec:
            existing_rec.status = status_val
            existing_rec.message_id = message_id
        else:
            rec = CampaignRecipient(
                campaign_id=campaign.id,
                contact_id=contact.id,
                phone_number=phone,
                status=status_val,
                message_id=message_id,
            )
            db.add(rec)

        # ── Record to WhatsApp Inbox for live inbox & incoming reply tracking ──
        try:
            from services.conversation_service import ConversationService
            ConversationService(db).record_outgoing_inbox_message(
                customer_phone=phone,
                content=template.template_body or f"[Template: {template_name}]",
                message_type="TEMPLATE",
                meta_message_id=message_id,
                customer_name=contact.name if contact else None,
            )
        except Exception as e:
            print(f"[execute_campaign] Error recording to inbox: {e}")

        results.append({
            "contact_id": contact.id,
            "phone": phone,
            "status": status_val,
            "message_id": message_id,
        })

    campaign.status = "completed"
    db.commit()

    return {
        "success": True,
        "campaign_id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "template_name": template_name,
        "total": len(results),
        "sent": sent_count,
        "failed": failed_count,
        "results": results,
    }


@router.delete("/delete/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        return {"success": False, "error": "Campaign not found"}

    db.query(CampaignContact).filter(CampaignContact.campaign_id == campaign_id).delete()
    db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == campaign_id).delete()
    db.delete(campaign)
    db.commit()

    return {"success": True, "message": "Campaign deleted successfully"}