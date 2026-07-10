from fastapi import FastAPI

from routes.dashboard import router as dashboard_router
from routes.templates import router as template_router
from routes.whatsapp import router as whatsapp_router
from routes.webhooks import router as webhook_router
from routes.campaign import router as campaign_router
from routes.conversations import router as conversations_router
from routes.inbox_messages import router as inbox_messages_router
from routes.auto_replies import router as auto_replies_router
from routes.chatbot_rules import router as chatbot_rules_router
from routes.ws import router as ws_router

from database.db import Base, engine
from database.schema_bootstrap import bootstrap_schema
from models.postgres_model import ActivityLog, Campaign, CampaignContact, CampaignRecipient, Contact, Conversation, ConversationMessage, ConversationRead, MessageLog, Organization, Template
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.contacts import router as contact_router
import os
from services.scheduler_service import start_scheduler
from routes.organizations import router as organization_router

app = FastAPI(title="FastSales WhatsApp Module")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    # allow any local network host/port (dev only)
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.[0-9]{1,3}\.[0-9]{1,3}):(\d+)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

bootstrap_schema()

app.include_router(dashboard_router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(template_router, prefix="/api/templates", tags=["Templates"])
app.include_router(whatsapp_router, prefix="/api/whatsapp", tags=["WhatsApp"])
app.include_router(webhook_router, prefix="/api", tags=["Webhooks"])
app.include_router(campaign_router, prefix="/api/campaign", tags=["Campaign"])
app.include_router(conversations_router, prefix="/api", tags=["Conversations"])
app.include_router(inbox_messages_router, prefix="/api", tags=["Inbox Messages"])
app.include_router(auto_replies_router, prefix="/api", tags=["Auto Replies"])
app.include_router(chatbot_rules_router, prefix="/api", tags=["Chatbot Rules"])
app.include_router(ws_router)


@app.get("/")
def home():
    return {"message": "FastSales WhatsApp Module Running"}

app.include_router(
    contact_router,
    prefix="/api/contacts",
    tags=["Contacts"]
)
app.include_router(
    organization_router,
    prefix="/api/organizations",
    tags=["Organizations"]
)

# Serve uploaded media files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
def startup_event():
    print("STARTUP EVENT RUNNING")
    # Start scheduler only when explicitly enabled (avoids accidental DB exhaustion in dev)
    if os.environ.get("ENABLE_SCHEDULER") == "1":
        start_scheduler()
    else:
        print("Scheduler not started: set ENABLE_SCHEDULER=1 to enable background jobs")


    