"""
Meta webhook payload signature verification.
Meta signs every POST body with HMAC-SHA256 using the App Secret.
Header: X-Hub-Signature-256: sha256=<hex_digest>
"""
import hmac
import hashlib
from fastapi import Request, HTTPException, status
from app.api.core.config import settings
from app.api.core.logging import get_logger

logger = get_logger(__name__)


async def verify_meta_signature(request: Request) -> bytes:
    """
    Read raw body and verify Meta HMAC-SHA256 signature.
    Returns raw body so it can be parsed downstream.
    Skips verification if META_APP_SECRET is not configured.
    """
    raw_body = await request.body()

    app_secret = getattr(settings, "META_APP_SECRET", "")
    skip_signature = getattr(settings, "META_WEBHOOK_SKIP_SIGNATURE", False) or not app_secret

    if skip_signature:
        # Signature verification disabled — acceptable in dev/staging or when explicitly enabled
        logger.warning("Webhook signature check skipped; set META_APP_SECRET to the real Meta App Secret or disable META_WEBHOOK_SKIP_SIGNATURE in production")
        return raw_body

    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not signature_header.startswith("sha256="):
        logger.warning("Missing or malformed X-Hub-Signature-256 header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing webhook signature",
        )

    expected_sig = signature_header[len("sha256="):]
    computed_sig = hmac.new(
        app_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected_sig, computed_sig):
        logger.warning("Webhook signature mismatch")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    return raw_body
