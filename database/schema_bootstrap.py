from pathlib import Path
import sys

from sqlalchemy import text

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from database.db import engine
import models.postgres_model  # noqa: F401
from models.postgres_model import Base


def bootstrap_schema() -> None:
    """Create or ensure base tables using the declarative models.

    This replaces the previous ad hoc migration script with a single
    schema bootstrap entry point that uses the SQLAlchemy model metadata.
    """
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))

    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    bootstrap_schema()
    print("Schema bootstrap complete.")
