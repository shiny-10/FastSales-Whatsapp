from __future__ import annotations

from typing import Any
from sqlalchemy.orm import Session

class BaseService:
    def __init__(self, db: Session):
        self.db = db

    def _commit(self) -> None:
        self.db.commit()

    def _refresh(self, instance: Any) -> None:
        self.db.refresh(instance)
