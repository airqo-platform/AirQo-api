import os
import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.api import api_router
from app.core.config import settings
from app.db.session import Base
from app.models import sync  # Import models to register them with Base
from app.models import device_performance  # noqa: F401 — register with Alembic
from app.services.scheduler_service import start_scheduler, stop_scheduler
from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(levelname)s:     %(name)s: %(message)s",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

# Create database tables
# Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    version="1.0.0",
    redirect_slashes=False,
)


@app.on_event("startup")
def on_startup():
    try:
        start_scheduler()
    except Exception as e:
        logger.error(f"Failed to start scheduler: {e}")


@app.on_event("shutdown")
def on_shutdown():
    stop_scheduler()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the full traceback
    logger.exception(f"Unhandled exception occurred: {exc}")
    
    # If in debug mode, return the traceback in the response
    detail = "Internal Server Error"
    if settings.DEBUG:
        detail = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
        
    return JSONResponse(
        status_code=500,
        content={"detail": detail},
    )

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="")

@app.get("/")
def root():
    return {"message": f"Welcome to {settings.APP_NAME}"}

@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
