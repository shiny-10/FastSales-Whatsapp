from sqlalchemy import text
from database.db import engine

STATEMENTS = [
    (
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS header VARCHAR DEFAULT 'none'",
        'Ensured templates.header column exists',
    ),
    (
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS footer VARCHAR",
        'Ensured templates.footer column exists',
    ),
    (
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS buttons JSON",
        'Ensured templates.buttons column exists',
    ),
    (
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_url VARCHAR",
        'Ensured templates.header_url column exists',
    ),
    (
        "ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_filename VARCHAR",
        'Ensured templates.header_filename column exists',
    ),
    (
        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS email VARCHAR",
        'Ensured organizations.email column exists',
    ),
    (
        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry VARCHAR",
        'Ensured organizations.industry column exists',
    ),
    (
        "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Active'",
        'Ensured organizations.status column exists',
    ),
    (
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'Active'",
        'Ensured contacts.status column exists',
    ),
    (
        "CREATE TABLE IF NOT EXISTS whatsapp_settings (\n            id SERIAL PRIMARY KEY,\n            waba_id VARCHAR,\n            waba_name VARCHAR,\n            phone_display_name VARCHAR,\n            phone_number VARCHAR,\n            phone_quality VARCHAR,\n            status VARCHAR,\n            meta_business_account_id VARCHAR,\n            business_account_name VARCHAR,\n            connected_by VARCHAR,\n            connected_on TIMESTAMP,\n            access_token_masked VARCHAR,\n            token_expires_on TIMESTAMP,\n            current_limit_24h INTEGER DEFAULT 1000,\n            used_in_24h INTEGER DEFAULT 0,\n            webhook_url VARCHAR,\n            webhook_token VARCHAR,\n            webhook_status VARCHAR,\n            last_ping TIMESTAMP,\n            subscribed_events JSONB\n        )",
        'Ensured whatsapp_settings table exists',
    ),
]

for sql, success_message in STATEMENTS:
    try:
        with engine.begin() as conn:
            conn.execute(text(sql))
        print(success_message)
    except Exception as e:
        print(f'{success_message} skipped: {e}')

print('Database schema update complete.')
