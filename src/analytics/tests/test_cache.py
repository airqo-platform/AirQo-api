"""
Unit tests for cache utilities.

Tests the async Redis cache operations including initialization,
get, set, and delete operations.
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import aioredis

from api.utils.cache import (
    init_cache,
    get_cache,
    close_cache,
    cache_get,
    cache_incr,
    cache_set,
    cache_delete,
)


class TestCacheInitialization:
    """Test cache initialization and lifecycle management."""

    @pytest.mark.asyncio
    async def test_init_cache_success(self):
        """Test successful cache initialization."""
        with patch("api.utils.cache.settings") as mock_settings, patch(
            "aioredis.from_url"
        ) as mock_from_url:
            mock_settings.cache_redis_url = "redis://localhost:6379"
            mock_redis = AsyncMock()
            mock_from_url.return_value = mock_redis
            mock_redis.ping.return_value = None

            await init_cache()

            mock_from_url.assert_called_once()
            mock_redis.ping.assert_called_once()

    @pytest.mark.asyncio
    async def test_init_cache_failure(self):
        """Test cache initialization failure."""
        with patch("api.utils.cache.settings") as mock_settings, patch(
            "aioredis.from_url"
        ) as mock_from_url:
            mock_settings.cache_redis_url = "redis://localhost:6379"
            mock_from_url.side_effect = Exception("Connection failed")

            await init_cache()

            # Should not raise exception, cache should be None
            cache = await get_cache()
            assert cache is None

    @pytest.mark.asyncio
    async def test_get_cache_when_initialized(self):
        """Test getting cache instance when initialized."""
        with patch("aioredis.from_url") as mock_from_url:
            mock_redis = AsyncMock()
            mock_from_url.return_value = mock_redis

            # Manually set cache for testing
            from api.utils.cache import _cache
            import api.utils.cache

            api.utils.cache._cache = mock_redis

            cache = await get_cache()
            assert cache == mock_redis

            # Reset
            api.utils.cache._cache = None

    @pytest.mark.asyncio
    async def test_get_cache_when_not_initialized(self):
        """Test getting cache instance when not initialized."""
        # Ensure cache is None
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = None

        cache = await get_cache()
        assert cache is None

    @pytest.mark.asyncio
    async def test_close_cache(self):
        """Test closing cache connection."""
        mock_redis = AsyncMock()

        # Manually set cache
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = mock_redis

        await close_cache()

        mock_redis.close.assert_called_once()
        assert api.utils.cache._cache is None


class TestCacheOperations:
    """Test cache get, set, and delete operations."""

    def setup_method(self):
        """Set up test fixtures."""
        self.mock_redis = AsyncMock()
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = self.mock_redis

    def teardown_method(self):
        """Clean up test fixtures."""
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = None

    @pytest.mark.asyncio
    async def test_cache_get_success(self):
        """Test successful cache get operation."""
        self.mock_redis.get.return_value = "test_value"

        result = await cache_get("test_key")

        assert result == "test_value"
        self.mock_redis.get.assert_called_once_with("test_key")

    @pytest.mark.asyncio
    async def test_cache_get_failure(self):
        """Test cache get operation failure."""
        self.mock_redis.get.side_effect = Exception("Redis error")

        result = await cache_get("test_key")

        assert result is None

    @pytest.mark.asyncio
    async def test_cache_get_no_cache(self):
        """Test cache get when cache is not initialized."""
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = None

        result = await cache_get("test_key")

        assert result is None

    @pytest.mark.asyncio
    async def test_cache_set_success(self):
        """Test successful cache set operation."""
        self.mock_redis.set.return_value = True

        result = await cache_set("test_key", "test_value")

        assert result is True
        self.mock_redis.set.assert_called_once_with("test_key", "test_value", ex=None)

    @pytest.mark.asyncio
    async def test_cache_set_with_expiry(self):
        """Test cache set operation with expiry."""
        self.mock_redis.set.return_value = True

        result = await cache_set("test_key", "test_value", expire=300)

        assert result is True
        self.mock_redis.set.assert_called_once_with("test_key", "test_value", ex=300)

    @pytest.mark.asyncio
    async def test_cache_set_failure(self):
        """Test cache set operation failure."""
        self.mock_redis.set.side_effect = Exception("Redis error")

        result = await cache_set("test_key", "test_value")

        assert result is False

    @pytest.mark.asyncio
    async def test_cache_set_no_cache(self):
        """Test cache set when cache is not initialized."""
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = None

        result = await cache_set("test_key", "test_value")

        assert result is False

    @pytest.mark.asyncio
    async def test_cache_delete_success(self):
        """Test successful cache delete operation."""
        self.mock_redis.delete.return_value = 1

        result = await cache_delete("test_key")

        assert result is True
        self.mock_redis.delete.assert_called_once_with("test_key")

    @pytest.mark.asyncio
    async def test_cache_delete_not_found(self):
        """Test cache delete when key doesn't exist."""
        self.mock_redis.delete.return_value = 0

        result = await cache_delete("test_key")

        assert result is False

    @pytest.mark.asyncio
    async def test_cache_delete_failure(self):
        """Test cache delete operation failure."""
        self.mock_redis.delete.side_effect = Exception("Redis error")

        result = await cache_delete("test_key")

        assert result is False

    @pytest.mark.asyncio
    async def test_cache_delete_no_cache(self):
        """Test cache delete when cache is not initialized."""
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = None

        result = await cache_delete("test_key")

        assert result is False


