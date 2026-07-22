from typing import List, Optional

from fastapi import APIRouter, Body
from pydantic import BaseModel
from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService
from datetime import datetime

router = APIRouter()

class CampaignCreate(BaseModel):
    campaign_name: str
    template_id: int
    organization_id: int
    contact_ids: List[int]
    schedule_time: Optional[str] = None

class CampaignUpdate(BaseModel):
    campaign_name: Optional[str] = None
    template_id: Optional[int] = None
    contact_ids: Optional[List[int]] = None


def _meta_service_for_org(org_id: int, db) -> MetaWhatsAppService:
    """Build MetaWhatsAppService from DB credentials.  Never reads .env."""
    account = WhatsAppService(db).get_account(org_id)
    if not account or not account.access_token or not account.phone_number_id:
        raise ValueError(
            "WhatsApp account not connected. Go to Settings → Configuration."
        )
    return MetaWhatsAppService(
        access_token=account.access_token,
        phone_number_id=account.phone_number_id,
    )

@router.post("/create-campaign")
def create_campaign(data: CampaignCreate = Body(...)):
    db = SessionLocal()

    try:
        template = db.query(Template).filter(
            Template.id == data.template_id
        ).first()

        if not template:
            db.close()
            return {
                "success": False,
                "message": "Template not found"
            }

        campaign = Campaign(
            campaign_name=data.campaign_name,
            template_id=data.template_id,
            organization_id=data.organization_id,
            status="scheduled" if data.schedule_time else "running",
            schedule_time=datetime.fromisoformat(data.schedule_time) if data.schedule_time else None
        )

        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        # Scheduled Campaign
        if data.schedule_time:

            for contact_id in data.contact_ids:

                campaign_contact = CampaignContact(
                    campaign_id=campaign.id,
                    contact_id=contact_id
                )

                db.add(campaign_contact)

            db.commit()

            return {
                "success": True,
                "campaign_id": campaign.id,
                "message": "Campaign scheduled successfully"
            }

        results = []

        # Build Meta service once from DB for this org (per-request, not global)
        try:
            meta = _meta_service_for_org(data.organization_id, db)
        except ValueError as e:
            return {"success": False, "error": str(e)}

        for contact_id in data.contact_ids:

            contact = db.query(Contact).filter(
                Contact.id == contact_id
            ).first()

            if not contact:
                continue

            # Always add to CampaignContact so Contacts count is correct
            existing_cc = db.query(CampaignContact).filter(
                CampaignContact.campaign_id == campaign.id,
                CampaignContact.contact_id == contact_id,
            ).first()
            if not existing_cc:
                db.add(CampaignContact(campaign_id=campaign.id, contact_id=contact_id))

            phone = contact.phone_number

            message_text = template.template_body

            message_text = message_text.replace(
                "{{name}}",
                contact.name or ""
            )

            message_text = message_text.replace(
                "{{order_id}}",
                getattr(contact, "order_id", "") or ""
            )

            result = meta.send_template_message(
                phone,
                template.template_name,
                language_code=template.language or "en_US",
            )

            print(result)

            message_id = None

            if result.get("messages"):
                message_id = result["messages"][0].get("id")

            msg = MessageLog(
                message_id=message_id,
                phone_number=phone,
                text=message_text,
                direction="outgoing",
                status="sent",
                organization_id=campaign.organization_id
            )

            db.add(msg)

            rec = CampaignRecipient(
                campaign_id=campaign.id,
                phone_number=phone,
                contact_id=contact.id,
                status="sent",
                message_id=message_id
            )

            db.add(rec)

            results.append({
                "contact_id": contact.id,
                "phone": phone,
                "message_id": message_id
            })

        # Mark completed after all messages sent
        campaign.status = "completed"
        db.commit()

        return {
            "success": True,
            "campaign_id": campaign.id,
            "results": results
        }

    except Exception as e:
        db.rollback()

        return {
            "success": False,
            "error": str(e)
        }

    finally:
        db.close()

