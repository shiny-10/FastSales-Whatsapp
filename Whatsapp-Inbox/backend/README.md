# WhatsApp Shared Inbox Backend

Production-grade FastAPI backend for WhatsApp shared inbox platform.

## Project Structure

```
backend/
├── app/                          # Application code
│   ├── core/                    # Core configuration
│   │   ├── config.py           # Settings management
│   │   ├── environments.py      # Environment profiles
│   │   ├── logging.py           # Logging configuration
│   │   ├── middleware.py        # Custom middleware
│   │   ├── security.py          # Authentication/authorization
│   │   └── webhook_security.py  # Webhook signature verification
│   ├── models/                  # SQLAlchemy ORM models
│   │   └── postgres_models.py   # All consolidated models
│   ├── repositories/            # Data access layer
│   ├── routes/                  # API endpoints (v1)
│   ├── schemes/                 # Pydantic schemas/DTOs
│   ├── services/                # Business logic layer
│   ├── utils/                   # Database utilities (Base, Session, Redis)
│   ├── exceptions.py            # Custom exception classes
│   ├── constants.py             # Application constants
│   ├── error_handlers.py        # Centralized error handling
│   ├── main.py                  # FastAPI app initialization
│   └── __init__.py
├── tests/                        # Unit and integration tests
│   ├── conftest.py             # Pytest configuration
│   ├── test_health.py          # Health check tests
│   └── utils.py                # Test utilities
├── scripts/                      # Utility scripts
│   └── README.md               # Script documentation
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── requirements.txt             # Python dependencies
├── pytest.ini                   # Pytest configuration
├── Dockerfile                   # Docker image definition
└── README.md                    # This file
```

## Quick Start

### 1. Setup Python Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Optional: copy example configuration for local development overrides
cp .env.example .env

# Edit .env only if you want local values for:
# - Database URL
# - Meta/WhatsApp API credentials
# - AWS S3 credentials
# - Redis URL
```

> Note: the backend reads environment variables directly and does not require a `.env` file in production or when Docker provides the values.

### 3. Database Setup

```bash
# Initialize the database directly from SQLAlchemy models
python scripts/init_db.py init

# (Optional) Seed sample data
python -m scripts.seed_data
```

### 4. Run Development Server

```bash
# Start with auto-reload
uvicorn app.main:socket_app --reload --port 8000

# Or with environment variables
ENV=development uvicorn app.main:socket_app --reload --port 8000
```

## Environment Profiles

### Development
- Debug mode enabled
- Detailed logging
- CORS wildcard allowed
- Rate limiting disabled
- Database echo enabled

```bash
DEBUG=true
LOG_LEVEL=DEBUG
ENABLE_RATE_LIMITS=false
```

### Staging
- Debug disabled
- Standard logging
- Specific CORS origins required
- Rate limiting enabled
- Database echo disabled

```bash
DEBUG=false
LOG_LEVEL=INFO
ENABLE_RATE_LIMITS=true
```

### Production
- Debug disabled
- Minimal logging (WARNING level)
- Strict CORS configuration
- Rate limiting enabled
- Database echo disabled
- Higher connection pool size

```bash
DEBUG=false
LOG_LEVEL=WARNING
ENABLE_RATE_LIMITS=true
DATABASE_POOL_SIZE=50
```

## API Endpoints

All endpoints are versioned under `/api/v1/`

### Health Check
- `GET /` - Root endpoint
- `GET /health` - Health check

### WhatsApp Management
- `POST /api/v1/whatsapp/connect` - Connect WhatsApp account
- `GET /api/v1/whatsapp/account` - Get account info
- `DELETE /api/v1/whatsapp/disconnect` - Disconnect account

### Conversations
- `GET /api/v1/conversations` - List conversations
- `GET /api/v1/conversations/{id}` - Get conversation
- `PATCH /api/v1/conversations/{id}` - Update conversation
- `POST /api/v1/conversations/{id}/assign` - Assign agent

### Messages
- `POST /api/v1/messages/send/text` - Send text message
- `POST /api/v1/messages/send/media` - Send media message
- `POST /api/v1/messages/send/template` - Send template message
- `GET /api/v1/messages/{id}/reactions` - Get message reactions

### Webhooks
- `GET /webhooks/meta` - Webhook verification
- `POST /webhooks/meta` - Receive events

### Documentation
- `GET /docs` - Swagger UI with custom banner
- `GET /redoc` - ReDoc documentation

## Testing

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_health.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run async tests
pytest -v --asyncio-mode=auto
```

### Database Initialization

```bash
# Create all database tables directly from SQLAlchemy models
python scripts/init_db.py init

# Drop and recreate all tables (destructive)
python scripts/init_db.py reset
```

## Debugging

### Enable SQLAlchemy Echo
```python
# In .env
SQLALCHEMY_ECHO=true
```

### View Request Logs
```python
# Logs include request ID, path, method, duration
# Check app.log file
```

### Health Checks
```bash
# Check API health
curl http://localhost:8000/health

# Check with detailed info
curl http://localhost:8000/
```

## Error Handling

All errors follow a consistent format:

```json
{
  "status": "error",
  "message": "Error description",
  "error_code": "ERROR_TYPE",
  "details": {}  // Optional additional details
}
```

### Error Codes
- `VALIDATION_ERROR` - Input validation failed
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Permission denied
- `CONFLICT` - Resource conflict
- `WHATSAPP_API_ERROR` - WhatsApp API error
- `DATABASE_ERROR` - Database operation failed
- `EXTERNAL_SERVICE_ERROR` - External service error
- `INTERNAL_ERROR` - Unexpected server error

## Constants

Application-wide constants are defined in `app/constants.py`:

- `StatusMessages` - Standard response messages
- `WhatsAppConstants` - WhatsApp API values
- `APITags` - Swagger documentation tags
- `ErrorCodes` - Standard error codes
- `UploadLimits` - File upload restrictions

## Logging

Logging is configured in `app/core/logging.py`:

- Request ID middleware adds unique ID to all logs
- Structured logging for better analysis
- Different levels for different environments
- Log files in `logs/` directory

```python
# Usage in code
from app.core.logging import get_logger

logger = get_logger(__name__)
logger.info("Message", extra={"key": "value"})
```

## Security

### Webhook Verification
- Signature verification enabled by default
- HMAC-SHA256 validation
- Can be disabled in development with `META_WEBHOOK_SKIP_SIGNATURE=true`

### JWT Authentication
- Access tokens with 24-hour expiry
- Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
- Uses HS256 algorithm by default

### CORS
- Configurable allowed origins
- Credentials support
- Wildcard allowed in development only

## Deployment

### Docker
```bash
# Build image
docker build -t whatsapp-inbox-api:latest .

# Run container
docker run -p 8000:8000 --env-file .env whatsapp-inbox-api:latest
```

### Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## Contributing

1. Create feature branch: `git checkout -b feature/description`
2. Make changes and commit: `git commit -m "Add feature"`
3. Write/update tests
4. Run tests: `pytest`
5. Push: `git push origin feature/description`
6. Create Pull Request

## Troubleshooting

### Database Connection Error
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Verify credentials and database exists

### Redis Connection Error
- Check `REDIS_URL` in `.env`
- Ensure Redis is running
- Verify connection string format

### WhatsApp Webhook Errors
- Verify webhook token in Meta Business Manager
- Check signature verification settings
- Review webhook logs

### CORS Errors
- Add frontend URL to `CORS_ORIGINS`
- Check browser console for actual origin being used
- Ensure credentials are included in requests

## License

All rights reserved.
