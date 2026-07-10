import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.db import engine
import sqlalchemy as sa

with engine.connect() as conn:
    res = conn.execute(sa.text("select column_name from information_schema.columns where table_name='templates';"))
    cols = [row[0] for row in res.fetchall()]

print('templates columns:', cols)
print('header_url present:', 'header_url' in cols)
print('header_filename present:', 'header_filename' in cols)
