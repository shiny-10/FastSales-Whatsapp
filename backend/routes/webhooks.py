import json
from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse

from core.config import settings
from core.database import SessionLocal
from core.webhook_security import verify_meta_signature
from services.webhook_service import WebhookService

router = APIRouter()


@router.get("/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    hub_mode = params.get("hub.mode") or params.get("hub_mode")
    hub_verify_token = params.get("hub.verify_token") or params.get("hub_verify_token")
    hub_challenge = params.get("hub.challenge") or params.get("hub_challenge")

    VERIFY_TOKEN = settings.META_VERIFY_TOKEN or "fastsales123"

    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return PlainTextResponse(hub_challenge or "")

    return PlainTextResponse("Verification failed", status_code=400)


@router.post("/webhook")
async def webhook(request: Request, raw_body: bytes = Depends(verify_meta_signature)):
    try:
        data = json.loads(raw_body.decode("utf-8"))
    except Exception:
        return {"status": "error", "message": "Invalid JSON"}

    db = SessionLocal()
    try:
        svc = WebhookService(db)
        svc.process_webhook_payload(data)
    except Exception as e:
        print(f"[Webhook] Error processing payload: {e}")
        db.rollback()
    finally:
        db.close()

    # Always return 200 so Meta doesn't retry
    return {"status": "ok"}
