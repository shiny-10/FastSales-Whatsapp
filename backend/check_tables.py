import os
import sys

sys.path.insert(0, os.getcwd())

from sqlalchemy import text
from core.database import engine

with engine.connect() as conn:
    rows = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).fetchall()
    for row in rows:
        print(row[0])
