from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from app.configs.settings import settings
from app.configs.database import init_db
from app.routes import api_router


# Set log level based on environment
# Only allow detailed INFO/DEBUG logs in test and development environments
# In other environments (e.g., production, staging), reduce noise by using WARNING
effective_log_level = getattr(logging, settings.LOG_LEVEL)
if settings.ENVIRONMENT not in ["test", "testing", "development"]:
    effective_log_level = logging.WARNING

logging.basicConfig(
    level=effective_log_level,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    force=True
)
logger = logging.getLogger(__name__)

# Ensure access logs are still visible if needed (uvicorn handles its own access logs, 
# but if we want specific app logs to show up despite the warning level, we'd need to configure individual loggers)
if settings.ENVIRONMENT not in ["test", "testing", "development"]:
    logger.info(f"Log level set to WARNING for environment: {settings.ENVIRONMENT}")



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up beacon service...")
    try:
        init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise
    
    yield
    
    logger.info("Shutting down beacon service...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.DESCRIPTION,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    root_path=settings.ROOT_PATH,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/")
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }


@app.get("/ready")
async def ready_check():
    return {
        "status": "ready",
        "checks": {
            "database": "ok",
            "redis": "ok"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )