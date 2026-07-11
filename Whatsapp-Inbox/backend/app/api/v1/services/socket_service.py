"""Socket.IO service — broadcasts realtime events to connected clients."""
import socketio
from typing import Any
from app.api.core.config import settings
from app.api.core.logging import get_logger

logger = get_logger(__name__)

# Create the Socket.IO async server
sio = socketio.AsyncServer(
    client_manager=socketio.AsyncRedisManager(settings.REDIS_URL),
    async_mode="asgi",
    cors_allowed_origins=settings.SOCKETIO_CORS_ORIGINS,
    logger=False,
    engineio_logger=False,
)


# ─── Room helpers ────────────────────────────────────────────────────────────

def company_room(company_id: str) -> str:
    return f"company:{company_id}"


def conversation_room(conversation_id: str) -> str:
    return f"conversation:{conversation_id}"


# ─── Lifecycle events ────────────────────────────────────────────────────────

@sio.event
async def connect(sid: str, environ: dict, auth: dict | None = None):
    logger.info(f"Socket connected: {sid}")


@sio.event
async def disconnect(sid: str):
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def join_company(sid: str, data: dict):
    """Client joins a company room to get all company-level events."""
    company_id = data.get("company_id")
    if company_id:
        await sio.enter_room(sid, company_room(company_id))
        logger.info(f"Socket {sid} joined company room {company_id}")


@sio.event
async def join_conversation(sid: str, data: dict):
    """Client joins a conversation room for granular message events."""
    conv_id = data.get("conversation_id")
    if conv_id:
        await sio.enter_room(sid, conversation_room(conv_id))
        logger.info(f"Socket {sid} joined conversation room {conv_id}")


@sio.event
async def leave_conversation(sid: str, data: dict):
    conv_id = data.get("conversation_id")
    if conv_id:
        await sio.leave_room(sid, conversation_room(conv_id))


@sio.event
async def typing(sid: str, data: dict):
    """Relay typing indicator to the conversation room."""
    conv_id = data.get("conversation_id")
    if conv_id:
        await sio.emit(
            "TYPING",
            data,
            room=conversation_room(conv_id),
            skip_sid=sid,
        )


# ─── Emit helpers (called by services) ───────────────────────────────────────

async def emit_new_message(company_id: str, conversation_id: str, message: Any):
    payload = message if isinstance(message, dict) else message.model_dump(mode="json")
    logger.info(f"[SOCKET] Emitting NEW_MESSAGE to company:{company_id}, conv:{conversation_id}")
    await sio.emit("NEW_MESSAGE", payload, room=company_room(company_id))
    await sio.emit("NEW_MESSAGE", payload, room=conversation_room(conversation_id))
    logger.info(f"[SOCKET] Emitted NEW_MESSAGE successfully")


async def emit_message_status(
    company_id: str,
    conversation_id: str,
    status_value: str,
    message_id: str | None = None,
    meta_message_id: str | None = None,
):
    payload = {
        "message_id": message_id,
        "meta_message_id": meta_message_id,
        "status": status_value,
        "conversation_id": conversation_id,
    }
    await sio.emit("MESSAGE_STATUS", payload, room=company_room(company_id))
    await sio.emit("MESSAGE_STATUS", payload, room=conversation_room(conversation_id))


async def emit_new_reaction(company_id: str, conversation_id: str, reaction: Any):
    payload = reaction if isinstance(reaction, dict) else reaction.model_dump(mode="json")
    await sio.emit("NEW_REACTION", payload, room=company_room(company_id))
    await sio.emit("NEW_REACTION", payload, room=conversation_room(conversation_id))


async def emit_agent_assigned(
    company_id: str, conversation_id: str, agent_id: str
):
    payload = {"conversation_id": conversation_id, "agent_id": agent_id}
    await sio.emit("AGENT_ASSIGNED", payload, room=company_room(company_id))
