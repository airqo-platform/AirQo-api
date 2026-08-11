import ipaddress
import logging
from typing import Callable, List
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

    X-Forwarded-For is only honoured when the immediate peer is a configured
    trusted proxy. It is a client-settable header: trusting it unconditionally
    let any caller rotate a fake value per request and bypass the limit
    entirely — which, on endpoints that trigger BigQuery scans, is a billing
    problem as much as an availability one. With no TRUSTED_PROXIES set the
    header is ignored, so the default is safe rather than convenient.
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

    Note on "distributed": this is only global if every replica shares one
    Redis. The Helm chart currently runs a Redis sidecar per API pod, so with
    replicaCount: 3 the effective global limit is 3x the configured one. Point
    REDIS_SERVER at a shared instance to make the limit truly cluster-wide.
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


async def _consume(cache_key: str, limit: int, window_seconds: int) -> bool:
    """
    Atomically consume one unit of quota. Returns False when exhausted.

    Fails **closed** when Redis is unavailable. The previous behaviour treated
    an unreachable cache as "under the limit", so a Redis outage silently
    disabled rate limiting altogether — and because cache_get swallows its own
    errors and returns None, the except branch never fired and nothing logged
    it. Rejecting is the safer default for endpoints that trigger billable
    BigQuery scans; set RATE_LIMIT_FAIL_OPEN=true to restore the old behaviour
    if availability matters more than the spend.
    """
    count = await cache_incr(cache_key, window_seconds)

    if count is None:
        if settings.rate_limit_fail_open:
            logger.warning("Rate limit store unavailable; allowing request (fail-open)")
            return True
        logger.error("Rate limit store unavailable; rejecting request (fail-closed)")
        return False

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
