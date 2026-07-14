from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from services.websocket_manager import manager
from routes.deps import get_current_user_from_ws

router = APIRouter()

@router.websocket("/ws/{org_id}")
async def websocket_endpoint(websocket: WebSocket, org_id: str, user=Depends(get_current_user_from_ws)):
    # Ensure user belongs to org
    if not user or str(user.get('organization_id')) != str(org_id):
        await websocket.close(code=1008)
        return
    await manager.connect(org_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # handle pings or typing notifications
            try:
                import json
                obj = json.loads(data)
                if obj.get('type') == 'typing':
                    # broadcast typing to others in org
                    await manager.broadcast_to_org(org_id, { 'type': 'typing', 'conversation_id': obj.get('conversation_id'), 'from': user.get('id') }, exclude=websocket)
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(org_id, websocket)
