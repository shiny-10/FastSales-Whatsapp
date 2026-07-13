from __future__ import annotations
import asyncio
from typing import Any
from services.websocket_manager import manager

def _broadcast(organization_id: int, event_name: str, payload: dict):
    msg = {
        "type": event_name,
        **payload
    }
    try:
        # Try to schedule the coroutine in the running event loop
        loop = asyncio.get_running_loop()
        loop.create_task(manager.broadcast_to_org(str(organization_id), msg))
    except RuntimeError:
        # If no loop is running in the current thread (e.g. from background thread pool),
        # use asyncio.run to run it synchronously.
        try:
            asyncio.run(manager.broadcast_to_org(str(organization_id), msg))
        except Exception:
            pass

def emit_new_message(organization_id: int, conversation_id: int, message: Any):
    payload = message if isinstance(message, dict) else message.model_dump(mode="json")
    _broadcast(organization_id, "new_message", {
        "conversation_id": conversation_id,
        "message": payload
    })

def emit_message_status(
    organization_id: int,
    conversation_id: int,
    status_value: str,
    message_id: int | None = None,
    meta_message_id: str | None = None,
):
    payload = {
        "message_id": message_id,
        "meta_message_id": meta_message_id,
        "status": status_value,
        "conversation_id": conversation_id,
    }
    _broadcast(organization_id, "message_status", payload)

def emit_new_reaction(organization_id: int, conversation_id: int, reaction: Any):
    payload = reaction if isinstance(reaction, dict) else reaction.model_dump(mode="json")
    _broadcast(organization_id, "new_reaction", {
        "conversation_id": conversation_id,
        "reaction": payload
    })

def emit_agent_assigned(
    organization_id: int, conversation_id: int, agent_id: int
):
    payload = {"conversation_id": conversation_id, "agent_id": agent_id}
    _broadcast(organization_id, "agent_assigned", payload)
