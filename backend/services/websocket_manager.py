from typing import Dict, Set
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # map org_id -> set of WebSocket
        self.active_connections: Dict[str, Set[WebSocket]] = {}

    async def connect(self, org_id: str, websocket: WebSocket):
        await websocket.accept()
        conns = self.active_connections.setdefault(org_id, set())
        conns.add(websocket)

    def disconnect(self, org_id: str, websocket: WebSocket):
        conns = self.active_connections.get(org_id)
        if conns and websocket in conns:
            conns.remove(websocket)

    async def broadcast_to_org(self, org_id: str, message: dict, exclude: WebSocket | None = None):
        conns = list(self.active_connections.get(org_id, []))
        data = message
        for ws in conns:
            if exclude is not None and ws is exclude:
                continue
            try:
                await ws.send_json(data)
            except Exception:
                # ignore send errors; cleanup happens on disconnect
                pass


manager = ConnectionManager()
