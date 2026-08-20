import ipaddress
import logging
import time
from typing import Callable, Dict, List, Tuple
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from api.utils.cache import cache_incr

logger = logging.getLogger(__name__)


def _trusted_proxies() -> List[ipaddress._BaseNetwork]:
    """Parse TRUSTED_PROXIES into networks, ignoring unparseable entries."""
    networks = []
    for entry in settings.trusted_proxies.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            logger.warning("Ignoring unparseable TRUSTED_PROXIES entry: %s", entry)
    return networks


def _is_trusted_peer(peer: str) -> bool:
    try:
        address = ipaddress.ip_address(peer)
    except ValueError:
        return False
    return any(address in network for network in _trusted_proxies())


def get_client_ip(request: Request) -> str:
    """
    Resolve the real client IP for rate-limit keying.

    This service runs behind an API gateway, so request.client.host is the
    gateway's address for every request — keying rate limits on it would
    throttle all users as a single client.  The gateway appends the original
    client to X-Forwarded-For.
    """
    peer = request.client.host if request.client else None

    if peer and _is_trusted_peer(peer):
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Right-most entry the trusted hop appended is the one it observed;
            # entries to its left may be forged by the client.
            candidates = [p.strip() for p in forwarded.split(",") if p.strip()]
            if candidates:
                return candidates[-1]

    return peer or "unknown"


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware for FastAPI.

    Counters live in Redis and are incremented atomically *before* the request
    is handled, so concurrent bursts cannot all pass the check on a stale read.
    """

    def __init__(self, app: Callable, rate_limit: int = 100, window_seconds: int = 60):
        """
        Initialize the rate limiter middleware.

        Args:
            app: The FastAPI application
            rate_limit: Maximum number of requests per window
            window_seconds: Time window in seconds
        """
        super().__init__(app)
        self.rate_limit = rate_limit
        self.window_seconds = window_seconds
        self.logger = logging.getLogger(self.__class__.__name__)

    async def dispatch(self, request: Request, call_next):
        """
        Process the request and apply rate limiting.

        Args:
            request: The incoming request
            call_next: The next middleware/route handler

        Returns:
            Response from the next handler or rate limit exceeded response
        """
        # Skip rate limiting for health checks and documentation
        if self._should_skip_rate_limit(request):
            return await call_next(request)

        # Get client identifier (IP address for now)
        client_id = self._get_client_identifier(request)

        # Consume quota *before* handling the request. Incrementing afterwards
        # meant N concurrent requests all read the same pre-increment value and
        # were admitted together — exactly the burst the limit exists to stop,
        # and each one a multi-second BigQuery job.
        allowed = await self._consume_quota(client_id)

        if not allowed:
            self.logger.warning(f"Rate limit exceeded for client: {client_id}")
            return JSONResponse(
                status_code=429,
                content={
                    "message": "Rate limit exceeded",
                    "status": "error",
                    "retry_after": self.window_seconds,
                    "data": None,
                    "metadata": None,
                },
                headers={"Retry-After": str(self.window_seconds)},
            )

        # Process the request
        return await call_next(request)

    def _should_skip_rate_limit(self, request: Request) -> bool:
        """
        Determine if rate limiting should be skipped for this request.

        Args:
            request: The incoming request

        Returns:
            True if rate limiting should be skipped
        """
        # Skip health checks (liveness and readiness probes)
        if request.url.path in ("/health", "/health/ready"):
            return True

        # Skip documentation endpoints
        if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
            return True

        # Skip OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return True

        return False

    def _get_client_identifier(self, request: Request) -> str:
        """
        Get a unique identifier for the client.

        Args:
            request: The incoming request

        Returns:
            Client identifier string
        """
        # Keyed on the forwarded client IP (see get_client_ip) — auth is
        # handled upstream at the API gateway, so IP is the available identity.
        return f"ip:{get_client_ip(request)}"

    async def _consume_quota(self, client_id: str) -> bool:
        """
        Atomically consume one unit of the client's quota.

        Args:
            client_id: Unique client identifier

        Returns:
            True if the request is allowed, False if the limit is exceeded.
        """
        cache_key = f"{settings.cache_key_prefix}:ratelimit:{client_id}"
        return await _consume(cache_key, self.rate_limit, self.window_seconds)


class RateLimitExceeded(HTTPException):
    """
    Exception raised when rate limit is exceeded.

    This can be used in route handlers for custom rate limiting logic.
    """

    def __init__(self, retry_after: int = 60):
        super().__init__(
            status_code=429,
            detail="Rate limit exceeded",
            headers={"Retry-After": str(retry_after)},
        )


# ---------------------------------------------------------------------------
# In-process fallback, used only while Redis is unreachable.
#
# Counters live in this process, so the effective ceiling becomes roughly
# (gunicorn workers x replicas) x the configured limit, and they reset on
# restart. That is deliberately approximate: it keeps the API serving and
# still bounds a runaway caller, which beats both 429-ing every request and
# waving everything through unmetered.
# ---------------------------------------------------------------------------

_local_counters: Dict[str, Tuple[int, float]] = {}
_local_prune_due = 0.0
_degraded_logged_at = 0.0

_PRUNE_INTERVAL = 60.0
# Redis being down would otherwise log once per request.
_DEGRADED_LOG_INTERVAL = 60.0


def _prune_local(now: float) -> None:
    """Drop expired windows so the dict cannot grow without bound."""
    global _local_prune_due
    if now < _local_prune_due:
        return
    _local_prune_due = now + _PRUNE_INTERVAL
    for key, (_, expires_at) in list(_local_counters.items()):
        if now >= expires_at:
            del _local_counters[key]


def _consume_locally(cache_key: str, limit: int, window_seconds: int) -> bool:
    """Fixed-window counter held in this process. Returns False when exhausted."""
    # monotonic: immune to wall-clock adjustments mid-window.
    now = time.monotonic()
    _prune_local(now)

    count, expires_at = _local_counters.get(cache_key, (0, 0.0))
    if now >= expires_at:
        count, expires_at = 0, now + window_seconds

    count += 1
    _local_counters[cache_key] = (count, expires_at)
    return count <= limit


def _log_degraded() -> None:
    """Warn that limiting is degraded, at most once a minute."""
    global _degraded_logged_at
    now = time.monotonic()
    if now - _degraded_logged_at >= _DEGRADED_LOG_INTERVAL:
        _degraded_logged_at = now
        logger.warning(
            "Redis unavailable — rate limiting has fallen back to per-process "
            "counters. Limits are now approximate (roughly workers x replicas "
            "times the configured value) until Redis returns."
        )


async def _consume(cache_key: str, limit: int, window_seconds: int) -> bool:
    """
    Atomically consume one unit of quota. Returns False when exhausted.

    Redis is the source of truth; `cache_incr` returns None when it is
    unreachable, and that is treated as "unknown" rather than "under the
    limit" — the request falls through to the in-process counter above.
    """
    count = await cache_incr(cache_key, window_seconds)

    if count is None:
        _log_degraded()
        return _consume_locally(cache_key, limit, window_seconds)

    return count <= limit


class RouteRateLimit:
    """
    FastAPI dependency for per-route rate limiting.

    Applies a stricter per-route limit on top of the global middleware,
    keyed by route path + client IP so different routes have independent windows.

    Usage::

        v3_limit = RouteRateLimit(limit=10, window=60)

        @router.post("/data-download", dependencies=[Depends(v3_limit)])
        async def export_data(...):
            ...
    """

    def __init__(self, limit: int = 10, window: int = 60):
        self.limit = limit
        self.window = window

    async def __call__(self, request: Request) -> None:
        cache_key = (
            f"{settings.cache_key_prefix}:route_ratelimit:"
            f"{request.url.path}:{get_client_ip(request)}"
        )

        if not await _consume(cache_key, self.limit, self.window):
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(self.window)},
            )
