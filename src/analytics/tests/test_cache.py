"""
Unit tests for cache utilities.

Tests the async Redis cache operations including initialization,
get, set, and delete operations.
"""

import logging
import socket

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

import api.utils.cache
from api.utils.cache import (
    init_cache,
    close_cache,
    cache_get,
    cache_incr,
    cache_ping,
    cache_set,
    cache_delete,
)


@pytest.fixture(autouse=True)
def reset_cache_state():
    """Start and end each test with no client and no outage state."""

    def reset():
        api.utils.cache._cache = None
        api.utils.cache._sentinel = None
        api.utils.cache._unavailable = False
        api.utils.cache._warned = False
        api.utils.cache._last_warning_at = None

    reset()
    yield
    reset()


class TestCacheClose:
    """Test that closing the cache closes the connection."""

    @pytest.mark.asyncio
    async def test_close_cache(self):
        """Test closing cache connection."""
        mock_redis = AsyncMock()

        # Manually set cache
        from api.utils.cache import _cache
        import api.utils.cache

        api.utils.cache._cache = mock_redis

        await close_cache()

        mock_redis.aclose.assert_called_once()
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
    async def test_recovers_without_restart_after_a_failed_startup(self):
        """The whole point: a command issued after Redis returns succeeds."""
        import api.utils.cache

        api.utils.cache._cache = None
        mock_redis = AsyncMock()
        mock_redis.ping.side_effect = Exception("Connection refused")

        with patch("redis.asyncio.from_url", return_value=mock_redis):
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
        with patch("redis.asyncio.from_url") as from_url:
            from_url.return_value = AsyncMock()
            await init_cache()

        kwargs = from_url.call_args.kwargs
        assert (
            kwargs["socket_connect_timeout"] == api.utils.cache._SOCKET_TIMEOUT_SECONDS
        )
        assert kwargs["socket_timeout"] == api.utils.cache._SOCKET_TIMEOUT_SECONDS

    @pytest.mark.asyncio
    async def test_client_speaks_resp2(self):
        """RESP2 works with every Redis server version."""
        with patch("redis.asyncio.from_url") as from_url:
            from_url.return_value = AsyncMock()
            await init_cache()

        assert from_url.call_args.kwargs["protocol"] == 2

    @pytest.mark.asyncio
    async def test_malformed_url_still_yields_no_client(self):
        """A URL that cannot build a client is not retryable — stay None."""
        import api.utils.cache

        api.utils.cache._cache = None
        with patch("redis.asyncio.from_url", side_effect=Exception("bad url")):
            await init_cache()

        assert api.utils.cache._cache is None


