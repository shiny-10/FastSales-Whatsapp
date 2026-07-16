from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.websocket_manager import manager

router = APIRouter()


@router.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: str):
    """
    Raw WebSocket endpoint for real-time inbox events.
    Auth is intentionally relaxed here — production should validate a token
    via query param `?token=<jwt>` and verify org ownership.
    """
    await manager.connect(org_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                import json
                obj = json.loads(data)
                event_type = (obj.get("type") or "").lower()
                if event_type == "typing":
                    # Broadcast typing to all other clients in this org
                    await manager.broadcast_to_org(
                        org_id,
                        {
                            "type": "typing",
                            "conversation_id": obj.get("conversation_id"),
                        },
                        exclude=websocket,
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(org_id, websocket)
