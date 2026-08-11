"""
Tests for rate limiting — both the global middleware and the per-route
RouteRateLimit dependency used by v3.

The in-memory cache from conftest.py (autouse) replaces Redis, so no real
network calls are made.

Three properties matter here and each has its own section below:
  * quota is consumed BEFORE the handler runs (concurrent bursts can't slip
    past a stale read),
  * X-Forwarded-For is only trusted from a configured proxy (it is otherwise
    client-settable, making the limit trivially bypassable),
  * an unreachable Redis fails CLOSED (these endpoints trigger billable
    BigQuery scans).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from api.middlewares.rate_limiter import (
    RateLimiterMiddleware,
    RateLimitExceeded,
)


def _request(path="/api/data", method="GET", peer="192.168.1.1", headers=None):
    """Build a request double with real dict headers (MagicMock headers
    would return a Mock from .get and silently pass truthiness checks)."""
    request = MagicMock()
    request.url.path = path
    request.method = method
    request.headers = headers or {}
    if peer is None:
        request.client = None
    else:
        request.client.host = peer
    return request


class TestRateLimiterMiddleware:
    def setup_method(self):
        self.app = MagicMock()
        self.middleware = RateLimiterMiddleware(
            self.app, rate_limit=5, window_seconds=60
        )

    @pytest.mark.asyncio
    async def test_dispatch_skip_rate_limit_health_check(self):
        call_next = AsyncMock(return_value=MagicMock())
        await self.middleware.dispatch(_request(path="/health"), call_next)
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_skip_rate_limit_readiness(self):
        call_next = AsyncMock(return_value=MagicMock())
        await self.middleware.dispatch(_request(path="/health/ready"), call_next)
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_skip_rate_limit_docs(self):
        call_next = AsyncMock(return_value=MagicMock())
        await self.middleware.dispatch(_request(path="/docs"), call_next)
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_skip_rate_limit_options(self):
        call_next = AsyncMock(return_value=MagicMock())
        await self.middleware.dispatch(_request(method="OPTIONS"), call_next)
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_dispatch_rate_limit_exceeded(self):
        call_next = AsyncMock()

        with patch.object(self.middleware, "_consume_quota", return_value=False):
            response = await self.middleware.dispatch(_request(), call_next)

        assert isinstance(response, JSONResponse)
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.body.decode()
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_dispatch_successful_request(self):
        mock_response = MagicMock()
        call_next = AsyncMock(return_value=mock_response)

        with patch.object(self.middleware, "_consume_quota", return_value=True):
            response = await self.middleware.dispatch(_request(), call_next)

        assert response == mock_response
        call_next.assert_called_once()

    @pytest.mark.asyncio
    async def test_quota_is_consumed_before_the_handler_runs(self):
        """Regression: the counter used to increment *after* call_next, so
        concurrent requests all passed the check on the same stale value."""
        order = []

        async def call_next(_request):
            order.append("handler")
            return MagicMock()

        async def consume(_client_id):
            order.append("consume")
            return True

        with patch.object(self.middleware, "_consume_quota", side_effect=consume):
            await self.middleware.dispatch(_request(), call_next)

        assert order == ["consume", "handler"]

    def test_get_client_identifier_with_ip(self):
        assert self.middleware._get_client_identifier(_request()) == "ip:192.168.1.1"

    def test_get_client_identifier_without_ip(self):
        assert (
            self.middleware._get_client_identifier(_request(peer=None)) == "ip:unknown"
        )

    @pytest.mark.asyncio
    async def test_limit_is_enforced_at_the_boundary(self):
        """rate_limit=5 must allow exactly 5 requests, then reject."""
        for _ in range(5):
            assert await self.middleware._consume_quota("client_boundary") is True

        assert await self.middleware._consume_quota("client_boundary") is False


class TestForwardedForTrust:
    """X-Forwarded-For is client-settable. Honouring it from an untrusted peer
    let any caller rotate the header per request and bypass the limit
    entirely — on endpoints that each trigger a BigQuery scan."""

    def test_forwarded_for_ignored_from_untrusted_peer(self):
        from api.middlewares.rate_limiter import get_client_ip

        # A public peer is never a trusted hop, so its XFF must be ignored.
        request = _request(peer="203.0.113.200", headers={"x-forwarded-for": "1.1.1.1"})
        assert get_client_ip(request) == "203.0.113.200"

    def test_shipped_default_works_with_the_real_ingress_topology(self):
        """End-to-end against the deployed setup, using the DEFAULT config
        rather than a monkeypatched one.

        k8s/nginx/*/analytics-vs.yaml proxies to airqo-analytics-api-svc:5000
        from an in-cluster NGINX pod (an RFC1918 address), and nginx appends
        the real client IP — resolved via PROXY protocol — as the right-most
        X-Forwarded-For entry. If the default did not trust that peer, every
        request would key on the single ingress pod IP and all users would
        share one bucket.
        """
        from api.middlewares.rate_limiter import get_client_ip

        request = _request(
            peer="10.4.2.17",  # nginx-ingress pod
            headers={"x-forwarded-for": "198.51.100.7"},  # appended by nginx
        )
        assert get_client_ip(request) == "198.51.100.7"

    def test_client_cannot_forge_a_left_hand_entry_in_production_shape(self):
        """A caller pre-seeding XFF only adds entries to the LEFT of the one
        nginx appends, so the right-most entry still wins."""
        from api.middlewares.rate_limiter import get_client_ip

        request = _request(
            peer="10.4.2.17",
            headers={"x-forwarded-for": "1.2.3.4, 198.51.100.7"},
        )
        assert get_client_ip(request) == "198.51.100.7"

    def test_forwarded_for_honoured_from_trusted_peer(self, monkeypatch):
        from config import settings
        from api.middlewares.rate_limiter import get_client_ip

        monkeypatch.setattr(settings, "trusted_proxies", "10.0.0.0/8")
        request = _request(peer="10.0.0.1", headers={"x-forwarded-for": "203.0.113.9"})

        assert get_client_ip(request) == "203.0.113.9"

    def test_rightmost_entry_wins_from_trusted_peer(self, monkeypatch):
        """Entries left of the trusted hop's own append are client-controlled,
        so a caller could otherwise pre-seed a fake origin IP."""
        from config import settings
        from api.middlewares.rate_limiter import get_client_ip

        monkeypatch.setattr(settings, "trusted_proxies", "10.0.0.0/8")
        request = _request(
            peer="10.0.0.1",
            headers={"x-forwarded-for": "1.1.1.1, 203.0.113.9"},
        )

        assert get_client_ip(request) == "203.0.113.9"

    def test_falls_back_to_client_host(self):
        from api.middlewares.rate_limiter import get_client_ip

        assert get_client_ip(_request(peer="192.168.1.7")) == "192.168.1.7"

    def test_unparseable_trusted_proxy_entry_is_ignored(self, monkeypatch):
        from config import settings
        from api.middlewares.rate_limiter import get_client_ip

        monkeypatch.setattr(settings, "trusted_proxies", "not-a-cidr, 10.0.0.0/8")
        request = _request(peer="10.0.0.1", headers={"x-forwarded-for": "203.0.113.9"})

        assert get_client_ip(request) == "203.0.113.9"

    def test_two_forwarded_clients_are_limited_independently(self, monkeypatch):
        from config import settings

        monkeypatch.setattr(settings, "trusted_proxies", "10.0.0.0/8")
        middleware = RateLimiterMiddleware(MagicMock(), rate_limit=5, window_seconds=60)

        r1 = _request(peer="10.0.0.1", headers={"x-forwarded-for": "203.0.113.1"})
        r2 = _request(peer="10.0.0.1", headers={"x-forwarded-for": "203.0.113.2"})

        assert middleware._get_client_identifier(
            r1
        ) != middleware._get_client_identifier(r2)


class TestCacheUnavailable:
    """cache_incr returns None when Redis is unreachable."""

    @pytest.mark.asyncio
    async def test_fails_closed_by_default(self):
        middleware = RateLimiterMiddleware(MagicMock(), rate_limit=5, window_seconds=60)

        with patch(
            "api.middlewares.rate_limiter.cache_incr",
            new_callable=AsyncMock,
            return_value=None,
        ):
            assert await middleware._consume_quota("client_1") is False

    @pytest.mark.asyncio
    async def test_fail_open_is_opt_in(self, monkeypatch):
        from config import settings

        monkeypatch.setattr(settings, "rate_limit_fail_open", True)
        middleware = RateLimiterMiddleware(MagicMock(), rate_limit=5, window_seconds=60)

        with patch(
            "api.middlewares.rate_limiter.cache_incr",
            new_callable=AsyncMock,
            return_value=None,
        ):
            assert await middleware._consume_quota("client_1") is True


class TestRateLimitExceeded:
    def test_rate_limit_exceeded_creation(self):
        exception = RateLimitExceeded(retry_after=120)

        assert exception.status_code == 429
        assert exception.detail == "Rate limit exceeded"
        assert exception.headers == {"Retry-After": "120"}

    def test_rate_limit_exceeded_default_retry_after(self):
        exception = RateLimitExceeded()

        assert exception.status_code == 429
        assert exception.headers == {"Retry-After": "60"}


class TestRouteRateLimit:
    """Per-route RouteRateLimit dependency (v3 public endpoints)."""

    @pytest.mark.asyncio
    async def test_allows_requests_within_limit(self):
        from api.middlewares.rate_limiter import RouteRateLimit

        limiter = RouteRateLimit(limit=5, window=60)
        request = _request(path="/api/v3/data-download", peer="127.0.0.1")

        for _ in range(5):
            await limiter(request)

    @pytest.mark.asyncio
    async def test_blocks_request_over_limit(self):
        from api.middlewares.rate_limiter import RouteRateLimit

        limiter = RouteRateLimit(limit=3, window=60)
        request = _request(path="/api/v3/data-download", peer="10.0.0.42")

        for _ in range(3):
            await limiter(request)

        with pytest.raises(HTTPException) as exc:
            await limiter(request)

        assert exc.value.status_code == 429
        assert exc.value.headers["Retry-After"] == "60"

    @pytest.mark.asyncio
    async def test_keys_are_route_scoped(self):
        from api.middlewares.rate_limiter import RouteRateLimit

        limiter = RouteRateLimit(limit=2, window=60)
        r1 = _request(path="/api/v3/data-download", peer="1.2.3.4")
        r2 = _request(path="/api/v3/raw-data", peer="1.2.3.4")

        await limiter(r1)
        await limiter(r1)
        with pytest.raises(HTTPException):
            await limiter(r1)

        # Independent cache key — must still be allowed
        await limiter(r2)

    @pytest.mark.asyncio
    async def test_fails_closed_when_cache_unavailable(self):
        from api.middlewares.rate_limiter import RouteRateLimit

        limiter = RouteRateLimit(limit=10, window=60)
        request = _request(path="/api/v3/data-download", peer="1.2.3.4")

        with patch(
            "api.middlewares.rate_limiter.cache_incr",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(HTTPException) as exc:
                await limiter(request)

        assert exc.value.status_code == 429
