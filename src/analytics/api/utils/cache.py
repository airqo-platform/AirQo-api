"""
Async Redis client used for rate limiting and the readiness probe.

When Redis is unreachable the helpers degrade instead of raising: `cache_get`
returns None, `cache_set` returns False, `cache_incr` returns None and
`cache_ping` returns False, each attempt bounded by the socket timeout below.
`cache_incr` returning None means "unknown", not "zero" — it is the signal the
rate limiter uses to fall back to per-process counters. The client itself is
None only when the Redis URL is malformed.

The first failed call of an outage writes a WARNING record, and each later
failed call writes a DEBUG record. The first successful call after a WARNING
writes an INFO record. A WARNING comes at most once in each
_OUTAGE_WARNING_INTERVAL_SECONDS, so a fault that switches between failure
and success writes one WARNING and INFO pair in that interval.
"""

import logging
import time
from typing import Optional

import redis.asyncio as redis_asyncio

from config import settings

logger = logging.getLogger(__name__)

# Global cache instance
_cache: Optional[redis_asyncio.Redis] = None

# True from a failed call to the next successful call.
_unavailable = False

# True from an outage WARNING to the INFO record of the next successful call.
_warned = False

# The monotonic time of the last outage WARNING.
_last_warning_at: Optional[float] = None

_OUTAGE_WARNING_INTERVAL_SECONDS = 60.0

# Bounds how long a request can stall on an unreachable Redis. Every call
# retries the connection, so this is the per-request cost of a Redis outage.
_SOCKET_TIMEOUT_SECONDS = 1.0


def _record_failure(operation: str, key: Optional[str], exc: Exception) -> None:
    """
    Log a failed call.

    The first failure after a successful call writes a WARNING when the last
    WARNING is at least _OUTAGE_WARNING_INTERVAL_SECONDS old.  Every other
    failure writes a DEBUG record.
    """
    global _unavailable, _warned, _last_warning_at

    target = f" for key {key}" if key is not None else ""
    now = time.monotonic()
    first_failure = not _unavailable
    _unavailable = True
    if first_failure and (
        _last_warning_at is None
        or now - _last_warning_at >= _OUTAGE_WARNING_INTERVAL_SECONDS
    ):
        _last_warning_at = now
        _warned = True
        logger.warning(
            "Redis unavailable: cache %s failed%s: %s. Later failures log at "
            "DEBUG level until Redis answers.",
            operation,
            target,
            exc,
        )
        return
    logger.debug("Cache %s failed%s: %s", operation, target, exc)


def _record_success() -> None:
    """Log the first successful call after an outage WARNING."""
    global _unavailable, _warned

    _unavailable = False
    if _warned:
        _warned = False
        logger.info("Redis available again")


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

    The client speaks RESP2 (protocol=2), which every Redis server version
    supports.  A failed ping marks the outage,
    so the startup ERROR record stands for it and the first successful call
    writes the INFO record.
    """
    global _cache, _unavailable, _warned

    try:
        _cache = redis_asyncio.from_url(
            settings.cache_redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=_SOCKET_TIMEOUT_SECONDS,
            protocol=2,
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
        _unavailable = True
        _warned = True
        logger.error(
            f"Redis unreachable at startup ({str(e)}). Continuing in degraded "
            "mode: rate limiting uses per-process counters and /health/ready "
            "reports 503 until Redis answers. The client will reconnect by "
            "itself — no restart needed."
        )


async def close_cache() -> None:
    """
    Close the cache connection.

    This function should be called during application shutdown.
    """
    global _cache

    if _cache:
        await _cache.aclose()
        _cache = None
        logger.info("Redis cache connection closed")


async def cache_ping() -> bool:
    """
    Send one PING to Redis.

    Returns:
        True when Redis answers the PING, and False when the PING fails or
        the client is missing.
    """
    if not _cache:
        return False

    try:
        await _cache.ping()
    except Exception as e:
        _record_failure("ping", None, e)
        return False
    _record_success()
    return True


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
        value = await _cache.get(key)
    except Exception as e:
        _record_failure("get", key, e)
        return None
    _record_success()
    return value


async def cache_set(key: str, value: str, expire: Optional[int] = None) -> bool:
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
        result = await _cache.set(key, value, ex=expire)
    except Exception as e:
        _record_failure("set", key, e)
        return False
    _record_success()
    return result


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
    except Exception as e:
        _record_failure("incr", key, e)
        return None
    _record_success()
    return int(count)


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
        deleted = bool(await _cache.delete(key))
    except Exception as e:
        _record_failure("delete", key, e)
        return False
    _record_success()
    return deleted
