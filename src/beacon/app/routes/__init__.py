from fastapi import APIRouter
from .devices import router as devices_router
from .sites import router as sites_router
from .analytics import router as analytics_router

api_router = APIRouter()

# Include all routers
api_router.include_router(devices_router, prefix="/devices", tags=["Devices"])
api_router.include_router(sites_router, prefix="/sites", tags=["Sites"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])

__all__ = ["api_router"]