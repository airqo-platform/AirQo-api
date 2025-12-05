from fastapi import APIRouter
from .device import router as devices_router
from .site import router as sites_router
from .analytics import router as analytics_router
from .device_location import router as device_locations_router
from .cities_analysis import router as cities_analysis_router
from .firmware import router as firmware_router
from .category import router as categories_router
from .airqloud import router as airqloud_router
from .performance import router as performance_router
from .items_stock import router as items_stock_router
from .data import router as data_router

api_router = APIRouter()

# Include all routers
api_router.include_router(devices_router, prefix="/devices", tags=["Devices"])
api_router.include_router(firmware_router, prefix="/firmware", tags=["Firmware"])
api_router.include_router(airqloud_router, prefix="/airqlouds", tags=["AirQlouds"])
api_router.include_router(performance_router, prefix="/performance", tags=["Performance"])
api_router.include_router(items_stock_router, prefix="/items-stock", tags=["Items Stock Management"])
api_router.include_router(categories_router, prefix="/categories", tags=["Categories"])
api_router.include_router(data_router, prefix="/data", tags=["Data"])
# api_router.include_router(sites_router, prefix="/sites", tags=["Sites"])
# api_router.include_router(analytics_router, prefix="/analytics", tags=["Analytics"])
# api_router.include_router(device_locations_router, prefix="/locations", tags=["Device Locations"])
# api_router.include_router(cities_analysis_router, tags=["Cities Analysis"])

__all__ = ["api_router"]