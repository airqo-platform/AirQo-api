"""
FastAPI application for the AirQo Analytics API.

Creates and configures the app: middleware, router registration, the shared
error envelope, and the liveness/readiness endpoints.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from config import settings
from api.routers import v2_router, v3_router
from api.middlewares.rate_limiter import RateLimiterMiddleware
from api.utils.cache import init_cache, close_cache

# Initialize logging if method exists (for production config)
if hasattr(settings, "init_logging"):
    settings.init_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Lifespan context manager for FastAPI application.

    Handles startup and shutdown events, including cache initialization
    and cleanup operations.
    """
    # Startup
    logger.info("Starting AirQo Analytics API")
    await init_cache()

    yield

    # Shutdown
    logger.info("Shutting down AirQo Analytics API")
    await close_cache()


def create_fastapi_app() -> FastAPI:
    """
    Create and configure the FastAPI application.

    Returns:
        FastAPI: Configured FastAPI application instance
    """
    # Interactive docs publish the full schema of every endpoint. That is
    # useful in dev and staging, and needless disclosure in production, so
    # they are opt-in there via EXPOSE_API_DOCS.
    docs_enabled = settings.expose_api_docs

    app = FastAPI(
        title="AirQo Analytics API",
        description="FastAPI-based analytics service for AirQo air quality data",
        version="2.0.0",
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json" if docs_enabled else None,
        lifespan=lifespan,
    )

    # Add middleware
    _configure_middleware(app)

    # Include routers
    _configure_routers(app)

    # Add exception handlers
    _configure_exception_handlers(app)

    return app


def _configure_middleware(app: FastAPI) -> None:
    """
    Configure middleware for the FastAPI application.

    CORS origins and allowed hosts come from settings (CORS_ALLOWED_ORIGINS,
    ALLOWED_HOSTS env vars, comma-separated).  Auth is handled upstream by the
    API gateway; this service only restricts the HTTP surface.

    Registration order is the reverse of execution order: starlette inserts
    each new middleware at the front of the list, so the LAST one registered
    here is the OUTERMOST at runtime.  The resulting stack is::

        ServerErrorMiddleware          (starlette's own, always outermost)
          CORSMiddleware
            request_context            (request id, access log, 500 envelope)
              RateLimiterMiddleware
                TrustedHostMiddleware
                  ExceptionMiddleware  (starlette's own, holds the 4xx handlers)
                    router

    CORS is registered last deliberately.  Every response that never reaches
    the router — the rate limiter's 429, a rejected Host header, an unhandled
    exception — is produced inside CORSMiddleware and so still carries
    Access-Control-Allow-Origin.  Registered first (as it was) CORS ends up
    innermost, and a browser sees those responses as opaque network failures:
    the body is sent, but fetch() rejects before JavaScript can read the status
    or the JSON.

    The one thing this ordering gives up: a CORS preflight (OPTIONS with an
    Origin header) is answered by CORSMiddleware itself and never travels
    further in, so it is not checked against ALLOWED_HOSTS, not access-logged,
    and carries no X-Request-ID.  That is accepted.  A preflight reaches nothing
    protected, the real request that follows it is still host-checked, and the
    alternative — TrustedHost outside CORS — would put a rejected Host header
    back among the opaque failures above.

    Args:
        app: FastAPI application instance
    """
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.allowed_hosts_list(),
    )

    # Rate limiting middleware
    app.add_middleware(RateLimiterMiddleware)

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        """Attach a request ID, log the request, and own the 500 envelope.

        Honours an inbound X-Request-ID (set by the API gateway) so log lines
        here can be correlated with gateway logs; generates one otherwise.

        Unhandled exceptions are turned into the error envelope here rather
        than by the ``Exception`` handler registered on the app.  Starlette
        routes a handler keyed on ``Exception`` (or 500) to
        ServerErrorMiddleware, which wraps *everything* including CORS, so a
        response built there carries neither CORS headers nor this request ID.
        Catching at this depth keeps the 500 inside CORSMiddleware, which is
        the difference between a browser client reading the error and seeing an
        opaque failure.  The app-level handler stays registered as a backstop
        for anything raised outside this middleware.
        """
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            logger.exception(
                "Unhandled error: request_id=%s method=%s path=%s",
                request_id,
                request.method,
                request.url.path,
            )
            response = JSONResponse(
                status_code=500,
                content={
                    "message": "Internal server error",
                    "status": "error",
                    "data": None,
                    "metadata": None,
                },
            )
        duration_ms = (time.perf_counter() - start) * 1000

        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_id=%s method=%s path=%s status=%s duration_ms=%.1f",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response

    # Registered last, so it is the outermost user middleware — see above.
    cors_origins = settings.cors_origins_list()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        # allow_credentials must be False with a wildcard origin — browsers
        # reject the combination and starlette would silently misbehave.
        allow_credentials="*" not in cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )


