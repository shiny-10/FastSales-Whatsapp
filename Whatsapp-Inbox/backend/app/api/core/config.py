from pydantic_settings import BaseSettings
from typing import Optional
import secrets


class Settings(BaseSettings):
    # App
    APP_NAME: str = "WhatsApp Shared Inbox"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    SECRET_KEY: str = ""  # MUST be provided via .env
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/whatsapp_inbox"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # Meta / WhatsApp
    META_APP_ID: str = ""
    META_APP_SECRET: str = ""
    META_WEBHOOK_SKIP_SIGNATURE: bool = False
    META_VERIFY_TOKEN: str = "whatsapp_verify_token_secret"
    META_ACCESS_TOKEN: str = ""
    META_BUSINESS_ACCOUNT_ID: str = ""
    META_WHATSAPP_PHONE_NUMBER_ID: str = ""
    META_API_VERSION: str = "v23.0"
    META_BASE_URL: str = "https://graph.facebook.com"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_BUCKET_NAME: str = "whatsapp-inbox-media"
    AWS_SIGNED_URL_EXPIRY: int = 3600  # 1 hour

    # Socket.IO
    SOCKETIO_CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    SOCKETIO_ASYNC_MODE: str = "asgi"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Logging
    LOG_LEVEL: str = "INFO"

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"
    NEXT_PUBLIC_API_URL: str = "http://localhost:8000"
    NEXT_PUBLIC_SOCKET_URL: str = "http://localhost:8000"
    
    # Feature flags
    ENABLE_RATE_LIMITS: bool = False

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
