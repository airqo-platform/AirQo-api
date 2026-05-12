from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
from typing import Optional, Annotated
from sqlalchemy.orm import Session
import logging

from app.schemas.grid import (
    GridResponse,
    GridSyncResponse,
    SyncedGridResponse,
    SingleSyncedGridResponse,
)
from app.services import grid_service, grid_sync_service
from app.db.session import get_db, SessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run_sync_grids(token: str):
    """Background task to run grid sync with its own DB session."""
    db = SessionLocal()
    try:
        result = await grid_sync_service.sync_grids(db, token)
        logger.info(f"[Grid Sync] Background sync completed: {result.get('message')}")
    except Exception as e:
        logger.exception(f"Background grid sync failed: {e}")
    finally:
        db.close()


def _validate_jwt_header(authorization: str) -> str:
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


@router.get("/")
async def get_grids(
    authorization: str = Header(...),
    group: str = Query(..., description="Comma-separated group title(s) — required"),
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Fetch grids from the local sync tables, filtered to the specified group."""
    _validate_jwt_header(authorization)

    # Resolve group → device IDs for filtering grids
    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)

    try:
        result = grid_service.get_grids_from_local(
            db,
            skip=skip or 0,
            limit=limit or 100,
            search=search,
            group_device_ids=group_device_ids,
        )

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching grids from local DB")
            raise HTTPException(status_code=status_code, detail=message)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching grids: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/sync", response_model=GridSyncResponse)
async def sync_grids(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    """Trigger a full grid sync from the AirQo Platform API into the local database (runs in background)."""
    token = _validate_jwt_header(authorization)
    background_tasks.add_task(_run_sync_grids, token)

    return {
        "success": True,
        "message": "Grid sync process started in the background. It may take a few minutes to complete.",
        "grids_synced": 0,
        "sites_backfilled": 0,
    }


@router.get("/synced", response_model=SyncedGridResponse)
def get_synced_grids(
    group: str = Query(..., description="Comma-separated group title(s) — required"),
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    grid_ids: Optional[str] = None,
    tags: Optional[str] = None,
    include_performance: Annotated[bool, Query(alias="includePerformance")] = False,
    start_date_time: Annotated[Optional[str], Query(alias="startDateTime")] = None,
    end_date_time: Annotated[Optional[str], Query(alias="endDateTime")] = None,
    frequency: Optional[str] = "hourly",
    admin_level: Annotated[Optional[str], Query(alias="admin_level")] = None,
    db: Annotated[Session, Depends(get_db)] = None,
):
    """List grids from the local sync table (source of truth), filtered by group.

    Requires ``group`` (CSV) to scope grids to those whose sites contain devices
    belonging to the group's cohorts.
    Optional ``grid_ids`` (CSV) further narrows results.
    Optional ``tags`` (CSV) filters grids whose sites contain every supplied tag.
    Optional ``admin_level`` filters grids by admin level.
    When ``includePerformance=true`` and both date bounds are provided, each
    grid and its underlying devices are enriched with locally-computed metrics.
    """
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    # Resolve group → device IDs for filtering grids
    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)

    try:
        result = grid_sync_service.get_synced_grids(
            db,
            skip=skip,
            limit=limit,
            search=search,
            grid_ids=grid_ids,
            tags=tags,
            admin_level=admin_level,
            group_device_ids=group_device_ids,
        )

        if include_performance and start_date_time and end_date_time:
            grid_sync_service.apply_local_performance_synced_grids(
                result.get("grids", []),
                db,
                start_date_time,
                end_date_time,
                frequency=freq,
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced grids: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/synced/{grid_id}", response_model=SingleSyncedGridResponse)
def get_synced_grid(
    grid_id: str,
    group: str = Query(..., description="Comma-separated group title(s) — required"),
    include_performance: Annotated[bool, Query(alias="includePerformance")] = False,
    start_date_time: Annotated[Optional[str], Query(alias="startDateTime")] = None,
    end_date_time: Annotated[Optional[str], Query(alias="endDateTime")] = None,
    frequency: Optional[str] = "hourly",
    db: Annotated[Session, Depends(get_db)] = None,
):
    """Get a single grid from the local sync table along with its sites and underlying devices."""
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)

    try:
        result = grid_sync_service.get_synced_grid(db, grid_id, group_device_ids=group_device_ids)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message"))
        grid = result.get("grid")
        if include_performance and start_date_time and end_date_time and grid:
            grids = [grid]
            grid_sync_service.apply_local_performance_synced_grids(
                grids,
                db,
                start_date_time,
                end_date_time,
                frequency=freq,
            )
            if not grids:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        f"Grid {grid_id} has no active devices with network_id '{grid_sync_service.AIRQO_NETWORK}' "
                        "for includePerformance"
                    ),
                )
            result["grid"] = grids[0]
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced grid {grid_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/{grid_ids}", response_model=GridResponse)
async def get_grids_by_ids(
    grid_ids: str,
    authorization: str = Header(...),
    group: str = Query(..., description="Comma-separated group title(s) — required"),
    db: Session = Depends(get_db),
):
    """Fetch specific grids by ID (CSV) from the local sync tables."""
    _validate_jwt_header(authorization)

    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)

    try:
        result = grid_service.get_grids_by_ids_from_local(
            db,
            grid_ids,
            group_device_ids=group_device_ids,
        )

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching grids from local DB")
            raise HTTPException(status_code=status_code, detail=message)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching grids {grid_ids}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
