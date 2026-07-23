# FastSales WhatsApp CRM & Shared Team Inbox

FastSales WhatsApp is a multi-agent Shared Team Inbox and marketing campaign platform built to manage and scale messaging with customers using the official **WhatsApp Cloud Graph API**. It allows support and sales teams to collaborate in real-time, launch broadcast marketing campaigns, schedule messages, import contact files, and automate conversations using template messages and keyword-based chatbot rules.

---

## 🚀 Key Business Capabilities

1. **Unified Shared Team Inbox**: A real-time workspace for multiple agents to chat with customers over WhatsApp. Supports conversation sorting, archiving, and filtering (by Open, Pending, Unread, or Assigned status).
2. **Rich Media & Interactive Messaging**: Agent and customer messages support images, videos, audio clips, voice notes, documents, location messages, and message reaction emojis.
3. **Automated Blast Campaigns**: Launch personalized bulk broadcast marketing campaigns targeting lists of contacts, automatically replacing dynamic variables (like `{{name}}` and `{{order_id}}`) inside approved Meta templates.
4. **Meta Template Integrator**: Synchronize, inspect, and register official WhatsApp templates directly with the Meta Cloud API, including logging approval states.
5. **Smart Chatbots & Auto-Replies**: Trigger keyword-based or exact-match auto-responses. Built-in agent protection prevents automated bots from interrupting conversations if a human agent has recently replied.
6. **Canned Responses**: Predefined shortcuts (e.g., typing `/hello` to populate a full greeting) to improve agent response times.
7. **Scheduled Messages**: Queue text or template messages to be sent to customers at a future date and time.
8. **CRM Contact Import**: Bulk-import customer spreadsheets (CSV/XLSX) with automatic header normalization and contact matching.
9. **Dashboard Analytics**: Real-time stats showing messages sent, delivered, read, and failed, plus template category splits and delivery performance trends.

---

## 🛠️ Technical Architecture & Technology Stack

```mermaid
graph TD
    Client[Next.js 16 Frontend App] <-->|WebSockets /ws/org_id| Server[FastAPI Backend Server]
    Client <-->|REST API /api/...| Server
    Server <-->|SQLAlchemy ORM| DB[(PostgreSQL Database)]
    Server <-->|Redis Connection| Cache[Redis Cache]
    Server -->|APSRunner / Task Jobs| Worker[Background Scheduler]
    Server <-->|HTTPS Graph API| MetaAPI[Meta WhatsApp Business Cloud API]
    Server -->|S3 Upload/Storage| S3[(AWS S3 Bucket)]
```

### Frontend
- **Framework**: Next.js 16 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS v4, Radix UI Primitives (Select, Popover, Dialog, ScrollArea), and Framer Motion (for transitions)
- **State Management**: Zustand (real-time chat updates and notification states)
- **Client Cache**: TanStack React Query v5
- **Visuals & Charts**: Recharts & Chart.js
- **Real-Time Sync**: Socket.io-client / Native WebSockets

### Backend
- **Framework**: FastAPI (Python) running on Uvicorn
- **ORM & Database**: SQLAlchemy Declarative Models interfacing with PostgreSQL (`psycopg2-binary`)
- **Background Tasks**: APScheduler (Interval triggers for campaign sends and scheduled messages)
- **Media Processor**: AWS Boto3 (uploads incoming WhatsApp attachments to S3)
- **Data Processor**: Pandas & Openpyxl (Excel/CSV contact import and verification)
- **Security & Session**: PyJWT (JSON Web Token signature validation for multi-tenant organizations) and Redis for cache/WebSocket state

---

## 📊 Database Schema Design (SQLAlchemy ORM)

The database schema is organized into tenant configuration, contact records, campaign tracking, and inbox management entities:

