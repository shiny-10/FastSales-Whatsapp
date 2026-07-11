"""
Application-wide constants and configuration values.
"""

# ── HTTP Status Messages ──────────────────────────────────────────────────────
class StatusMessages:
    """Standard response messages."""
    
    SUCCESS = "Operation successful"
    CREATED = "Resource created successfully"
    UPDATED = "Resource updated successfully"
    DELETED = "Resource deleted successfully"
    ERROR = "An error occurred"
    VALIDATION_ERROR = "Validation failed"
    NOT_FOUND = "Resource not found"
    UNAUTHORIZED = "Authentication required"
    FORBIDDEN = "Access denied"
    CONFLICT = "Resource conflict"
    RATE_LIMITED = "Too many requests"
    SERVER_ERROR = "Internal server error"


# ── WhatsApp API Constants ────────────────────────────────────────────────────
class WhatsAppConstants:
    """WhatsApp API related constants."""
    
    # Message types
    MESSAGE_TYPE_TEXT = "TEXT"
    MESSAGE_TYPE_IMAGE = "IMAGE"
    MESSAGE_TYPE_VIDEO = "VIDEO"
    MESSAGE_TYPE_AUDIO = "AUDIO"
    MESSAGE_TYPE_DOCUMENT = "DOCUMENT"
    MESSAGE_TYPE_TEMPLATE = "TEMPLATE"
    MESSAGE_TYPE_STICKER = "STICKER"
    MESSAGE_TYPE_LOCATION = "LOCATION"
    MESSAGE_TYPE_INTERACTIVE = "INTERACTIVE"
    
    # Sender types
    SENDER_TYPE_CUSTOMER = "CUSTOMER"
    SENDER_TYPE_AGENT = "AGENT"
    SENDER_TYPE_SYSTEM = "SYSTEM"
    
    # Message status
    STATUS_PENDING = "PENDING"
    STATUS_SENT = "SENT"
    STATUS_DELIVERED = "DELIVERED"
    STATUS_READ = "READ"
    STATUS_FAILED = "FAILED"
    
    # Conversation status
    CONVERSATION_OPEN = "OPEN"
    CONVERSATION_PENDING = "PENDING"
    CONVERSATION_RESOLVED = "RESOLVED"
    CONVERSATION_CLOSED = "CLOSED"
    
    # Webhook events
    WEBHOOK_MESSAGE_RECEIVED = "message"
    WEBHOOK_STATUS_UPDATE = "status"
    WEBHOOK_READ_RECEIPT = "read"


# ── Pagination Constants ──────────────────────────────────────────────────────
class PaginationDefaults:
    """Default pagination settings."""
    
    DEFAULT_PAGE = 1
    DEFAULT_PAGE_SIZE = 20
    MAX_PAGE_SIZE = 100
    MIN_PAGE_SIZE = 1


# ── Cache TTL (Time To Live) in seconds ───────────────────────────────────────
class CacheTTL:
    """Cache expiration times."""
    
    SHORT = 60  # 1 minute
    MEDIUM = 300  # 5 minutes
    LONG = 3600  # 1 hour
    VERY_LONG = 86400  # 24 hours


# ── Date/Time Formats ─────────────────────────────────────────────────────────
class DateFormats:
    """Standard date/time formats."""
    
    ISO_8601 = "%Y-%m-%dT%H:%M:%S.%fZ"
    DATE_ONLY = "%Y-%m-%d"
    DATE_TIME = "%Y-%m-%d %H:%M:%S"


# ── API Versioning ────────────────────────────────────────────────────────────
class APIVersion:
    """API version configuration."""
    
    V1 = "v1"
    CURRENT = V1


# ── Route Tags for Swagger Documentation ──────────────────────────────────────
class APITags:
    """Swagger documentation tags."""
    
    HEALTH = "Health"
    WHATSAPP = "WhatsApp"
    CONVERSATIONS = "Conversations"
    MESSAGES = "Messages"
    MEDIA = "Media"
    REACTIONS = "Reactions"
    MESSAGING_FEATURES = "Messaging Features"
    WEBHOOKS = "Webhooks"
    UPLOAD = "Upload"
    AUTHENTICATION = "Authentication"


# ── Error Codes ───────────────────────────────────────────────────────────────
class ErrorCodes:
    """Standard error codes for API responses."""
    
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    CONFLICT = "CONFLICT"
    RATE_LIMITED = "RATE_LIMITED"
    WHATSAPP_API_ERROR = "WHATSAPP_API_ERROR"
    DATABASE_ERROR = "DATABASE_ERROR"
    EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR"
    INTERNAL_ERROR = "INTERNAL_ERROR"


# ── File Upload Limits ────────────────────────────────────────────────────────
class UploadLimits:
    """File upload restrictions."""
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB
    MAX_IMAGE_SIZE = 16 * 1024 * 1024  # 16 MB
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
    ALLOWED_DOCUMENT_TYPES = {"application/pdf", "application/msword", "text/plain"}
    ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/mp4", "audio/ogg"}
    ALLOWED_VIDEO_TYPES = {"video/mp4", "video/quicktime"}


# ── Log Level ─────────────────────────────────────────────────────────────────
class LogLevel:
    """Logging level constants."""
    
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"
