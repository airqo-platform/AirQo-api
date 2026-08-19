from fastapi import APIRouter
from app.api.v1 import devices, stock, category, firmware, cohort, maintenance, collocation, site, data_sync, grid, group, operations
from app.api.v1.webrtc import webrtc_router

api_router = APIRouter()
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(stock.router, prefix="/items-stock", tags=["items-stock"])
api_router.include_router(category.router, prefix="/categories", tags=["categories"])
api_router.include_router(firmware.router, prefix="/firmware", tags=["firmware"])
api_router.include_router(cohort.router, prefix="/cohorts", tags=["cohorts"])
api_router.include_router(grid.router, prefix="/grids", tags=["grids"])
api_router.include_router(group.router, prefix="/groups", tags=["groups"])
api_router.include_router(maintenance.router, prefix="/maintenance", tags=["maintenance"])
api_router.include_router(collocation.router, prefix="/collocation", tags=["collocation"])
api_router.include_router(site.router, prefix="/sites", tags=["sites"])
api_router.include_router(data_sync.router, prefix="/data-sync", tags=["data-sync"])
api_router.include_router(operations.router, tags=["operations"])
api_router.include_router(webrtc_router, prefix="/webrtc", tags=["webrtc"])


