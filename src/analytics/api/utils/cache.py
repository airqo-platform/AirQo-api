"""
Async Redis client used for rate limiting and the readiness probe.

When Redis is unreachable the helpers degrade instead of raising: `cache_get`
returns None, `cache_set` returns False and `cache_incr` returns None, each
attempt bounded by the socket timeout below. `cache_incr` returning None means
"unknown", not "zero" — it is the signal the rate limiter uses to fall back
to per-process counters. The client itself is None only when the Redis URL
is malformed.
"""

import logging
from typing import Optional
import aioredis
from config import settings

logger = logging.getLogger(__name__)

# Global cache instance
_cache: Optional[aioredis.Redis] = None

# Bounds how long a request can stall on an unreachable Redis. Every call
# retries the connection, so this is the per-request cost of a Redis outage.
_SOCKET_TIMEOUT_SECONDS = 1.0


async def init_cache() -> None:
    """
    Create the Redis client during application startup.

    The client is kept even when the initial ping fails. `from_url` does not
    open a connection — the pool connects lazily on the first command — so
    holding on to it lets the service pick Redis up on its own once it comes
    back.

    Timeouts are deliberately short: while Redis is unreachable every request
    still attempts a connection, and without a bound that attempt would stall
    the request for the OS-level TCP timeout.
    """
    global _cache

    try:
        _cache = aioredis.from_url(
            settings.cache_redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=_SOCKET_TIMEOUT_SECONDS,
        )
    except Exception as e:
        # Only a malformed URL reaches here; there is nothing to retry.
        logger.error(f"Failed to create Redis client: {str(e)}")
        _cache = None
        return

    try:
        await _cache.ping()
        logger.info("Redis cache initialized successfully")
    except Exception as e:
        logger.error(
            f"Redis unreachable at startup ({str(e)}). Continuing in degraded "
            "mode: rate limiting uses per-process counters and /health/ready "
            "reports 503 until Redis answers. The client will reconnect by "
            "itself — no restart needed."
        )


async def get_cache() -> Optional[aioredis.Redis]:
    """
    Get the cache instance.

    Returns:
        Redis cache instance or None if not initialized
    """
    return _cache


async def close_cache() -> None:
    """
    Close the cache connection.

    This function should be called during application shutdown.
    """
    global _cache

    if _cache:
        await _cache.close()
        _cache = None
        logger.info("Redis cache connection closed")


async def cache_get(key: str) -> Optional[str]:
    """
    Get a value from cache.

    Args:
        key: Cache key

    Returns:
        Cached value or None if not found
    """
    if not _cache:
        return None

    try:
        return await _cache.get(key)
    except Exception as e:
        logger.warning(f"Cache get failed for key {key}: {str(e)}")
        return None


async def cache_set(key: str, value: str, expire: int = None) -> bool:
    """
    Set a value in cache.

    Args:
        key: Cache key
        value: Value to cache
        expire: Expiration time in seconds (optional)

    Returns:
        True if successful, False otherwise
    """
    if not _cache:
        return False

    try:
        return await _cache.set(key, value, ex=expire)
    except Exception as e:
        logger.warning(f"Cache set failed for key {key}: {str(e)}")
        return False


async def cache_incr(key: str, expire: int) -> Optional[int]:
    """
    Atomically increment a counter, setting its TTL only on creation.

    Returns the post-increment value, or None when the cache is unavailable.
    Callers must treat None as "unknown", not "zero" — the rate limiter
    responds by falling back to its in-process counters.

    The TTL is applied only when the counter is created (the INCR returned 1).
    Refreshing it on every hit would keep a busy client's key alive forever,
    turning the fixed window into an ever-accumulating counter that eventually
    locks the client out permanently.
    """
    if not _cache:
        return None

    try:
        pipeline = _cache.pipeline()
        pipeline.incr(key)
        pipeline.ttl(key)
        count, ttl = await pipeline.execute()

        # ttl < 0 means "no expiry set" (-1) or "missing" (-2); either way the
        # window has no deadline yet, so give it one.
        if int(count) == 1 or int(ttl) < 0:
            await _cache.expire(key, expire)

        return int(count)
    except Exception as e:
        logger.warning(f"Cache incr failed for key {key}: {str(e)}")
        return None


async def cache_delete(key: str) -> bool:
    """
    Delete a value from cache.

    Args:
        key: Cache key

    Returns:
        True if successful, False otherwise
    """
    if not _cache:
        return False

    try:
        return bool(await _cache.delete(key))
    except Exception as e:
        logger.warning(f"Cache delete failed for key {key}: {str(e)}")
        return False
