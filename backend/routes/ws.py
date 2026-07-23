import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.websocket_manager import manager
from routes.deps import get_current_user_from_ws

router = APIRouter()


@router.websocket("/ws")
@router.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: str | None = None):
    user = await get_current_user_from_ws(websocket)
    # Accept connection and manage active sockets
    await manager.connect(websocket, org_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                obj = json.loads(data)
                event_type = (obj.get("type") or "").lower()
                if event_type == "typing":
                    await manager.broadcast(
                        {
                            "type": "typing",
                            "conversation_id": obj.get("conversation_id"),
                        },
                        exclude=websocket,
                    )
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket, org_id)
