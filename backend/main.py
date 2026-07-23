from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.database import Base, engine
from core.redis import close_redis
from scripts.schema_bootstrap import bootstrap_schema
from services.scheduler_service import start_scheduler

# ─── Routers ───────────────────────────────────────────────────────────────────
from routes.dashboard import router as dashboard_router
from routes.templates import router as template_router
from routes.whatsapp import router as whatsapp_router
from routes.webhooks import router as webhook_router, verify_webhook, webhook as webhook_post
from routes.campaign import router as campaign_router
from routes.auto_replies import router as auto_replies_router
from routes.chatbot_rules import router as chatbot_rules_router
from routes.contacts import router as contact_router
from routes.ws import router as ws_router
from routes.inbox_conversations import router as inbox_conversations_router
from routes.messages import router as inbox_thread_messages_router
from routes.inbox_scheduled_messages import router as inbox_scheduled_router

# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "ws://localhost:8000",
        "ws://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        *settings.CORS_ORIGINS,
    ],
    allow_origin_regex=r"^(https?|wss?)://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.[0-9]{1,3}\.[0-9]{1,3})(:(\d+))?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Bootstrap DB schema on startup ───────────────────────────────────────────
bootstrap_schema()

# ─── Register Routers ──────────────────────────────────────────────────────────
app.include_router(dashboard_router,          prefix="/api/dashboard",      tags=["Dashboard"])
app.include_router(template_router,           prefix="/api/templates",       tags=["Templates"])
app.include_router(whatsapp_router,           prefix="/api/whatsapp",        tags=["WhatsApp"])
app.include_router(webhook_router,            prefix="/api",                 tags=["Webhooks"])
app.add_api_route("/webhook", verify_webhook, methods=["GET"], tags=["Webhooks"])
app.add_api_route("/webhook", webhook_post, methods=["POST"], tags=["Webhooks"])
app.include_router(campaign_router,           prefix="/api/campaign",        tags=["Campaign"])
app.include_router(auto_replies_router,       prefix="/api",                 tags=["Auto Replies"])
app.include_router(chatbot_rules_router,      prefix="/api",                 tags=["Chatbot Rules"])
app.include_router(contact_router,            prefix="/api/contacts",        tags=["Contacts"])
app.include_router(ws_router)

# WhatsApp Inbox
app.include_router(inbox_conversations_router)
app.include_router(inbox_thread_messages_router)
app.include_router(inbox_scheduled_router)

# ─── Static Files ──────────────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ─── Lifecycle Events ──────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    print(f"[{settings.APP_NAME}] Starting up...")

    _sync_env_to_frontend()
    _sync_env_token_to_db()

    if settings.ENABLE_SCHEDULER:
        start_scheduler()
        print("Background scheduler started.")
    else:
        print("Scheduler disabled. Set ENABLE_SCHEDULER=true in .env to enable.")


def _sync_env_token_to_db():
    token = settings.META_ACCESS_TOKEN or settings.ACCESS_TOKEN
    phone_id = settings.META_WHATSAPP_PHONE_NUMBER_ID or settings.PHONE_NUMBER_ID
    waba_id = settings.META_BUSINESS_ACCOUNT_ID or settings.WABA_ID

    if not token or not phone_id:
        return

    from core.database import SessionLocal
    from models.postgres_model import WhatsAppAccount
    db = SessionLocal()
    try:
        account = db.query(WhatsAppAccount).first()
        if account:
            print("[startup] whatsapp_accounts record exists — keeping UI credentials.")
            return
        new_account = WhatsAppAccount(
            waba_id=waba_id or "",
            phone_number_id=phone_id,
            access_token=token,
            status="ACTIVE",
            webhook_verified=False,
        )
        db.add(new_account)
        db.commit()
        print("[startup] Created whatsapp_accounts record from .env credentials.")
    except Exception as e:
        print(f"[startup] Warning: could not seed token to DB: {e}")
        db.rollback()
    finally:
        db.close()


def _sync_env_to_frontend():
    from pathlib import Path

    backend_env = Path(__file__).parent / ".env"
    frontend_env = Path(__file__).parent.parent / "frontend" / ".env.local"

    if not backend_env.exists():
        return

    content = backend_env.read_text(encoding="utf-8")

    next_vars: dict[str, str] = {}
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("NEXT_PUBLIC_") and "=" in line:
            key, _, val = line.partition("=")
            next_vars[key.strip()] = val.strip()

    if not next_vars:
        return

    if "NEXT_PUBLIC_API_URL" in next_vars and "NEXT_PUBLIC_API_BASE" not in next_vars:
        next_vars["NEXT_PUBLIC_API_BASE"] = next_vars["NEXT_PUBLIC_API_URL"]

    try:
        existing: dict[str, str] = {}
        if frontend_env.exists():
            for line in frontend_env.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    existing[k.strip()] = v.strip()

        existing.update(next_vars)

        lines = ["# Auto-synced from backend/.env on startup — do not edit manually\n"]
        for k, v in sorted(existing.items()):
            lines.append(f"{k}={v}\n")

        frontend_env.write_text("".join(lines), encoding="utf-8")
        print(f"[startup] Synced {len(next_vars)} NEXT_PUBLIC vars → frontend/.env.local")
    except Exception as e:
        print(f"[startup] Warning: could not sync to frontend/.env.local: {e}")


@app.on_event("shutdown")
def shutdown_event():
    close_redis()
    print(f"[{settings.APP_NAME}] Shutdown complete.")


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}