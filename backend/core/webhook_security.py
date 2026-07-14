import hmac
import hashlib
from fastapi import Request, HTTPException, status

async def verify_meta_signature(request: Request) -> bytes:
    """
    Read raw body and verify Meta HMAC-SHA256 signature.
    Returns raw body so it can be parsed downstream.
    Skips verification if META_APP_SECRET is not configured or skip signature flag is set.
    """
    raw_body = await request.body()

    app_secret = getattr(config, "META_APP_SECRET", None) or ""
    skip_signature = getattr(config, "META_WEBHOOK_SKIP_SIGNATURE", False) or not app_secret
    if isinstance(skip_signature, str):
        skip_signature = skip_signature.lower() in ("true", "1", "yes")

    if skip_signature:
        return raw_body

    signature_header = request.headers.get("X-Hub-Signature-256", "")
    if not signature_header.startswith("sha256="):
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    return raw_body
