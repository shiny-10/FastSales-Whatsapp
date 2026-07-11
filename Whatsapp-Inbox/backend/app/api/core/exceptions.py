"""
Custom exception classes for the WhatsApp Inbox application.
"""

from fastapi import status


class WhatsAppInboxException(Exception):
    """Base exception for WhatsApp Inbox application."""

    def __init__(self, message: str, status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(WhatsAppInboxException):
    """Raised when data validation fails."""

    def __init__(self, message: str):
        super().__init__(message, status.HTTP_422_UNPROCESSABLE_ENTITY)


class NotFoundError(WhatsAppInboxException):
    """Raised when a resource is not found."""

    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status.HTTP_404_NOT_FOUND)


class UnauthorizedError(WhatsAppInboxException):
    """Raised when authentication fails."""

    def __init__(self, message: str = "Unauthorized"):
        super().__init__(message, status.HTTP_401_UNAUTHORIZED)


class ForbiddenError(WhatsAppInboxException):
    """Raised when user lacks permission."""

    def __init__(self, message: str = "Forbidden"):
        super().__init__(message, status.HTTP_403_FORBIDDEN)


class ConflictError(WhatsAppInboxException):
    """Raised when there's a resource conflict."""

    def __init__(self, message: str = "Resource conflict"):
        super().__init__(message, status.HTTP_409_CONFLICT)


class WhatsAppAPIError(WhatsAppInboxException):
    """Raised when WhatsApp API call fails."""

    def __init__(self, message: str, error_code: str = None):
        super().__init__(message, status.HTTP_400_BAD_REQUEST)
        self.error_code = error_code


class DatabaseError(WhatsAppInboxException):
    """Raised when database operation fails."""

    def __init__(self, message: str):
        super().__init__(message, status.HTTP_500_INTERNAL_SERVER_ERROR)


class ExternalServiceError(WhatsAppInboxException):
    """Raised when external service (AWS, Redis) fails."""

    def __init__(self, message: str, service_name: str = None):
        super().__init__(message, status.HTTP_502_BAD_GATEWAY)
        self.service_name = service_name