class TestCacheIncr:
    """cache_incr backs rate limiting, so its atomicity and TTL handling are
    security-relevant, not just correctness details."""

    def setup_method(self):
        import api.utils.cache

        self.mock_redis = AsyncMock()
        api.utils.cache._cache = self.mock_redis

    def _pipeline(self, count, ttl):
        pipeline = MagicMock()
        pipeline.execute = AsyncMock(return_value=[count, ttl])
        # redis-py's .pipeline() is sync (only .execute() awaits), so it must
        # be a plain MagicMock — an AsyncMock would hand back a coroutine.
        self.mock_redis.pipeline = MagicMock(return_value=pipeline)
        return pipeline

    @pytest.mark.asyncio
    async def test_sets_ttl_on_first_increment(self):
        self._pipeline(count=1, ttl=-1)
        assert await cache_incr("k", 60) == 1
        self.mock_redis.expire.assert_awaited_once_with("k", 60)

    @pytest.mark.asyncio
    async def test_does_not_refresh_ttl_on_later_increments(self):
        """Refreshing the TTL every hit kept a busy client's key alive forever,
        so the counter accumulated and eventually locked them out for good."""
        self._pipeline(count=7, ttl=42)
        assert await cache_incr("k", 60) == 7
        self.mock_redis.expire.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_restores_ttl_when_key_lost_its_expiry(self):
        self._pipeline(count=7, ttl=-1)
        await cache_incr("k", 60)
        self.mock_redis.expire.assert_awaited_once_with("k", 60)

    @pytest.mark.asyncio
    async def test_returns_none_when_cache_missing(self):
        import api.utils.cache

        api.utils.cache._cache = None
        assert await cache_incr("k", 60) is None

    @pytest.mark.asyncio
    async def test_returns_none_on_redis_error(self):
        """None is the signal the limiter uses to fall back to local counters."""
        self.mock_redis.pipeline.side_effect = Exception("Redis down")
        assert await cache_incr("k", 60) is None


class TestRedisRecovery:
    """Starting while Redis is down must not disable Redis for the lifetime of
    the process. `from_url` does not connect — the pool connects lazily — so
    the client is kept and the service picks Redis up when it returns."""

    def teardown_method(self):
        # These tests deliberately leave a mock in the module-global _cache;
        # restore it so later test files never talk to a leaked mock.
        import api.utils.cache

        api.utils.cache._cache = None

    @pytest.mark.asyncio
    async def test_client_is_retained_when_startup_ping_fails(self):
        import api.utils.cache

        api.utils.cache._cache = None
        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = Exception("Connection refused")

        with patch("aioredis.from_url", return_value=mock_redis):
            await init_cache()

        # Retained, not discarded — otherwise every helper short-circuits
        # forever and nothing ever retries.
        assert api.utils.cache._cache is mock_redis

    @pytest.mark.asyncio
    async def test_recovers_without_restart_after_a_failed_startup(self):
        """The whole point: a command issued after Redis returns succeeds."""
        import api.utils.cache

        api.utils.cache._cache = None
        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = Exception("Connection refused")

        with patch("aioredis.from_url", return_value=mock_redis):
            await init_cache()

        # Redis comes back: the pipeline now works.
        pipeline = MagicMock()
        pipeline.execute = AsyncMock(return_value=[1, -1])
        mock_redis.pipeline = MagicMock(return_value=pipeline)

        assert await cache_incr("k", 60) == 1

    @pytest.mark.asyncio
    async def test_socket_timeouts_are_bounded(self):
        """Without these, every request during an outage would stall on the
        OS-level TCP timeout rather than falling back promptly."""
        import api.utils.cache

        api.utils.cache._cache = None
        with patch("aioredis.from_url") as from_url:
            from_url.return_value = AsyncMock()
            await init_cache()

        kwargs = from_url.call_args.kwargs
        assert (
            kwargs["socket_connect_timeout"] == api.utils.cache._SOCKET_TIMEOUT_SECONDS
        )
        assert kwargs["socket_timeout"] == api.utils.cache._SOCKET_TIMEOUT_SECONDS

    @pytest.mark.asyncio
    async def test_malformed_url_still_yields_no_client(self):
        """A URL that cannot build a client is not retryable — stay None."""
        import api.utils.cache

        api.utils.cache._cache = None
        with patch("aioredis.from_url", side_effect=Exception("bad url")):
            await init_cache()

        assert api.utils.cache._cache is None
