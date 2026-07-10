from fastapi import APIRouter, Request
from database.db import SessionLocal
from models.postgres_model import CampaignRecipient, MessageLog
from fastapi.responses import PlainTextResponse

router = APIRouter()


@router.get("/webhook")
async def verify_webhook(
    hub_mode: str = None,
    hub_verify_token: str = None,
    hub_challenge: str = None
):
    VERIFY_TOKEN = "fastsales123"

    if (
        hub_mode == "subscribe"
        and hub_verify_token == VERIFY_TOKEN
    ):
        return PlainTextResponse(hub_challenge)

    return {"error": "Verification failed"}

@router.post("/webhook")
async def webhook(request: Request):
    db = SessionLocal()
    try:
          data = await request.json()
    except Exception:
        db.close()
        return {
          "success": False,
          "message": "Invalid JSON payload"
       } 

    try:
        value = data["entry"][0]["changes"][0]["value"]

        # -----------------------------
        # 1. STATUS UPDATES (delivered/read/failed)
        # -----------------------------
        if "statuses" in value:
            status_data = value["statuses"][0]

            message_id = status_data.get("id")
            status = status_data.get("status")

            print("📩 STATUS UPDATE:", message_id, status)

            # Update message_logs table
            msg = db.query(MessageLog).filter(
                MessageLog.message_id == message_id
            ).first()

            if msg:
                msg.status = status

            # Update campaign_recipient table
            rec = db.query(CampaignRecipient).filter(
                CampaignRecipient.message_id == message_id
            ).first()

            if rec:
                rec.status = status

        # -----------------------------
        # 2. INCOMING MESSAGES (customer replies)
        # -----------------------------
        if "messages" in value:
            msg_data = value["messages"][0]

            new_msg = MessageLog(
    message_id=msg_data.get("id"),
    phone_number=msg_data.get("from"),
    text=msg_data.get("text", {}).get("body"),
    direction="incoming",
    status="received",
    organization_id=1
)

            db.add(new_msg)

        db.commit()

    except Exception as e:
        print("Webhook error:", str(e))
        db.rollback()

    finally:
        db.close()

    return {"status": "ok"}