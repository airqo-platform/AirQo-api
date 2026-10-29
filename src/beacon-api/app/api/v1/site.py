from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
from typing import Optional, Annotated
from sqlalchemy.orm import Session
import logging

from app.schemas.site import SyncedSiteResponse, SingleSyncedSiteResponse, SiteSyncResponse
from app.services import site_service
from app.services.diagnostics.summaries import apply_diagnostics_to_containers
from app.db.session import get_db, SessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run_sync_sites(token: str):
    """Background task to run site sync with its own DB session."""
    db = SessionLocal()
    try:
        result = await site_service.sync_sites(db, token)
        logger.info(f"[Site Sync] Background sync completed: {result.get('message')}")
    except Exception as e:
        logger.exception(f"Background site sync failed: {e}")
    finally:
        db.close()


def _validate_frequency(frequency: Optional[str]) -> str:
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )
    return freq


def _resolve_group_device_ids(db: Session, group: Optional[str]):
    """Return the group's device IDs, or ``None`` when unscoped (no group or a supergroup).

    An empty ``group=`` is passed on so the resolver rejects it with 400.
    """
    if group is None:
        return None
    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    return resolve_group_device_ids(db, resolve_group_cohort_ids(db, group))


@router.get("/", response_model=SyncedSiteResponse)
def get_sites(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    group: Optional[str] = Query(None, description="Comma-separated group title(s)"),
    include_performance: Annotated[bool, Query(alias="includePerformance")] = False,
    start_date_time: Annotated[Optional[str], Query(alias="startDateTime")] = None,
    end_date_time: Annotated[Optional[str], Query(alias="endDateTime")] = None,
    frequency: Optional[str] = "hourly",
    include_diagnostics: Annotated[bool, Query(alias="includeDiagnostics")] = False,
    db: Session = Depends(get_db),
):
    """List sites from the local sync table (source of truth).

    Optional ``group`` (CSV) scopes sites to those containing devices that
    belong to the group's cohorts, and lists only those devices per site.
    When ``includePerformance=true`` and both date bounds are provided, only
    airqo-network devices are kept, and each site and its devices are
    enriched with locally-computed metrics.
    When ``includeDiagnostics=true``, each device carries its most recent
    stored daily diagnosis and each site a ``diagnostics_summary`` roll-up.
    """
    freq = _validate_frequency(frequency)
    group_device_ids = _resolve_group_device_ids(db, group)
    with_performance = bool(include_performance and start_date_time and end_date_time)

    try:
        result = site_service.get_sites(
            db,
            skip=skip,
            limit=limit,
            search=search,
            group_device_ids=group_device_ids,
            airqo_only=with_performance,
        )

        if with_performance:
            site_service.apply_local_performance_synced_sites(
                result.get("sites", []),
                db,
                start_date_time,
                end_date_time,
                frequency=freq,
            )

        if include_diagnostics:
            apply_diagnostics_to_containers(result.get("sites", []), db)

        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced sites: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/{site_id}", response_model=SingleSyncedSiteResponse)
def get_site(
    site_id: str,
    group: Optional[str] = Query(None, description="Comma-separated group title(s)"),
    include_performance: Annotated[bool, Query(alias="includePerformance")] = False,
    start_date_time: Annotated[Optional[str], Query(alias="startDateTime")] = None,
    end_date_time: Annotated[Optional[str], Query(alias="endDateTime")] = None,
    frequency: Optional[str] = "hourly",
    include_diagnostics: Annotated[bool, Query(alias="includeDiagnostics")] = False,
    db: Session = Depends(get_db),
):
    """Get a single site from the local sync table with associated devices."""
    freq = _validate_frequency(frequency)
    group_device_ids = _resolve_group_device_ids(db, group)
    with_performance = bool(include_performance and start_date_time and end_date_time)

    try:
        result = site_service.get_site(
            db,
            site_id,
            group_device_ids=group_device_ids,
            airqo_only=with_performance,
        )
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message"))

        if with_performance:
            site_service.apply_local_performance_synced_sites(
                [result["site"]],
                db,
                start_date_time,
                end_date_time,
                frequency=freq,
            )

        if include_diagnostics:
            apply_diagnostics_to_containers([result["site"]], db)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced site {site_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/sync", response_model=SiteSyncResponse)
async def sync_sites(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    """Trigger a full site sync from the AirQo Platform API into the local database (runs in background)."""
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

    background_tasks.add_task(_run_sync_sites, token)

    return {
        "success": True,
        "message": "Site sync process started in the background. It may take a few minutes to complete.",
        "sites_synced": 0,
        "devices_backfilled": 0,
    }
