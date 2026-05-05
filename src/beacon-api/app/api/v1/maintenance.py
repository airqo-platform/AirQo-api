from fastapi import APIRouter, HTTPException, Header, Query
from typing import Optional
import logging
import json

from sse_starlette.sse import EventSourceResponse

from app.schemas.maintenance import (
    MaintenanceStatsRequest,
    RouteRequest,
    PaginatedStatsResponse,
    RouteResponse,
    MapViewResponse,
)
from app.services import maintenance_service

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_token(authorization: str) -> str:
    if not authorization.startswith("JWT "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected 'JWT <token>'",
        )
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Missing token.",
        )
    return parts[1]


@router.get("/overview")
async def get_maintenance_overview(
    authorization: str = Header(...),
    days: int = Query(default=14, ge=1, le=90, description="Lookback period in days"),
    tags: Optional[str] = Query(default=None, description="Comma-separated cohort tags to filter by"),
):
    """
    Average uptime and error margin for each cohort, grouped by country/network.
    """
    token = _extract_token(authorization)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    try:
        return await maintenance_service.get_overview(token, days, tags=tag_list)
    except Exception as e:
        logger.exception(f"Error fetching maintenance overview: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/map-view", response_model=MapViewResponse)
async def get_maintenance_map_view(
    authorization: str = Header(...),
    days: int = Query(default=14, ge=1, le=90, description="Lookback period in days"),
    tags: Optional[str] = Query(default=None, description="Comma-separated cohort tags to filter by"),
    live: bool = Query(default=False, description="Deprecated — always reads from local sync tables"),
    frequency: str = Query(default="hourly", description="raw | hourly | daily"),
):
    """
    Device coordinates with performance metrics for map display.
    Always reads from local sync_*_device_data tables.
    """
    token = _extract_token(authorization)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(status_code=400, detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.")
    try:
        return await maintenance_service.get_map_view(token, days, tags=tag_list, live=live, frequency=freq)
    except Exception as e:
        logger.exception(f"Error fetching maintenance map view: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/map-view/stream")
async def stream_maintenance_map_view(
    authorization: str = Header(...),
    days: int = Query(default=14, ge=1, le=90, description="Lookback period in days"),
    tags: Optional[str] = Query(default=None, description="Comma-separated cohort tags to filter by"),
):
    """
    SSE stream of device coordinates with performance metrics for map display.
    Streams device entries progressively as each cohort is processed.

    Event types:
      - `device`: A new device entry with full metrics
      - `cohort_update`: An additional cohort name for a previously-sent device
      - `done`: Stream complete with total device count
    """
    token = _extract_token(authorization)
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None

    async def event_generator():
        try:
            async for entry in maintenance_service.stream_map_view(token, days, tags=tag_list):
                yield {
                    "event": entry["event"],
                    "data": json.dumps(entry["data"]),
                }
        except Exception as e:
            logger.exception(f"Error in SSE map view stream: {e}")
            yield {
                "event": "error",
                "data": json.dumps({"message": "Internal Server Error"}),
            }

    return EventSourceResponse(event_generator())


@router.post("/routes", response_model=RouteResponse)
async def get_maintenance_routes(
    request: RouteRequest,
    authorization: str = Header(...),
):
    """
    Calculate an optimized maintenance route for the selected devices.
    Uses nearest-neighbor TSP weighted by device criticality.
    """
    token = _extract_token(authorization)
    try:
        return await maintenance_service.calculate_routes(
            token,
            device_names=request.device_names,
            start_lat=request.start_lat,
            start_lon=request.start_lon,
            tags=request.tags,
        )
    except Exception as e:
        logger.exception(f"Error calculating maintenance routes: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/stats", response_model=PaginatedStatsResponse)
async def get_maintenance_stats(
    request: MaintenanceStatsRequest = MaintenanceStatsRequest(),
    authorization: str = Header(...),
):
    """
    Unified paginated performance statistics.
    Set entity_type to 'cohort' or 'device' in the body.
    Optionally pass tags to filter cohorts.
    """
    token = _extract_token(authorization)
    try:
        return await maintenance_service.get_stats(token, request)
    except Exception as e:
        logger.exception(f"Error fetching maintenance stats: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
