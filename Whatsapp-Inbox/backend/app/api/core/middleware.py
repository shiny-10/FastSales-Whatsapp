"""
Production middleware:
  - Request ID injection
  - Structured request/response logging
  - Rate limiting via Redis
  - Process time header
"""
import time
import uuid
from typing import Callable
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.core.logging import get_logger
from app.db.redis import get_redis

logger = get_logger(__name__)


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-ID to every request/response."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status code, and duration for every request."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        request_id = getattr(request.state, "request_id", "-")

        logger.info(
            f"{request.method} {request.url.path} "
            f"→ {response.status_code} "
            f"[{duration_ms:.1f}ms] rid={request_id}"
        )
        response.headers["X-Process-Time"] = f"{duration_ms:.1f}ms"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter backed by Redis.
    Default: 200 requests / 60 seconds per IP.
    Webhook endpoint gets a higher limit (2 000 / 60 s).
    """

    WINDOW_SECONDS = 60
    DEFAULT_LIMIT = 200
    WEBHOOK_LIMIT = 2000

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting in test environments (no real Redis)
        try:
            redis = await get_redis()
        except Exception:
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        path = request.url.path
        limit = self.WEBHOOK_LIMIT if path.startswith("/webhooks") else self.DEFAULT_LIMIT
        key = f"rl:{client_ip}:{path[:30]}"

        try:
            pipe = redis.pipeline()
            now = int(time.time())
            window_start = now - self.WINDOW_SECONDS

            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zadd(key, {str(uuid.uuid4()): now})
            pipe.zcard(key)
            pipe.expire(key, self.WINDOW_SECONDS + 1)
            results = await pipe.execute()
            count = results[2]

            if count > limit:
                logger.warning(f"Rate limit exceeded: ip={client_ip} path={path}")
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many requests. Please slow down."},
                    headers={"Retry-After": str(self.WINDOW_SECONDS)},
                )
        except Exception as e:
            # If Redis is down, fail open (don't block requests)
            logger.error(f"Rate limiter Redis error: {e}")

        return await call_next(request)

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
