from __future__ import annotations
from typing import Set
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, org_id: str | None = None):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket, org_id: str | None = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict, exclude: WebSocket | None = None):
        conns = list(self.active_connections)
        for ws in conns:
            if exclude is not None and ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                pass

    async def broadcast_to_org(self, org_id: str, message: dict, exclude: WebSocket | None = None):
        await self.broadcast(message, exclude=exclude)

manager = ConnectionManager()
