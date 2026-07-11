from contextlib import asynccontextmanager
import socketio
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from app.api.core.config import settings
from app.api.core.logging import setup_logging, get_logger
from app.api.core.middleware import RequestIDMiddleware, RequestLoggingMiddleware, RateLimitMiddleware
from app.db.redis import get_redis, close_redis
from app.db.session import create_database_tables
from app.api.v1.services.socket_service import sio
from app.api.v1.services.scheduler_service import start_scheduler, stop_scheduler
from app.api.v1.endpoints import whatsapp, conversations, messages, reactions, webhooks, media, upload, messaging_features
from app.api.core.exceptions import WhatsAppInboxException
from app.api.core.error_handlers import custom_exception_handler, generic_exception_handler
from app.api.core.constants import APITags, APIVersion

setup_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    await get_redis()
    await create_database_tables()
    start_scheduler()
    yield
    logger.info("Shutting down...")
    stop_scheduler()
    await close_redis()


# ─── FastAPI app ──────────────────────────────────────────────────────────────
from fastapi.responses import HTMLResponse
from fastapi.openapi.docs import get_swagger_ui_html


app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="WhatsApp Shared Inbox Platform — Phase 4",
        docs_url=None,  # we provide a custom docs route to show project info banner
        redoc_url="/redoc",
        lifespan=lifespan,
)


@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
        """Serve Swagger UI with a project info banner on top."""
        swagger_resp = get_swagger_ui_html(openapi_url=app.openapi_url, title=f"{settings.APP_NAME} - Docs")
        # swagger_resp is an HTMLResponse; its body is bytes in .body
        content = swagger_resp.body.decode() if isinstance(swagger_resp.body, (bytes, bytearray)) else str(swagger_resp.body)

        banner_html = f"""
        <div style='padding:12px 16px;background:transparent;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif'>
            <div style='max-width:1200px;margin:12px auto;border-radius:12px;background:#ffffff;color:#0f172a;display:flex;gap:12px;align-items:center;padding:12px 16px;box-shadow:0 2px 8px rgba(15,23,42,0.06)'>
                <div style='font-weight:700;font-size:16px'>{settings.APP_NAME}</div>
                <div style='opacity:0.8;font-size:13px'>v{settings.APP_VERSION}</div>
                <div style='margin-left:12px;padding:4px 8px;border-radius:8px;background:#f3f4f6;font-size:13px;color:#111827'>API: {settings.NEXT_PUBLIC_API_URL}</div>
                <div style='margin-left:8px;padding:4px 8px;border-radius:8px;background:#f3f4f6;font-size:13px;color:#111827'>Frontend: {settings.FRONTEND_URL}</div>
            </div>
        </div>
        """

        # Inject the banner immediately before the swagger-ui root div so it appears on top
        new_content = content.replace('<div id="swagger-ui"></div>', banner_html + '<div id="swagger-ui"></div>')
        return HTMLResponse(content=new_content)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Custom middleware (applied in reverse order) ─────────────────────────────
if settings.ENABLE_RATE_LIMITS:
    app.add_middleware(RateLimitMiddleware)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)


# ─── Exception handlers ───────────────────────────────────────────────────────
@app.exception_handler(WhatsAppInboxException)
async def whatsapp_exception_handler(request: Request, exc: WhatsAppInboxException):
    return await custom_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(f"Validation error: {exc.errors()}", extra={"path": request.url.path})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return await generic_exception_handler(request, exc)


# ─── Routers ──────────────────────────────────────────────────────────────────
API_PREFIX = f"/api/{APIVersion.CURRENT}"

app.include_router(whatsapp.router, prefix=API_PREFIX, tags=[APITags.WHATSAPP])
app.include_router(conversations.router, prefix=API_PREFIX, tags=[APITags.CONVERSATIONS])
app.include_router(messages.router, prefix=API_PREFIX, tags=[APITags.MESSAGES])
app.include_router(reactions.router, prefix=API_PREFIX, tags=[APITags.REACTIONS])
app.include_router(media.router, prefix=API_PREFIX, tags=[APITags.MEDIA])
app.include_router(upload.router, prefix=API_PREFIX, tags=[APITags.UPLOAD])
app.include_router(messaging_features.router, prefix=API_PREFIX, tags=[APITags.MESSAGING_FEATURES])
app.include_router(webhooks.router, tags=[APITags.WEBHOOKS])  # /webhooks/meta — no /api prefix


@app.get("/", tags=[APITags.HEALTH])
async def root():
    return {
        "status": "ok",
        "message": "WhatsApp Shared Inbox API is running",
        "health": "/health",
        "docs": "/docs",
        "version": settings.APP_VERSION,
        "api_version": APIVersion.CURRENT,
    }


@app.get("/health", tags=[APITags.HEALTH])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION, "api_version": APIVersion.CURRENT}


# ─── Socket.IO ASGI mount ─────────────────────────────────────────────────────
socket_app = socketio.ASGIApp(sio, other_asgi_app=app, socketio_path="/socket.io")
