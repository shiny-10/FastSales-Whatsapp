from core.config import settings
from fastapi import WebSocket, Depends, HTTPException, Header, Cookie, Request
from sqlalchemy.orm import Session
from core.database import get_db

import jwt
from datetime import datetime

def _decode_jwt(token: str):
    try:
        key = settings.CRM_JWT_PUBLIC_KEY if getattr(settings, 'CRM_JWT_PUBLIC_KEY', None) else settings.JWT_SECRET
        algorithms = [settings.JWT_ALGORITHM]
        # If issuer is configured, validate it
        if getattr(settings, 'CRM_JWT_ISSUER', None):
            payload = jwt.decode(token, key, algorithms=algorithms, issuer=settings.CRM_JWT_ISSUER)
        else:
            payload = jwt.decode(token, key, algorithms=algorithms)
        return payload
    except Exception:
        return None

async def get_current_user_from_ws(websocket: WebSocket):
    """WebSocket auth: expects `token` query param with JWT containing `user_id` and `organization_id`.
    Returns a user dict or None.
    """
    # Prefer cookie-based token (safer). Fallback to query param `token` for legacy clients.
    token = None
    try:
        token = websocket.cookies.get('access_token')
    except Exception:
        token = None
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        return None
    payload = _decode_jwt(token)
    if not payload:
        return None
    # minimal user object
    return {"id": payload.get("user_id"), "organization_id": payload.get("organization_id"), "exp": payload.get("exp")}

from fastapi import Header

async def get_current_user(authorization: str | None = Header(None), access_token: str | None = Cookie(None)):
    """HTTP dependency to decode `Authorization: Bearer <token>`. Returns user dict or raises 401."""
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    # fallback to cookie token
    if not token and access_token:
        token = access_token
    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")
    payload = _decode_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"id": payload.get("user_id"), "organization_id": payload.get("organization_id"), "exp": payload.get("exp")}


# ── WhatsApp per-request dependency ──────────────────────────────────────────

def get_meta_service(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    FastAPI dependency: build a MetaWhatsAppService from the DB row for the
    current organisation.  Raises 409 if the account is missing or incomplete.

    org_id resolution order:
      1. X-Organization-Id header (set by the frontend)
      2. Falls back to 1 (single-tenant default)
    """
    from services.whatsapp_service import WhatsAppService
    from services.meta_service import MetaWhatsAppService

    try:
        org_id = int(request.headers.get("X-Organization-Id") or 1)
    except (TypeError, ValueError):
        org_id = 1

    account = WhatsAppService(db).get_account(org_id)
    if not account or not account.access_token or not account.phone_number_id:
        raise HTTPException(
            status_code=409,
            detail="WhatsApp is not configured for this organization.",
        )
    return MetaWhatsAppService(
        access_token=account.access_token,
        phone_number_id=account.phone_number_id,
    )