def _configure_routers(app: FastAPI) -> None:
    """
    Configure and include API routers.

    Args:
        app: FastAPI application instance
    """
    # Include API v2 router
    app.include_router(v2_router, prefix="/api/v2/analytics", tags=["v2"])

    # Include API v3 router
    app.include_router(v3_router, prefix="/api/v3/public/analytics", tags=["v3"])


def _configure_exception_handlers(app: FastAPI) -> None:
    """
    Configure global exception handlers.

    Args:
        app: FastAPI application instance
    """

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        """Handle request-body/query validation errors (real 422s).

        FastAPI raises RequestValidationError — NOT pydantic.ValidationError,
        which an earlier version of this handler was registered for and
        therefore never fired (clients got FastAPI's default {"detail"}).
        jsonable errors: ctx values may carry raw exceptions.
        """
        errors = [
            {k: str(v) if k == "ctx" else v for k, v in err.items()}
            for err in exc.errors()
        ]
        logger.warning(f"Validation error: {errors}")
        return JSONResponse(
            status_code=422,
            content={
                "message": "Validation error",
                "status": "error",
                "errors": errors,
                "data": None,
                "metadata": None,
            },
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        """Handle HTTP exceptions with the four-key success-envelope shape.

        Registered against the Starlette base class so framework-raised
        errors (404 unknown route, 405 method not allowed) get the same
        envelope as service-raised fastapi.HTTPException (a subclass).
        """
        logger.warning(f"HTTP exception: {exc.detail}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "message": exc.detail,
                "status": "error",
                "data": None,
                "metadata": None,
            },
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Backstop for exceptions raised outside the request_context middleware.

        Starlette hands this handler to ServerErrorMiddleware, the outermost
        layer, so a response built here reaches the client without CORS or
        X-Request-ID headers.  request_context catches everything raised at or
        below the router for exactly that reason; this only fires if CORS or
        request_context itself blows up, which should not happen.
        """
        logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "message": "Internal server error",
                "status": "error",
                "data": None,
                "metadata": None,
            },
        )


# Create the FastAPI application instance
app = create_fastapi_app()


@app.get("/health", tags=["health"])
async def health_check():
    """
    Liveness check — process is up and serving requests.

    Does not probe dependencies; use /health/ready for that.
    """
    return {
        "message": "AirQo Analytics API - OK",
        "status": "healthy",
        "version": "2.0.0",
        "environment": settings.app_env,
    }


@app.get("/health/ready", tags=["health"])
async def readiness_check():
    """
    Readiness check — verifies the Redis cache dependency responds.

    Returns 503 when a dependency is down so the load balancer stops
    routing traffic to this instance.  BigQuery is intentionally not
    probed here: a dry-run query per probe is costly and BigQuery
    outages surface as request-level 500s with their own alerting.
    """
    from api.utils.cache import cache_get, cache_set

    checks = {}
    try:
        await cache_set("readiness:probe", "ok", expire=10)
        checks["redis"] = (await cache_get("readiness:probe")) is not None
    except Exception:
        logger.exception("Readiness probe failed for Redis")
        checks["redis"] = False

    ready = all(checks.values())
    return JSONResponse(
        status_code=200 if ready else 503,
        content={
            "status": "ready" if ready else "not_ready",
            "checks": checks,
        },
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True, log_level="info")
