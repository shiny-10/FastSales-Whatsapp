"""
Error handling middleware for FastAPI application.
"""

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from app.api.core.exceptions import WhatsAppInboxException
from app.api.core.constants import ErrorCodes, StatusMessages

logger = logging.getLogger(__name__)


class ErrorResponse:
    """Standardized error response format."""

    @staticmethod
    def format(
        message: str,
        error_code: str = ErrorCodes.INTERNAL_ERROR,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict = None,
    ) -> dict:
        """Format error response with consistent structure."""
        response = {
            "status": "error",
            "message": message,
            "error_code": error_code,
        }
        if details:
            response["details"] = details
        return response


async def custom_exception_handler(request: Request, exc: WhatsAppInboxException) -> JSONResponse:
    """Handle custom WhatsApp Inbox exceptions."""
    error_code = getattr(exc, "error_code", ErrorCodes.INTERNAL_ERROR)
    
    logger.warning(
        f"Application exception: {exc.message}",
        extra={
            "path": request.url.path,
            "method": request.method,
            "error_code": error_code,
        },
    )
    
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse.format(
            message=exc.message,
            error_code=error_code,
            status_code=exc.status_code,
        ),
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle unexpected exceptions."""
    logger.error(
        f"Unhandled exception: {str(exc)}",
        exc_info=exc,
        extra={
            "path": request.url.path,
            "method": request.method,
        },
    )
    
    # In production, don't expose internal details
    message = "Internal server error" if not hasattr(exc, "message") else str(exc)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorResponse.format(
            message=message,
            error_code=ErrorCodes.INTERNAL_ERROR,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        ),
    )
