# WhatsApp Shared Inbox Platform

A production-grade WhatsApp shared inbox similar to WATI, built with FastAPI, PostgreSQL, Next.js 15, and Socket.IO.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Nginx (Port 80/443)                  │
└────────────────────────┬───────────────┬────────────────┘
                         │               │
              ┌──────────▼──────┐ ┌──────▼──────────┐
              │  FastAPI + SIO  │ │  Next.js 15 UI  │
              │  (Port 8000)    │ │  (Port 3000)    │
              └──────────┬──────┘ └─────────────────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
    ┌──────▼──────┐ ┌───▼───┐ ┌──────▼──────┐
    │  PostgreSQL │ │ Redis │ │   AWS S3    │
    └─────────────┘ └───────┘ └─────────────┘
```

## Quick Start

### 1. Clone and configure

```bash
# Optional: copy example configuration for local development
cp .env.example .env
# Edit .env only if you want local overrides
```

> Note: Docker Compose no longer depends on a repository `.env` file for backend or frontend services.

### 2. Docker Compose (recommended)

```bash
docker-compose up -d
# Migrations run automatically on backend startup
```

### 3. Local development

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
pip install -r requirements.txt

# Optional: create a .env from backend/.env.example for local overrides
cp .env.example .env

# Start PostgreSQL and Redis locally, then:
uvicorn app.main:socket_app --reload --port 8000
```

**Seed data:**
```bash
python seed.py
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

### 4. Run tests

```bash
cd backend
pip install aiosqlite   # SQLite test driver
pytest -v
```

## API Reference

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Key Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/whatsapp/connect | Connect WhatsApp account |
| GET | /api/whatsapp/account | Get account status |
| DELETE | /api/whatsapp/disconnect | Disconnect account |
| GET | /api/conversations | List conversations |
| GET | /api/conversations/{id} | Get conversation |
| POST | /api/conversations/{id}/assign | Assign agent |
| PATCH | /api/conversations/{id} | Update status |
| GET | /api/conversations/{id}/messages | List messages |
| POST | /api/messages/send/text | Send text |
| POST | /api/messages/send/media | Send media |
| POST | /api/messages/send/template | Send template |
| GET | /api/messages/{id}/reactions | Get reactions |
| GET | /webhooks/meta | Webhook verification |
| POST | /webhooks/meta | Receive webhook events |

## Socket.IO Events

### Client → Server
| Event | Payload |
|-------|---------|
| `join_company` | `{ company_id }` |
| `join_conversation` | `{ conversation_id }` |
| `leave_conversation` | `{ conversation_id }` |
| `typing` | `{ conversation_id }` |

### Server → Client
| Event | Description |
|-------|-------------|
| `NEW_MESSAGE` | New incoming/outgoing message |
| `MESSAGE_STATUS` | Delivery status update |
| `NEW_REACTION` | New emoji reaction |
| `AGENT_ASSIGNED` | Agent assignment change |
| `TYPING` | Customer typing indicator |

## Webhook Flow

```
Customer sends WhatsApp message
       ↓
Meta Cloud API
       ↓
POST /webhooks/meta
       ↓
WebhookService.process_payload()
       ↓
Find/Create Conversation
       ↓
Store Message + Media (→ S3)
       ↓
socket.emit("NEW_MESSAGE")
       ↓
Frontend updates instantly
```

## Environment Variables

See `.env.example` for all required variables.

## Production Checklist

- [ ] Set strong `SECRET_KEY`
- [ ] Configure SSL certificates in `nginx/certs/`
- [ ] Set `META_VERIFY_TOKEN` and configure in Meta Developer Portal
- [ ] Set AWS credentials for media storage
- [ ] Update `CORS_ORIGINS` and `SOCKETIO_CORS_ORIGINS`