@router.get("/details/{campaign_id}")
def get_campaign_details(campaign_id: int):
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id
        ).first()

        if not campaign:
            return {
                "success": False,
                "error": "Campaign not found"
            }

        # Get all contacts associated with this campaign
        campaign_contacts = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).all()

        contact_ids = [cc.contact_id for cc in campaign_contacts]

        return {
            "success": True,
            "campaign": {
                "id": campaign.id,
                "campaign_name": campaign.campaign_name,
                "template_id": campaign.template_id,
                "status": campaign.status,
                "contact_ids": contact_ids,
                "organization_id": campaign.organization_id
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

@router.put("/update/{campaign_id}")
def update_campaign(campaign_id: int, data: CampaignUpdate = Body(...)):
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id
        ).first()

        if not campaign:
            db.close()
            return {
                "success": False,
                "error": "Campaign not found"
            }

        if data.campaign_name is not None:
            campaign.campaign_name = data.campaign_name

        if data.template_id is not None:
            template = db.query(Template).filter(
                Template.id == data.template_id
            ).first()
            if not template:
                db.close()
                return {
                    "success": False,
                    "error": "Template not found"
                }
            campaign.template_id = data.template_id

        if data.contact_ids is not None:
            db.query(CampaignContact).filter(
                CampaignContact.campaign_id == campaign_id
            ).delete()

            for contact_id in data.contact_ids:
                campaign_contact = CampaignContact(
                    campaign_id=campaign_id,
                    contact_id=contact_id
                )
                db.add(campaign_contact)

        db.commit()
        db.refresh(campaign)

        return {
            "success": True,
            "message": "Campaign updated successfully",
            "campaign": {
                "id": campaign.id,
                "campaign_name": campaign.campaign_name,
                "template_id": campaign.template_id,
                "status": campaign.status
            }
        }
    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

@router.get("/list")
def list_campaigns():
    db = SessionLocal()
    try:
        campaigns = db.query(Campaign).all()
        result = []
        for campaign in campaigns:
            contact_count = db.query(CampaignContact).filter(
                CampaignContact.campaign_id == campaign.id
            ).count()
            # Get template information
            template = db.query(Template).filter(
                Template.id == campaign.template_id
            ).first()
            result.append({
                "id": campaign.id,
                "campaign_name": campaign.campaign_name,
                "status": campaign.status,
                "contact_count": contact_count,
                "created_at": campaign.created_at,
                "template_id": campaign.template_id,
                "template_name": template.template_name if template else "Unknown"
            })
        return {
            "success": True,
            "campaigns": result
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()

@router.get("/{campaign_id}")
def get_campaign(campaign_id: int):
    db = SessionLocal()

    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id
    ).first()

    if not campaign:
        db.close()
        return {
            "success": False,
            "message": "Campaign not found"
        }

    result = {
        "id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "status": campaign.status,
        "created_at": campaign.created_at
    }

    db.close()

    return result

@router.get("/{campaign_id}/analytics")
def campaign_analytics(campaign_id: int):
    db = SessionLocal()

    campaign = db.query(Campaign).filter(
        Campaign.id == campaign_id
    ).first()

    if not campaign:
        db.close()
        return {
            "success": False,
            "message": "Campaign not found"
        }

    recipients = db.query(CampaignRecipient).filter(
        CampaignRecipient.campaign_id == campaign_id
    ).all()

    total_recipients = len(recipients)

    sent = len([r for r in recipients if r.status == "sent"])
    delivered = len([r for r in recipients if r.status == "delivered"])
    read = len([r for r in recipients if r.status == "read"])
    failed = len([r for r in recipients if r.status == "failed"])

    contact_count = db.query(CampaignContact).filter(
        CampaignContact.campaign_id == campaign_id
    ).count()

    db.close()

    return {
        "campaign_id": campaign.id,
        "campaign_name": campaign.campaign_name,
        "contact_count": contact_count,
        "total_recipients": total_recipients,
        "sent": sent,
        "delivered": delivered,
        "read": read,
        "failed": failed
    }


@router.get("/{campaign_id}/recipients")
def campaign_recipients(campaign_id: int):
    """
    Returns per-contact delivery breakdown with full status details.
    Statuses: sent (single tick), delivered (double grey), read (blue ticks), failed
    """
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if not campaign:
            return {"success": False, "message": "Campaign not found"}

        template = db.query(Template).filter(Template.id == campaign.template_id).first()

        recipients = (
            db.query(CampaignRecipient)
            .filter(CampaignRecipient.campaign_id == campaign_id)
            .all()
        )

        # Build a lookup: phone → latest MessageLog status (updated by webhook)
        phone_set = {r.phone_number for r in recipients}
        msg_logs = (
            db.query(MessageLog)
            .filter(MessageLog.phone_number.in_(phone_set))
            .order_by(MessageLog.created_at.desc())
            .all()
        )
        # Use the most recent log per phone
        latest_log: dict[str, MessageLog] = {}
        for log in msg_logs:
            if log.phone_number not in latest_log:
                latest_log[log.phone_number] = log

        # Build contact lookup
        contact_lookup: dict[str, Contact] = {}
        if recipients:
            contact_ids = [r.contact_id for r in recipients if r.contact_id]
            contacts = db.query(Contact).filter(Contact.id.in_(contact_ids)).all()
            for c in contacts:
                contact_lookup[str(c.id)] = c

        # Aggregate
        rows = []
        for r in recipients:
            contact = contact_lookup.get(str(r.contact_id)) if r.contact_id else None
            log = latest_log.get(r.phone_number)

            # Prefer MessageLog status (updated by webhook) over CampaignRecipient status
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

        # Summary counts using effective statuses
        statuses = [row["status"] for row in rows]
        summary = {
            "total":     len(rows),
            "sent":      statuses.count("sent"),
            "delivered": statuses.count("delivered"),
            "read":      statuses.count("read"),
            "failed":    statuses.count("failed"),
            "pending":   statuses.count("pending"),
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
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        db.close()

@router.post("/run-campaign")
def run_campaign(data: dict):
    """
    Send a campaign's template to all its contacts.
    Accepts { campaign_id } — the template is resolved automatically
    from the campaign record, no need to pass template_name.
    """
    db = SessionLocal()
    try:
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

        # Use template_name as stored (sanitized same way as on creation)
        template_name = (template.meta_template_name or template.template_name or "").lower().replace(" ", "_").replace("-", "_")
        language_code = template.language or "en_US"

        # Get all contacts for this campaign
        campaign_contacts = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).all()

        if not campaign_contacts:
            return {"success": False, "error": "No contacts in this campaign"}

        # ── Use DB credentials (from Settings page) ────────────────────────
        try:
            meta = _meta_service_for_org(campaign.organization_id, db)
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

            print(f"[run-campaign] phone={phone} result={result}")

            message_id = None
            status = "failed"
            if result.get("messages"):
                message_id = result["messages"][0].get("id")
                status = "sent"
                sent_count += 1
            else:
                failed_count += 1

            # Log the message
            msg = MessageLog(
                message_id=message_id,
                phone_number=phone,
                text=f"[Template: {template_name}]",
                direction="outgoing",
                status=status,
                organization_id=campaign.organization_id,
            )
            db.add(msg)

            # Upsert recipient — update existing row instead of failing on duplicate
            existing_rec = db.query(CampaignRecipient).filter(
                CampaignRecipient.campaign_id == campaign.id,
                CampaignRecipient.phone_number == phone,
            ).first()

            if existing_rec:
                existing_rec.status = status
                existing_rec.message_id = message_id
            else:
                rec = CampaignRecipient(
                    campaign_id=campaign.id,
                    contact_id=contact.id,
                    phone_number=phone,
                    status=status,
                    message_id=message_id,
                )
                db.add(rec)

            results.append({
                "contact_id": contact.id,
                "phone": phone,
                "status": status,
                "message_id": message_id,
            })

        # Mark campaign as completed
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

    except Exception as e:
        db.rollback()
        return {"success": False, "error": str(e)}
    finally:
        db.close()

@router.delete("/delete/{campaign_id}")
def delete_campaign(campaign_id: int):
    db = SessionLocal()
    try:
        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id
        ).first()

        if not campaign:
            return {
                "success": False,
                "error": "Campaign not found"
            }

        # Delete associated campaign contacts
        db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).delete()

        # Delete associated campaign recipients
        db.query(CampaignRecipient).filter(
            CampaignRecipient.campaign_id == campaign_id
        ).delete()

        # Delete the campaign
        db.delete(campaign)
        db.commit()

        return {
            "success": True,
            "message": "Campaign deleted successfully"
        }
    except Exception as e:
        db.rollback()
        return {
            "success": False,
            "error": str(e)
        }
    finally:
        db.close()