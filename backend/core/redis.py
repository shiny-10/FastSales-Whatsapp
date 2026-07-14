"""
Redis connection pool (synchronous).

Since the FastSales backend is fully synchronous, we use the standard
`redis` client with a connection pool.  A single pool is created on first
use and reused across requests.

Usage:
    from core.redis import get_redis_client

    r = get_redis_client()
    r.set("key", "value", ex=60)
    val = r.get("key")
"""

import redis as _redis

from core.config import settings

_pool: "_redis.ConnectionPool | None" = None

def get_redis_client() -> "_redis.Redis":
    """Return a Redis client backed by a shared connection pool."""
    global _pool
    if _pool is None:
        _pool = _redis.ConnectionPool.from_url(
            settings.REDIS_URL,
            decode_responses=True,
        )
    return _redis.Redis(connection_pool=_pool)

def close_redis() -> None:
    """Disconnect all Redis connections (call on application shutdown)."""
    global _pool
    if _pool is not None:
        _pool.disconnect()
        _pool = None
