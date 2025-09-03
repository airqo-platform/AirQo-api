from fastapi import APIRouter
from .devices import router as devices_router
from .sites import router as sites_router
from .analytics import router as analytics_router
from .device_locations import router as device_locations_router
from .cities_analysis import router as cities_analysis_router

api_router = APIRouter()

# Include all routers
api_router.include_router(devices_router, prefix="/devices", tags=["Devices"])
api_router.include_router(sites_router, prefix="/sites", tags=["Sites"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(device_locations_router, prefix="/locations", tags=["Device Locations"])
api_router.include_router(cities_analysis_router, tags=["Cities Analysis"])

__all__ = ["api_router"]