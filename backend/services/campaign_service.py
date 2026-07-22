from __future__ import annotations
from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService

from datetime import datetime


def _meta_service_for_org(org_id: int, db) -> MetaWhatsAppService:
    """
    Build a MetaWhatsAppService from the DB account for the given org.
    Raises ValueError if the account is missing or incomplete.
    Never reads credentials from .env.
    """
    account = WhatsAppService(db).get_account(org_id)
    if not account or not account.access_token or not account.phone_number_id:
        raise ValueError(
            f"WhatsApp account for org {org_id} is not configured. "
            "Go to Settings → Configuration to connect."
        )
    return MetaWhatsAppService(
        access_token=account.access_token,
        phone_number_id=account.phone_number_id,
    )


def process_scheduled_campaigns():

    print("Scheduler Tick:", datetime.now())

    db = SessionLocal()

    try:
        campaigns = db.query(Campaign).filter(
            Campaign.status == "scheduled"
        ).all()

        for campaign in campaigns:

            print("Campaign ID:", campaign.id)
            print("Campaign Name:", campaign.campaign_name)
            print("Schedule Time:", campaign.schedule_time)
            print("Current Time:", datetime.now())
            print("-------------------------")

            if (
                campaign.schedule_time
                and campaign.schedule_time <= datetime.utcnow()
            ):
                print(f"Running Campaign: {campaign.campaign_name}")

                # Build a fresh service from DB credentials for this org.
                # Done inside the loop so each campaign uses its own org's account.
                try:
                    meta_service = _meta_service_for_org(campaign.organization_id, db)
                except ValueError as e:
                    print(f"Skipping campaign {campaign.id}: {e}")
                    continue

                template = db.query(Template).filter(
                    Template.id == campaign.template_id
                ).first()

                campaign_contacts = db.query(CampaignContact).filter(
                    CampaignContact.campaign_id == campaign.id
                ).all()

                for cc in campaign_contacts:

                    contact = db.query(Contact).filter(
                        Contact.id == cc.contact_id
                    ).first()

                    if not contact:
                        continue

                    phone = contact.phone_number
                    message_text = template.template_body
                    message_text = message_text.replace("{{name}}", contact.name or "")

                    result = meta_service.send_text_message(phone, message_text)
                    print(result)

                    message_id = None
                    if result.get("messages"):
                        message_id = result["messages"][0].get("id")

                    log = MessageLog(
                        message_id=message_id,
                        phone_number=phone,
                        text=message_text,
                        direction="outgoing",
                        status="sent",
                        organization_id=campaign.organization_id,
                    )
                    db.add(log)

                    recipient = CampaignRecipient(
                        campaign_id=campaign.id,
                        phone_number=phone,
                        status="sent",
                        message_id=message_id,
                    )
                    db.add(recipient)

                campaign.status = "completed"

        db.commit()

    except Exception as e:
        print("Scheduler Error:", str(e))
        db.rollback()

    finally:
        db.close()
