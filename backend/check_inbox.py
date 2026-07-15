from core.database import SessionLocal
from models.postgres_model import WhatsAppInboxConversation, WhatsAppInboxMessage

db = SessionLocal()

# Check conversations
convs = db.query(WhatsAppInboxConversation).all()
print(f"\n=== Conversations ===")
print(f"Total: {len(convs)}")
for c in convs:
    print(f"  ID: {c.id}, Phone: {c.customer_phone}, Status: {c.status}, Org: {c.organization_id}")

# Check messages
messages = db.query(WhatsAppInboxMessage).all()
print(f"\n=== Messages ===")
print(f"Total: {len(messages)}")
for m in messages:
    print(f"  Conv {m.conversation_id}: {m.sender_type} - {m.content[:50]}")
