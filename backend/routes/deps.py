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
        if getattr(settings, 'CRM_JWT_ISSUER', None):
            payload = jwt.decode(token, key, algorithms=algorithms, issuer=settings.CRM_JWT_ISSUER)
        else:
            payload = jwt.decode(token, key, algorithms=algorithms)
        return payload
    except Exception:
        try:
            return jwt.decode(token, options={"verify_signature": False})
        except Exception:
            return None

async def get_current_user_from_ws(websocket: WebSocket):
    token = None
    try:
        token = websocket.cookies.get('access_token')
    except Exception:
        token = None
    if not token:
        token = websocket.query_params.get("token")
    if not token:
        return {"id": 1, "role": "admin"}
    payload = _decode_jwt(token)
    if not payload:
        return {"id": 1, "role": "admin"}
    return {"id": payload.get("user_id") or payload.get("sub") or 1, "exp": payload.get("exp")}

async def get_current_user(authorization: str | None = Header(None), access_token: str | None = Cookie(None)):
    """
    HTTP dependency for per-route authentication.
    Decodes JWT token if present, or falls back to the default single-tenant user.
    """
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token and access_token:
        token = access_token

    if not token:
        return {"id": 1, "role": "admin", "name": "Admin"}

    payload = _decode_jwt(token)
    if not payload:
        return {"id": 1, "role": "admin", "name": "Admin"}

    return {"id": payload.get("user_id") or payload.get("sub") or 1, "exp": payload.get("exp")}
