from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
from typing import Optional
from sqlalchemy.orm import Session
import logging
from app.schemas.cohort import (
    CohortResponse,
    SingleCohortResponse,
    SummaryCohortResponse,
    CohortSyncResponse,
    SyncedCohortResponse,
    SingleSyncedCohortResponse,
)
from app.services import cohort_service, cohort_sync_service
from app.db.session import get_db, SessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run_sync_cohorts(token: str):
    """Background task to run cohort sync with its own DB session."""
    db = SessionLocal()
    try:
        result = await cohort_sync_service.sync_cohorts(db, token)
        logger.info(f"[Cohort Sync] Background sync completed: {result.get('message')}")
    except Exception as e:
        logger.exception(f"Background cohort sync failed: {e}")
    finally:
        db.close()

@router.get("/")
async def get_cohorts(
    authorization: str = Header(...),
    tags: Optional[str] = None,
    includePerformance: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    frequency: Optional[str] = "hourly",
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"; we still require it so
    # callers continue to authenticate, but cohorts/devices are now read from
    # the local sync tables (no platform fan-out).
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    try:
        # Cohorts + devices come from local sync tables (sync_cohort,
        # sync_cohort_device, sync_device). Performance is also computed
        # locally from the sync_* device-data tables.
        result = cohort_service.get_cohorts_from_local(
            db,
            skip=skip or 0,
            limit=limit or 100,
            search=search,
            tags=tags,
        )

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching cohorts from local DB")
            raise HTTPException(status_code=status_code, detail=message)

        cohorts = result.get("cohorts", [])

        if includePerformance and startDateTime and endDateTime:
            cohort_service.apply_local_performance(
                cohorts, db, startDateTime, endDateTime, frequency=freq
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching cohorts: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/sync", response_model=CohortSyncResponse)
async def sync_cohorts(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    """Trigger a full cohort sync from the AirQo Platform API into the local database (runs in background)."""
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

    token = parts[1]

    background_tasks.add_task(_run_sync_cohorts, token)

    return {
        "success": True,
        "message": "Cohort sync process started in the background. It may take a few minutes to complete.",
        "cohorts_synced": 0,
        "devices_backfilled": 0,
    }


@router.get("/synced", response_model=SyncedCohortResponse)
def get_synced_cohorts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    cohort_ids: Optional[str] = None,
    tags: Optional[str] = None,
    includePerformance: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    frequency: Optional[str] = "hourly",
    db: Session = Depends(get_db),
):
    """List cohorts from the local sync table (source of truth).

    Optional ``cohort_ids`` (CSV) filters to a specific set of cohorts.
    Optional ``tags`` (CSV) filters cohorts whose ``cohort_tags`` contain
    every supplied tag. When ``includePerformance=true`` and both
    ``startDateTime`` / ``endDateTime`` are provided, each cohort and its
    devices are enriched with locally-computed performance metrics.
    """
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    try:
        result = cohort_sync_service.get_synced_cohorts(
            db,
            skip=skip,
            limit=limit,
            search=search,
            cohort_ids=cohort_ids,
            tags=tags,
        )

        if includePerformance and startDateTime and endDateTime:
            cohort_sync_service.apply_local_performance_synced(
                result.get("cohorts", []),
                db,
                startDateTime,
                endDateTime,
                frequency=freq,
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced cohorts: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/synced/{cohort_id}", response_model=SingleSyncedCohortResponse)
def get_synced_cohort(
    cohort_id: str,
    includePerformance: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    frequency: Optional[str] = "hourly",
    db: Session = Depends(get_db),
):
    """Get a single cohort from the local sync table with associated devices.

    When ``includePerformance=true`` and both ``startDateTime`` /
    ``endDateTime`` are provided, the cohort and its devices are enriched
    with locally-computed performance metrics.
    """
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    try:
        result = cohort_sync_service.get_synced_cohort(db, cohort_id)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message"))

        cohort = result.get("cohort")
        if includePerformance and startDateTime and endDateTime and cohort:
            cohort_sync_service.apply_local_performance_synced(
                [cohort],
                db,
                startDateTime,
                endDateTime,
                frequency=freq,
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced cohort {cohort_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/{cohort_ids}", response_model=CohortResponse)
async def get_cohorts_by_ids(
    cohort_ids: str,
    authorization: str = Header(...),
    includePerformance: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    frequency: Optional[str] = "daily",
    db: Session = Depends(get_db)
):
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    freq = (frequency or "daily").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    try:
        # Read from local sync tables (sync_cohort + sync_cohort_device +
        # sync_device) instead of calling the platform.
        result = cohort_service.get_cohorts_by_ids_from_local(db, cohort_ids)

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching cohorts from local DB")
            raise HTTPException(status_code=status_code, detail=message)

        cohorts = result.get("cohorts", [])

        if includePerformance and startDateTime and endDateTime and cohorts:
            cohort_service.apply_local_performance(
                cohorts, db, startDateTime, endDateTime, frequency=freq
            )

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching cohorts {cohort_ids}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
