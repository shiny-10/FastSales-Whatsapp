from fastapi import APIRouter
from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template, WhatsAppInboxMessage

router = APIRouter()

# -----------------------------
# 1. OVERVIEW (Main dashboard cards)
# -----------------------------
@router.get("/overview")
def get_overview():
    db = SessionLocal()

    total_campaigns = db.query(Campaign).count()
    total_messages = db.query(MessageLog).count()

    delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    read = db.query(MessageLog).filter(MessageLog.status == "read").count()
    failed = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    db.close()

    return {
        "total_campaigns": total_campaigns,
        "total_messages": total_messages,
        "delivered": delivered,
        "read": read,
        "failed": failed
    }

# -----------------------------
# 2. CAMPAIGN LIST
# -----------------------------
@router.get("/campaigns")
def get_campaigns():
    db = SessionLocal()

    campaigns = db.query(Campaign).all()

    result = []

    for c in campaigns:
        total = db.query(CampaignRecipient).filter(
            CampaignRecipient.campaign_id == c.id
        ).count()

        delivered = db.query(CampaignRecipient).filter(
            CampaignRecipient.campaign_id == c.id,
            CampaignRecipient.status == "delivered"
        ).count()

        # Get contact count from CampaignContact
        contact_count = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == c.id
        ).count()

        result.append({
            "id": c.id,
            "name": c.campaign_name,
            "status": c.status,
            "total": total,
            "delivered": delivered,
            "contact_count": contact_count
        })

    db.close()
    return result

# -----------------------------
# 3. CAMPAIGN DETAILS
# -----------------------------
@router.get("/campaign/{campaign_id}")
def campaign_details(campaign_id: int):
    db = SessionLocal()

    recipients = db.query(CampaignRecipient).filter(
        CampaignRecipient.campaign_id == campaign_id
    ).all()

    db.close()

    return [
        {
            "phone": r.phone_number,
            "status": r.status,
            "message_id": r.message_id
        }
        for r in recipients
    ]

# -----------------------------
# 4. MESSAGE ANALYTICS
# -----------------------------
@router.get("/analytics/messages")
def message_analytics():
    db = SessionLocal()

    # Count from BOTH MessageLog (campaigns) AND WhatsAppInboxMessage (inbox)
    # WhatsAppInboxMessage statuses are uppercase: SENT, DELIVERED, READ, FAILED
    # MessageLog statuses are lowercase: sent, delivered, read, failed

    ml_total     = db.query(MessageLog).count()
    ml_sent      = db.query(MessageLog).filter(MessageLog.status == "sent").count()
    ml_delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    ml_read      = db.query(MessageLog).filter(MessageLog.status == "read").count()
    ml_failed    = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    # Only count AGENT outbound inbox messages
    wm_sent      = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "SENT").count()
    wm_delivered = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "DELIVERED").count()
    wm_read      = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "READ").count()
    wm_failed    = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "FAILED").count()
    wm_total     = wm_sent + wm_delivered + wm_read + wm_failed

    total     = ml_total + wm_total
    sent      = ml_sent + wm_sent
    delivered = ml_delivered + wm_delivered
    read      = ml_read + wm_read
    failed    = ml_failed + wm_failed

    delivery_rate = (delivered / total * 100) if total else 0
    read_rate     = (read / total * 100)      if total else 0
    failure_rate  = (failed / total * 100)    if total else 0

    db.close()

    return {
        "total_messages": total,
        "status_breakdown": {"sent": sent, "delivered": delivered, "read": read, "failed": failed},
        "delivery_rate": round(delivery_rate, 2),
        "read_rate":     round(read_rate, 2),
        "failure_rate":  round(failure_rate, 2),
    }

@router.get("/summary")
def dashboard_summary():
    db = SessionLocal()

    total_contacts  = db.query(Contact).count()
    total_templates = db.query(Template).count()
    total_campaigns = db.query(Campaign).count()

    # MessageLog (campaigns/legacy)
    ml_total     = db.query(MessageLog).count()
    ml_sent      = db.query(MessageLog).filter(MessageLog.status == "sent").count()
    ml_delivered = db.query(MessageLog).filter(MessageLog.status == "delivered").count()
    ml_read      = db.query(MessageLog).filter(MessageLog.status == "read").count()
    ml_failed    = db.query(MessageLog).filter(MessageLog.status == "failed").count()

    # WhatsAppInboxMessage (inbox — agent outbound only)
    wm_sent      = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "SENT").count()
    wm_delivered = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "DELIVERED").count()
    wm_read      = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "READ").count()
    wm_failed    = db.query(WhatsAppInboxMessage).filter(WhatsAppInboxMessage.sender_type == "AGENT", WhatsAppInboxMessage.status == "FAILED").count()
    wm_total     = wm_sent + wm_delivered + wm_read + wm_failed

    db.close()

    return {
        "total_contacts":  total_contacts,
        "total_templates": total_templates,
        "total_campaigns": total_campaigns,
        "total_messages":  ml_total + wm_total,
        "sent":            ml_sent      + wm_sent,
        "delivered":       ml_delivered + wm_delivered,
        "read":            ml_read      + wm_read,
        "failed":          ml_failed    + wm_failed,
    }

@router.get("/messages")
def message_history():
    db = SessionLocal()

    messages = db.query(MessageLog).all()

    result = []

    for msg in messages:
        result.append({
            "id": msg.id,
            "phone_number": msg.phone_number,
            "text": msg.text,
            "status": msg.status,
            "direction": msg.direction,
            "message_id": msg.message_id,
            "created_at": msg.created_at,
        })

    db.close()

    return result

@router.get("/template-overview")
def template_overview():
    db = SessionLocal()

    approved = db.query(Template).filter(
        Template.meta_status == "APPROVED"
    ).count()

    pending = db.query(Template).filter(
        Template.meta_status == "PENDING"
    ).count()

    rejected = db.query(Template).filter(
        Template.meta_status == "REJECTED"
    ).count()

    disabled = db.query(Template).filter(
        Template.meta_status == "DISABLED"
    ).count()

    db.close()

    return {
        "approved": approved,
        "pending": pending,
        "rejected": rejected,
        "disabled": disabled
    }