- **`Organization`**: Multi-tenant unit (companies/entities using the CRM).
- **`WhatsAppAccount`**: Holds connection credentials (`waba_id`, `phone_number_id`, `access_token`) for each organization's WhatsApp Business Account.
- **`Contact`**: Customer details (`name`, `phone_number`, `email`, custom tags, and `order_id` links).
- **`Template`**: Metadata of Meta templates (`template_body`, buttons, header, category, and approval state).
- **`Campaign`**, **`CampaignContact`**, **`CampaignRecipient`**: Bulk templates broadcast records, mapping contacts to target campaigns and auditing individual message delivery states.
- **`WhatsAppInboxConversation`**: Real-time chat threads tracking active status (OPEN/PENDING/CLOSED), agent assignments, unread counters, and last seen timestamps.
- **`WhatsAppInboxMessage`**: WhatsApp thread message payloads tracking directions (`CUSTOMER` inbound vs `AGENT` outbound), sender types, message kinds (TEXT, IMAGE, VIDEO, AUDIO, etc.), and status (`SENT`, `DELIVERED`, `READ`, `FAILED`).
- **`WhatsAppInboxMediaFile`**: Tracks s3 storage keys, mime types, filenames, durations, and sizes for binary attachments.
- **`WhatsAppInboxMessageReaction`**: Stores emoji reactions from customers.
- **`WhatsAppInboxScheduledMessage`**: Future queued messages.
- **`WhatsAppInboxAutoReply`** & **`WhatsAppInboxChatbotRule`**: Automated responders based on offline fallback or keyword matches.
- **`WhatsAppInboxCannedResponse`**: Fast keyboard shortcuts for agent productivity.

---

## 🔄 Real-Time Events Flow (WebSockets)

FastAPI maintains an active connection manager `/ws/{org_id}`. Real-time updates flow bidirectionally:

1. **Incoming Message (Webhook)**: Meta sends a webhook POST requests containing customer messages/statuses/reactions to `/api/webhook`.
2. **Database Write**: `WebhookService` processes, deduplicates, and saves the message/reaction.
3. **Automated Actions**: Chatbots or Auto-Replies check text content and trigger responses if no agent is actively chatting.
4. **Broadcast**: Backend emits socket messages (`new_message`, `message_status`, `new_reaction`, `typing`, `conversation_update`) to all agents connected to the organization.
5. **Store Update**: Zustand store updates the UI instantly, moving conversation cards, incrementing badges, and scrolling the chat pane.

---

## ⚙️ Setting Up Local Development

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL
- Redis

### 1. Backend Setup
1. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
3. Configure the environment variables by creating `backend/.env`:
   ```env
   DATABASE_URL=postgresql://user:password@localhost:5432/fastsales
   REDIS_URL=redis://localhost:6379/0
   META_ACCESS_TOKEN=your_meta_access_token
   META_VERIFY_TOKEN=your_webhook_verify_token
   META_BUSINESS_ACCOUNT_ID=your_waba_id
   META_WHATSAPP_PHONE_NUMBER_ID=your_phone_id
   ENABLE_SCHEDULER=true
   ```
4. Run the database schema bootstrap:
   ```bash
   python -m backend.scripts.schema_bootstrap
   ```
5. Start the backend:
   ```bash
   .\run_backend.ps1   # Windows PowerShell script
   ```

### 2. Frontend Setup
1. Backend automatically syncs environment configs to `frontend/.env.local` upon startup.
2. Navigate to the frontend folder and install packages:
   ```bash
   cd frontend
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   # or from project root:
   .\run_frontend.ps1
   ```
4. Access the web dashboard at `http://localhost:3000`.

---

## 🤖 Context for LLMs/GPTs

*When pasting this project into another LLM, you can use the prompt below:*

> "I am working on a Next.js 16 + FastAPI + PostgreSQL + Redis project called **FastSales WhatsApp CRM**. It manages multi-agent shared team inboxes and automatic broadcast campaigns using the Meta WhatsApp Cloud API. WebSockets are used for real-time chat sync, APScheduler processes queued schedules and broadcasts, and a custom keyword-based chatbot replies to customers when human agents are offline. Here is the architecture and model structure: [Paste this README content]"