class TestSentinelStartup:
    """Each process chooses Sentinel or the direct server once, at startup."""

    @pytest.fixture(autouse=True)
    def sentinel_settings(self, monkeypatch):
        settings = api.utils.cache.settings
        monkeypatch.setattr(settings, "redis_sentinel_hosts", "s1,s2:26380")
        monkeypatch.setattr(settings, "redis_sentinel_master_name", "m")

    @staticmethod
    def _server(role):
        """A synchronous client whose ROLE reply is the given list or exception."""
        client = MagicMock()
        client.connection_pool.connection_kwargs = {"host": "h", "port": 6379}
        if isinstance(role, Exception):
            client.role.side_effect = role
        else:
            client.role.return_value = role
        return client

    @classmethod
    def _sync_sentinel(cls, master_answers: bool):
        """A patched synchronous Sentinel whose master answers or refuses."""
        master = cls._server(
            ["master", 0, []] if master_answers else ConnectionError("refused")
        )
        sentinel = MagicMock()
        sentinel.master_for.return_value = master
        sentinel.sentinels = [MagicMock(), MagicMock()]
        return sentinel, master

    @pytest.mark.asyncio
    async def test_not_configured_uses_the_direct_client(self, monkeypatch):
        monkeypatch.setattr(api.utils.cache.settings, "redis_sentinel_hosts", "")
        with patch("redis.sentinel.Sentinel") as sync_sentinel, patch(
            "redis.asyncio.sentinel.Sentinel"
        ) as async_sentinel, patch("redis.asyncio.from_url") as from_url:
            from_url.return_value = AsyncMock()
            await init_cache()

        sync_sentinel.assert_not_called()
        async_sentinel.assert_not_called()
        assert from_url.call_args.args == (api.utils.cache.settings.cache_redis_url,)

    @pytest.mark.asyncio
    async def test_master_that_answers_backs_the_client(self):
        sentinel, master = self._sync_sentinel(master_answers=True)
        async_sentinel = MagicMock()
        async_sentinel.master_for.return_value = AsyncMock()
        with patch("redis.sentinel.Sentinel", return_value=sentinel), patch(
            "redis.asyncio.sentinel.Sentinel", return_value=async_sentinel
        ) as async_class, patch("redis.asyncio.from_url") as from_url:
            await init_cache()

        from_url.assert_not_called()
        assert async_class.call_args.args == ([("s1", 26379), ("s2", 26380)],)
        assert async_sentinel.master_for.call_args.args == ("m",)
        assert api.utils.cache._cache is async_sentinel.master_for.return_value
        assert api.utils.cache._sentinel is async_sentinel
        master.close.assert_called_once()
        for node in sentinel.sentinels:
            node.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_direct_server_wins_when_only_it_answers(self, caplog):
        sentinel, _ = self._sync_sentinel(master_answers=False)
        with caplog.at_level(logging.WARNING, logger="api.utils.cache"):
            with patch("redis.sentinel.Sentinel", return_value=sentinel), patch(
                "redis.Redis.from_url", return_value=self._server(["master", 0, []])
            ) as direct, patch("redis.asyncio.sentinel.Sentinel") as async_class, patch(
                "redis.asyncio.from_url"
            ) as from_url:
                from_url.return_value = AsyncMock()
                await init_cache()

        assert direct.call_args.args == (api.utils.cache.settings.cache_redis_url,)
        async_class.assert_not_called()
        assert from_url.call_args.args == (api.utils.cache.settings.cache_redis_url,)
        assert api.utils.cache._sentinel is None
        levels = [r.levelno for r in caplog.records if r.name == "api.utils.cache"]
        assert levels == [logging.WARNING, logging.WARNING]

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "direct_role",
        [ConnectionError("refused"), ["slave", "h", 6379, "connected", 0]],
    )
    async def test_sentinel_wins_when_no_master_answers(self, direct_role):
        """A direct server that is a replica counts the same as one that is down."""
        sentinel, _ = self._sync_sentinel(master_answers=False)
        direct = self._server(direct_role)
        async_sentinel = MagicMock()
        async_sentinel.master_for.return_value = AsyncMock()
        with patch("redis.sentinel.Sentinel", return_value=sentinel), patch(
            "redis.Redis.from_url", return_value=direct
        ), patch("redis.asyncio.sentinel.Sentinel", return_value=async_sentinel), patch(
            "redis.asyncio.from_url"
        ) as from_url:
            await init_cache()

        from_url.assert_not_called()
        assert api.utils.cache._sentinel is async_sentinel

    def test_each_unreachable_node_costs_one_connection_attempt(self, monkeypatch):
        """Two Sentinel nodes and the direct server give three attempts, so a
        startup against hosts that time out is bounded by one timeout for each."""
        attempts = []

        def time_out(self):
            attempts.append((self.host, self.port))
            raise socket.timeout("timed out")

        monkeypatch.setattr("redis.connection.Connection._connect", time_out)

        assert api.utils.cache.use_sentinel() is True
        settings = api.utils.cache.settings
        direct = (settings.cache_redis_host, settings.cache_redis_port)
        assert attempts == [("s1", 26379), ("s2", 26380), direct]

    @pytest.mark.asyncio
    async def test_async_client_asks_each_node_once_and_closes(self, monkeypatch):
        """The real async Sentinel client carries the bounded options, tries
        each node once for a command, and close_cache releases every node client."""
        attempts = []

        async def time_out(self):
            attempts.append((self.host, self.port))
            raise socket.timeout("timed out")

        monkeypatch.setattr("redis.asyncio.connection.Connection._connect", time_out)
        monkeypatch.setattr(api.utils.cache, "use_sentinel", lambda: True)

        await init_cache()
        attempts.clear()

        timeout = api.utils.cache._SOCKET_TIMEOUT_SECONDS
        bounded = {
            "socket_connect_timeout": timeout,
            "socket_timeout": timeout,
            "protocol": 2,
        }
        master_kwargs = api.utils.cache._cache.connection_pool.connection_kwargs
        assert {k: master_kwargs[k] for k in bounded} == bounded
        assert master_kwargs["decode_responses"] is True
        for node in api.utils.cache._sentinel.sentinels:
            node_kwargs = node.connection_pool.connection_kwargs
            assert {k: node_kwargs[k] for k in bounded} == bounded
            assert node_kwargs["retry"]._retries == 0

        assert await cache_ping() is False
        assert attempts == [("s1", 26379), ("s2", 26380)]

        await close_cache()
        assert api.utils.cache._cache is None
        assert api.utils.cache._sentinel is None

    @pytest.mark.asyncio
    async def test_close_cache_closes_the_node_clients_without_a_master_client(self):
        api.utils.cache._cache = None
        sentinel = MagicMock()
        sentinel.sentinels = [AsyncMock(), AsyncMock()]
        api.utils.cache._sentinel = sentinel

        await close_cache()

        for node in sentinel.sentinels:
            node.aclose.assert_awaited_once()
        assert api.utils.cache._sentinel is None


