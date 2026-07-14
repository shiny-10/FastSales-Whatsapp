from core.config import settings
from fastapi import APIRouter
from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template
from services.meta_service import MetaWhatsAppService
from datetime import datetime

router = APIRouter()

meta_service = MetaWhatsAppService(
    settings.ACCESS_TOKEN,
    settings.PHONE_NUMBER_ID
)

@router.post("/create-campaign")
def create_campaign(data: dict):
    db = SessionLocal()

    try:
        template = db.query(Template).filter(
            Template.id == data["template_id"]
        ).first()

        if not template:
            return {
                "success": False,
                "message": "Template not found"
            }

        campaign = Campaign(
            campaign_name=data["campaign_name"],
            template_id=data["template_id"],
            organization_id=data["organization_id"],
            status="scheduled" if data.get("schedule_time") else "running",
            schedule_time=datetime.fromisoformat(
                data["schedule_time"]
            ) if data.get("schedule_time") else None
        )

        db.add(campaign)
        db.commit()
        db.refresh(campaign)

        # Scheduled Campaign
        if data.get("schedule_time"):

            for contact_id in data["contact_ids"]:

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

        for contact_id in data["contact_ids"]:

            contact = db.query(Contact).filter(
                Contact.id == contact_id
            ).first()

            if not contact:
                continue

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

            result = meta_service.send_text_message(
                phone,
                template.template_name
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
                status="sent",
                message_id=message_id
            )

            db.add(rec)

            results.append({
                "contact_id": contact.id,
                "phone": phone,
                "message_id": message_id
            })

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
def update_campaign(campaign_id: int, data: dict):
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

        # Update campaign name if provided
        if "campaign_name" in data:
            campaign.campaign_name = data["campaign_name"]

        # Update template if provided
        if "template_id" in data:
            template = db.query(Template).filter(
                Template.id == data["template_id"]
            ).first()
            if not template:
                return {
                    "success": False,
                    "error": "Template not found"
                }
            campaign.template_id = data["template_id"]

        # Update contacts if provided
        if "contact_ids" in data:
            # Delete existing campaign contacts
            db.query(CampaignContact).filter(
                CampaignContact.campaign_id == campaign_id
            ).delete()

            # Add new campaign contacts
            for contact_id in data["contact_ids"]:
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

    sent = len([
        r for r in recipients
        if r.status == "sent"
    ])

    delivered = len([
        r for r in recipients
        if r.status == "delivered"
    ])

    read = len([
        r for r in recipients
        if r.status == "read"
    ])

    failed = len([
        r for r in recipients
        if r.status == "failed"
    ])

    # Get contact count from CampaignContact
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

@router.post("/run-campaign")
def run_campaign(data: dict):
    db = SessionLocal()
    try:
        campaign_id = data.get("campaign_id")
        template_name = data.get("template_name")

        if not campaign_id or not template_name:
            return {
                "success": False,
                "error": "Campaign ID and template name are required"
            }

        campaign = db.query(Campaign).filter(
            Campaign.id == campaign_id
        ).first()

        if not campaign:
            return {
                "success": False,
                "error": "Campaign not found"
            }

        template = db.query(Template).filter(
            Template.template_name == template_name
        ).first()

        if not template:
            return {
                "success": False,
                "error": "Template not found"
            }

        # Get all contacts associated with this campaign
        campaign_contacts = db.query(CampaignContact).filter(
            CampaignContact.campaign_id == campaign_id
        ).all()

        results = []
        for campaign_contact in campaign_contacts:
            contact = db.query(Contact).filter(
                Contact.id == campaign_contact.contact_id
            ).first()

            if not contact:
                continue

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

            result = meta_service.send_template_message(
                phone,
                template_name
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
                organization_id=campaign.organization_id
            )

            db.add(msg)

            rec = CampaignRecipient(
                campaign_id=campaign.id,
                phone_number=phone,
                status="sent",
                message_id=message_id
            )

            db.add(rec)

            results.append({
                "contact_id": contact.id,
                "phone": phone,
                "message_id": message_id
            })

        db.commit()

        return {
            "success": True,
            "campaign_id": campaign.id,
            "message_count": len(results),
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