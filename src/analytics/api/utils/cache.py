"""
Cache Initialization and Management for FastAPI

This module provides async-compatible caching functionality
using Redis as the backend, replacing Flask-Caching.
"""

import logging
from typing import Optional
import aioredis
from config import settings

logger = logging.getLogger(__name__)

# Global cache instance
_cache: Optional[aioredis.Redis] = None


async def init_cache() -> None:
    """
    Initialize the Redis cache connection.

    This function should be called during application startup.
    """
    global _cache

    try:
        _cache = aioredis.from_url(
            settings.cache_redis_url, encoding="utf-8", decode_responses=True
        )

        # Test the connection
        await _cache.ping()
        logger.info("Redis cache initialized successfully")

    except Exception as e:
        logger.error(f"Failed to initialize Redis cache: {str(e)}")
        # Continue without cache - application should still work
        _cache = None


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
    Callers must treat None as "unknown" — for rate limiting that means
    failing closed, not waving the request through.

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
