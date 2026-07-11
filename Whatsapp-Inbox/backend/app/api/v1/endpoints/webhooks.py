from fastapi import APIRouter, Request, HTTPException, Query, status, Body
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
import json

from app.db.session import get_db
from app.api.core.config import settings
from app.api.core.logging import get_logger
from app.api.core.webhook_security import verify_meta_signature
from app.api.v1.services.webhook_service import WebhookService
from app.db.repositories.whatsapp_repository import WhatsAppRepository

logger = get_logger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.get("/meta", response_class=PlainTextResponse)
async def verify_webhook(
    hub_mode: str = Query(alias="hub.mode", default=""),
    hub_challenge: str = Query(alias="hub.challenge", default=""),
    hub_verify_token: str = Query(alias="hub.verify_token", default=""),
    db: AsyncSession = Depends(get_db),
):
    """Meta webhook verification handshake."""
    if hub_mode == "subscribe" and hub_verify_token == settings.META_VERIFY_TOKEN:
        logger.info("Webhook verified successfully")
        wa_repo = WhatsAppRepository(db)
        account = await wa_repo.get_fallback_account()
        if account:
            await wa_repo.update(account.id, webhook_verified=True)
            logger.info(f"Marked WhatsApp account {account.id} as webhook verified")
        return hub_challenge
    logger.warning(f"Webhook verification failed: mode={hub_mode} token={hub_verify_token}")
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Verification failed",
    )


@router.post("/meta", status_code=status.HTTP_200_OK)
async def receive_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive and process Meta webhook events."""
    logger.info("[WEBHOOK] ===== INCOMING WEBHOOK REQUEST =====")
    logger.info(f"[WEBHOOK] Request method: {request.method}")
    logger.info(f"[WEBHOOK] Request path: {request.url.path}")
    
    # Signature verification (skipped if META_APP_SECRET not set)
    raw_body = await verify_meta_signature(request)

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        logger.error("[WEBHOOK] Failed to parse JSON")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload",
        )

    logger.info(f"[WEBHOOK] Payload received: {json.dumps(payload)[:200]}...")

    svc = WebhookService(db)
    try:
        await svc.process_payload(payload)
        logger.info("[WEBHOOK] Payload processed successfully")
    except Exception as e:
        # Always return 200 to Meta to prevent retries on app errors
        logger.error(f"[WEBHOOK] Processing error: {e}", exc_info=True)

    return {"status": "ok"}
