from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import SessionLocal
from models.postgres_model import (
    Campaign,
    CampaignContact,
    CampaignRecipient,
    Contact,
    MessageLog,
    Template,
    WhatsAppInboxMessage,
)
from routes.deps import get_current_user

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("", response_model=dict)
def get_unified_dashboard(
    user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consolidated endpoint returning all dashboard metrics in 1 HTTP call."""
    total_contacts = db.query(Contact).count()
    total_templates = db.query(Template).count()
    total_campaigns = db.query(Campaign).count()

    ml_total = db.query(MessageLog).count()
    ml_sent = db.query(MessageLog).filter(MessageLog.status == "sent").count()
    ml_delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    ml_read = db.query(MessageLog).filter(MessageLog.status == "read").count()
    ml_failed = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    wm_sent = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "SENT").count()
    wm_delivered = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "DELIVERED").count()
    wm_read = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "READ").count()
    wm_failed = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "FAILED").count()
    wm_total = wm_sent + wm_delivered + wm_read + wm_failed

    total_messages = ml_total + wm_total
    sent = ml_sent + wm_sent
    delivered = ml_delivered + wm_delivered
    read = ml_read + wm_read
    failed = ml_failed + wm_failed

    # Template Overview
    approved = db.query(Template).filter(Template.meta_status == "APPROVED").count()
    pending = db.query(Template).filter(Template.meta_status == "PENDING").count()
    rejected = db.query(Template).filter(Template.meta_status == "REJECTED").count()
    disabled = db.query(Template).filter(Template.meta_status == "DISABLED").count()

    # Recent Campaigns
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).limit(10).all()
    campaign_list = []
    for c in campaigns:
        c_total = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c.id).count()
        c_delivered = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c.id, CampaignRecipient.status == "delivered").count()
        c_contacts = db.query(CampaignContact).filter(CampaignContact.campaign_id == c.id).count()
        campaign_list.append({
            "id": c.id,
            "name": c.campaign_name,
            "status": c.status,
            "total": c_total,
            "delivered": c_delivered,
            "contact_count": c_contacts,
        })

    return {
        "summary": {
            "total_contacts": total_contacts,
            "total_templates": total_templates,
            "total_campaigns": total_campaigns,
            "total_messages": total_messages,
            "sent": sent,
            "delivered": delivered,
            "read": read,
            "failed": failed,
        },
        "templates": {
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "disabled": disabled,
        },
        "campaigns": campaign_list,
    }


@router.get("/overview")
def get_overview(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    total_campaigns = db.query(Campaign).count()
    total_messages = db.query(MessageLog).count()
    delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    read = db.query(MessageLog).filter(MessageLog.status == "read").count()
    failed = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    return {
        "total_campaigns": total_campaigns,
        "total_messages": total_messages,
        "delivered": delivered,
        "read": read,
        "failed": failed,
    }


@router.get("/summary")
def dashboard_summary(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    total_contacts = db.query(Contact).count()
    total_templates = db.query(Template).count()
    total_campaigns = db.query(Campaign).count()

    ml_total = db.query(MessageLog).count()
    ml_sent = db.query(MessageLog).filter(MessageLog.status == "sent").count()
    ml_delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    ml_read = db.query(MessageLog).filter(MessageLog.status == "read").count()
    ml_failed = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    wm_sent = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "SENT").count()
    wm_delivered = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "DELIVERED").count()
    wm_read = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "READ").count()
    wm_failed = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "FAILED").count()
    wm_total = wm_sent + wm_delivered + wm_read + wm_failed

    return {
        "total_contacts": total_contacts,
        "total_templates": total_templates,
        "total_campaigns": total_campaigns,
        "total_messages": ml_total + wm_total,
        "sent": ml_sent + wm_sent,
        "delivered": ml_delivered + wm_delivered,
        "read": ml_read + wm_read,
        "failed": ml_failed + wm_failed,
    }


@router.get("/campaigns")
def get_campaigns(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).all()
    result = []
    for c in campaigns:
        total = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c.id).count()
        delivered = db.query(CampaignRecipient).filter(CampaignRecipient.campaign_id == c.id, CampaignRecipient.status == "delivered").count()
        contact_count = db.query(CampaignContact).filter(CampaignContact.campaign_id == c.id).count()

        result.append({
            "id": c.id,
            "name": c.campaign_name,
            "status": c.status,
            "total": total,
            "delivered": delivered,
            "contact_count": contact_count,
        })
    return result


@router.get("/template-overview")
def template_overview(user: dict = Depends(get_current_user), db: Session = Depends(get_db)):
    approved = db.query(Template).filter(Template.meta_status == "APPROVED").count()
    pending = db.query(Template).filter(Template.meta_status == "PENDING").count()
    rejected = db.query(Template).filter(Template.meta_status == "REJECTED").count()
    disabled = db.query(Template).filter(Template.meta_status == "DISABLED").count()

    return {
        "approved": approved,
        "pending": pending,
        "rejected": rejected,
        "disabled": disabled,
    }