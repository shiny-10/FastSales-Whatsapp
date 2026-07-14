"""
Schema bootstrap utility.

Run directly to create / sync all SQLAlchemy model tables:

    cd backend
    python scripts/schema_bootstrap.py
"""

import sys
from pathlib import Path

# Ensure the backend root is on the path when run as a script
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import text

from core.database import engine
import models.postgres_model  # noqa: F401 — registers all ORM models with Base
from core.database import Base

def bootstrap_schema() -> None:
    """Create all tables defined in the ORM models if they do not already exist."""
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))  # verify connectivity

    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    bootstrap_schema()
    print("Schema bootstrap complete.")
