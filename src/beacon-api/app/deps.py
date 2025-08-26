from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from sqlmodel import Session
from app.configs.database import SessionLocal
from app.configs.settings import settings
import redis
import logging

logger = logging.getLogger(__name__)


def get_db() -> Generator[Session, None, None]:
    """
    Database dependency to get DB session.
    Ensures proper cleanup after request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_redis_client() -> Optional[redis.Redis]:
    """
    Get Redis client for caching.
    Returns None if Redis is not available.
    """
    try:
        client = redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        # Test connection
        client.ping()
        return client
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
        return None


class RateLimiter:
    """Simple rate limiter using Redis"""
    
    def __init__(self, requests: int = 100, window: int = 60):
        self.requests = requests
        self.window = window
    
    def __call__(self, redis_client: Optional[redis.Redis] = Depends(get_redis_client)):
        if not redis_client:
            # If Redis is not available, skip rate limiting
            return True
        
        # Implement rate limiting logic here
        # This is a placeholder
        return True


# Common query parameters
class CommonQueryParams:
    """Common query parameters for list endpoints"""
    
    def __init__(
        self,
        skip: int = 0,
        limit: int = 100,
        sort_by: Optional[str] = None,
        order: str = "asc"
    ):
        self.skip = skip
        self.limit = min(limit, 1000)  # Max limit of 1000
        self.sort_by = sort_by
        self.order = order


# Pagination parameters
class PaginationParams:
    """Pagination parameters"""
    
    def __init__(
        self,
        page: int = 1,
        page_size: int = 20
    ):
        self.page = max(1, page)
        self.page_size = min(max(1, page_size), 100)  # Between 1 and 100
        self.skip = (self.page - 1) * self.page_size
        self.limit = self.page_size