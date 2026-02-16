from fastapi import APIRouter, Depends, Body
from sqlmodel import Session
from typing import List, Optional

from app.deps import get_db
from app.models.maintenance import (
    MaintenanceStatsRequest, 
    PaginatedAirQloudResponse, 
    PaginatedDeviceResponse
)
from app.crud import maintenance as maintenance_crud

router = APIRouter()


@router.get("/overview")
async def get_maintenance_overview(
    *,
    db: Session = Depends(get_db)
):
    """
    Get maintenance summary:
    - Average uptime for each active airqloud for the past 14 days.
    - Differentiated by country.
    """
    return maintenance_crud.get_maintenance_overview_data(db, days=14)

@router.get("/map-view")
async def get_maintenance_map_view(
    *,
    days: int = 14,
    db: Session = Depends(get_db)
):
    """
    Get map data for active tracked devices:
    - Device Coordinates
    - Associated AirQlouds
    - Average Uptime & Error Margin (past N days)
    """
    return maintenance_crud.get_map_view_data(db, days)

@router.post("/routes")
async def get_maintenance_routes(
    device_ids: List[str] = Body(..., description="List of device IDs to include in the route"),
    start_lat: Optional[float] = Body(0.3476, description="Starting Latitude (default: Kampala)"),
    start_lon: Optional[float] = Body(32.5825, description="Starting Longitude (default: Kampala)"),
    db: Session = Depends(get_db)
):
    """
    Calculate an optimized maintenance route for the selected devices.
    Uses a modified Nearest Neighbor algorithm (TSP heuristic) considering device criticality.
    
    Criticality is based on:
    - Uptime (Lower = Higher Priority)
    - Error Margin (Higher = Higher Priority)
    """
    return maintenance_crud.calculate_maintenance_routes(
        db, 
        device_ids=device_ids, 
        start_lat=start_lat, 
        start_lon=start_lon
    )


@router.post("/airqlouds/stats", response_model=PaginatedAirQloudResponse)
async def get_airqlouds_maintenance_stats(
    request: MaintenanceStatsRequest,
    db: Session = Depends(get_db)
):
    """
    Get aggregated performance statistics for AirQlouds.
    Returns average uptime (%), error margin, and device count.
    Supports filtering (uptime, error_margin, country, search) and sorting.
    """
    return maintenance_crud.get_airqloud_performance_stats(db, request)

@router.post("/devices/stats", response_model=PaginatedDeviceResponse)
async def get_devices_maintenance_stats(
    request: MaintenanceStatsRequest,
    db: Session = Depends(get_db)
):
    """
    Get aggregated performance statistics for Devices.
    Only returns devices belonging to at least one active AirQloud.
    Returns average uptime (hours/day), error margin, and battery voltage.
    Supports filtering and sorting.
    """
    return maintenance_crud.get_device_performance_stats(db, request)
