from sqlalchemy import text
from database.db import engine

with engine.connect() as conn:
    rows = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")).fetchall()
    for row in rows:
        print(row[0])