class TestCachePing:
    """The readiness probe sends one PING through cache_ping."""

    def setup_method(self):
        import api.utils.cache

        self.mock_redis = AsyncMock()
        api.utils.cache._cache = self.mock_redis
        api.utils.cache._unavailable = False

    def teardown_method(self):
        import api.utils.cache

        api.utils.cache._cache = None
        api.utils.cache._unavailable = False

    @pytest.mark.asyncio
    async def test_true_when_redis_answers(self):
        assert await cache_ping() is True
        self.mock_redis.ping.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_false_when_redis_fails(self):
        self.mock_redis.ping.side_effect = ConnectionError("refused")
        assert await cache_ping() is False

    @pytest.mark.asyncio
    async def test_false_when_cache_missing(self):
        import api.utils.cache

        api.utils.cache._cache = None
        assert await cache_ping() is False


class _Clock:
    """A monotonic clock that the test moves forward."""

    def __init__(self):
        self.now = 1000.0

    def monotonic(self):
        return self.now


def _pipeline_client(fails: bool):
    """A client whose incr pipeline fails or returns a count of 1."""
    client = AsyncMock()
    pipeline = MagicMock()
    if fails:
        pipeline.execute = AsyncMock(side_effect=ConnectionError("refused"))
    else:
        pipeline.execute = AsyncMock(return_value=[1, 60])
    client.pipeline = MagicMock(return_value=pipeline)
    return client


class TestOutageLogging:
    """An outage writes one WARNING record, and the first success after it
    writes one INFO record.  A WARNING comes at most once a minute."""

    @pytest.fixture(autouse=True)
    def clock(self, monkeypatch):
        clock = _Clock()
        monkeypatch.setattr(api.utils.cache, "time", clock)
        return clock

    def _levels(self, caplog):
        return [r.levelno for r in caplog.records if r.name == "api.utils.cache"]

    def _redis(self, fails: bool):
        client = _pipeline_client(fails)
        error = ConnectionError("refused") if fails else None
        client.get.side_effect = error
        client.set.side_effect = error
        client.delete.side_effect = error
        client.ping.side_effect = error
        client.get.return_value = "v"
        client.set.return_value = True
        client.delete.return_value = 1
        api.utils.cache._cache = client

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "call",
        [
            lambda: cache_get("k"),
            lambda: cache_set("k", "v"),
            lambda: cache_incr("k", 60),
            lambda: cache_delete("k"),
            lambda: cache_ping(),
        ],
        ids=["get", "set", "incr", "delete", "ping"],
    )
    async def test_each_helper_logs_the_outage_and_the_recovery(self, caplog, call):
        with caplog.at_level(logging.DEBUG, logger="api.utils.cache"):
            self._redis(fails=True)
            await call()
            await call()
            self._redis(fails=False)
            await call()

        assert self._levels(caplog) == [logging.WARNING, logging.DEBUG, logging.INFO]

    @pytest.mark.asyncio
    async def test_a_fault_that_switches_writes_one_pair_a_minute(self, caplog, clock):
        with caplog.at_level(logging.DEBUG, logger="api.utils.cache"):
            for _ in range(3):
                self._redis(fails=True)
                await cache_get("k")
                self._redis(fails=False)
                await cache_get("k")
                clock.now += 10

        assert self._levels(caplog) == [
            logging.WARNING,
            logging.INFO,
            logging.DEBUG,
            logging.DEBUG,
        ]

    @pytest.mark.asyncio
    async def test_an_outage_a_minute_after_the_last_warning_warns_again(
        self, caplog, clock
    ):
        with caplog.at_level(logging.DEBUG, logger="api.utils.cache"):
            self._redis(fails=True)
            await cache_get("k")
            self._redis(fails=False)
            await cache_get("k")
            clock.now += 60
            self._redis(fails=True)
            await cache_get("k")

        assert self._levels(caplog) == [
            logging.WARNING,
            logging.INFO,
            logging.WARNING,
        ]

    @pytest.mark.asyncio
    async def test_a_failed_startup_ping_marks_the_outage(self, caplog):
        """The startup ERROR stands for the outage, so the first failed call
        writes a DEBUG record, and the first successful call an INFO record."""
        failing = AsyncMock()
        failing.ping.side_effect = ConnectionError("refused")
        with caplog.at_level(logging.DEBUG, logger="api.utils.cache"):
            with patch("redis.asyncio.from_url", return_value=failing):
                await init_cache()
            self._redis(fails=True)
            await cache_get("k")
            self._redis(fails=False)
            await cache_get("k")

        assert self._levels(caplog) == [logging.ERROR, logging.DEBUG, logging.INFO]
