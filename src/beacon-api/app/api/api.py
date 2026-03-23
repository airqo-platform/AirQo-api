from fastapi import APIRouter
from app.api.v1 import devices, stock, category, firmware, cohort, maintenance

api_router = APIRouter()
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(stock.router, prefix="/items-stock", tags=["items-stock"])
api_router.include_router(category.router, prefix="/categories", tags=["categories"])
api_router.include_router(firmware.router, prefix="/firmware", tags=["firmware"])
api_router.include_router(cohort.router, prefix="/cohorts", tags=["cohorts"])
api_router.include_router(maintenance.router, prefix="/maintenance", tags=["maintenance"])
