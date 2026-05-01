from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
from typing import Optional
from sqlalchemy.orm import Session
import logging

from app.schemas.site import SyncedSiteResponse, SingleSyncedSiteResponse, SiteSyncResponse
from app.services import site_service
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


@router.get("/", response_model=SyncedSiteResponse)
def get_sites(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """List sites from the local sync table (source of truth)."""
    try:
        result = site_service.get_sites(db, skip=skip, limit=limit, search=search)
        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced sites: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/{site_id}", response_model=SingleSyncedSiteResponse)
def get_site(
    site_id: str,
    db: Session = Depends(get_db),
):
    """Get a single site from the local sync table with associated devices."""
    try:
        result = site_service.get_site(db, site_id)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message"))
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
