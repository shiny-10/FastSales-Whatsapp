from __future__ import annotations
import asyncio
from typing import Any
from services.websocket_manager import manager

def _broadcast(event_name: str, payload: dict, organization_id: int | None = None):
    msg = {
        "type": event_name,
        **payload
    }
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast(msg))
    except RuntimeError:
        try:
            asyncio.run(manager.broadcast(msg))
        except Exception:
            pass

def emit_new_message(conversation_id: int, message: Any, organization_id: int | None = None):
    payload = message if isinstance(message, dict) else message.model_dump(mode="json")
    _broadcast("new_message", {
        "conversation_id": conversation_id,
        "message": payload
    })

def emit_message_status(
    conversation_id: int,
    status_value: str,
    message_id: int | None = None,
    meta_message_id: str | None = None,
    organization_id: int | None = None,
):
    payload = {
        "message_id": message_id,
        "meta_message_id": meta_message_id,
        "status": status_value,
        "conversation_id": conversation_id,
    }
    _broadcast("message_status", payload)

def emit_new_reaction(conversation_id: int, reaction: Any, organization_id: int | None = None):
    payload = reaction if isinstance(reaction, dict) else reaction.model_dump(mode="json")
    _broadcast("new_reaction", {
        "conversation_id": conversation_id,
        "reaction": payload
    })

def emit_agent_assigned(
    conversation_id: int, agent_id: int, organization_id: int | None = None
):
    payload = {"conversation_id": conversation_id, "agent_id": agent_id}
    _broadcast("agent_assigned", payload)

def emit_conversation_update(conversation_id: int, updates: dict, organization_id: int | None = None):
    """Push partial conversation field updates (status, unread_count, etc.) to clients."""
    _broadcast("conversation_update", {
        "conversation_id": str(conversation_id),
        **updates,
    })

def emit_message_deleted(conversation_id: int, message_id: int, organization_id: int | None = None):
    """Notify clients that a message was soft-deleted."""
    _broadcast("message_deleted", {
        "conversation_id": str(conversation_id),
        "message_id": str(message_id),
    })
