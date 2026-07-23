from __future__ import annotations
from datetime import datetime

from core.database import SessionLocal
from models.postgres_model import Campaign, CampaignContact, CampaignRecipient, Contact, MessageLog, Template
from services.meta_service import MetaWhatsAppService
from services.whatsapp_service import WhatsAppService


def _meta_service(db) -> MetaWhatsAppService:
    account = WhatsAppService(db).get_account()
    if not account or not account.access_token or not account.phone_number_id:
        raise ValueError("WhatsApp account is not configured. Go to Settings → Configuration to connect.")
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
            if (
                campaign.schedule_time
                and campaign.schedule_time <= datetime.utcnow()
            ):
                print(f"Running Campaign: {campaign.campaign_name}")

                try:
                    meta_service = _meta_service(db)
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
                    message_text = template.template_body or ""
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
                    )
                    db.add(log)

                    recipient = CampaignRecipient(
                        campaign_id=campaign.id,
                        phone_number=phone,
                        status="sent",
                        message_id=message_id,
                    )
                    db.add(recipient)

                    # ── Record to WhatsApp Inbox for live inbox & incoming reply tracking ──
                    try:
                        from services.conversation_service import ConversationService
                        ConversationService(db).record_outgoing_inbox_message(
                            customer_phone=phone,
                            content=message_text,
                            message_type="TEXT",
                            meta_message_id=message_id,
                            customer_name=contact.name if contact else None,
                        )
                    except Exception as e:
                        print(f"[process_scheduled_campaigns] Error recording to inbox: {e}")

                campaign.status = "completed"

        db.commit()

    except Exception as e:
        print("Scheduler Error:", str(e))
        db.rollback()

    finally:
        db.close()
