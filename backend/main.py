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
from routes.conversations import router as conversations_router
from routes.auto_replies import router as auto_replies_router
from routes.chatbot_rules import router as chatbot_rules_router
from routes.contacts import router as contact_router
from routes.organizations import router as organization_router
from routes.ws import router as ws_router

# ─── WhatsApp Inbox Routers ────────────────────────────────────────────────────
from routes.inbox_messages import router as inbox_messages_router
from routes.inbox_conversations import router as inbox_conversations_router
from routes.messages import router as inbox_thread_messages_router
from routes.inbox_whatsapp import router as inbox_whatsapp_router

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
app.include_router(conversations_router,      prefix="/api",                 tags=["Conversations"])
app.include_router(inbox_messages_router,     prefix="/api",                 tags=["Inbox Messages"])
app.include_router(auto_replies_router,       prefix="/api",                 tags=["Auto Replies"])
app.include_router(chatbot_rules_router,      prefix="/api",                 tags=["Chatbot Rules"])
app.include_router(contact_router,            prefix="/api/contacts",        tags=["Contacts"])
app.include_router(organization_router,       prefix="/api/organizations",   tags=["Organizations"])
app.include_router(ws_router)

# WhatsApp Inbox
app.include_router(inbox_conversations_router)
app.include_router(inbox_thread_messages_router)
app.include_router(inbox_whatsapp_router)

# ─── Static Files ──────────────────────────────────────────────────────────────
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


# ─── Lifecycle Events ──────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    print(f"[{settings.APP_NAME}] Starting up...")
    if settings.ENABLE_SCHEDULER:
        start_scheduler()
        print("Background scheduler started.")
    else:
        print("Scheduler disabled. Set ENABLE_SCHEDULER=true in .env to enable.")


@app.on_event("shutdown")
def shutdown_event():
    """Clean up resources gracefully on shutdown."""
    close_redis()
    print(f"[{settings.APP_NAME}] Shutdown complete.")


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}