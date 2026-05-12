from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
from typing import Optional, Annotated
from sqlalchemy.orm import Session
import logging

from app.schemas.group import (
    GroupSyncResponse,
    SyncedGroupResponse,
    SingleSyncedGroupResponse,
)
from app.services import group_sync_service
from app.db.session import get_db, SessionLocal

router = APIRouter()
logger = logging.getLogger(__name__)


async def _run_sync_groups(token: str):
    """Background task to run group sync with its own DB session."""
    db = SessionLocal()
    try:
        result = await group_sync_service.sync_groups(db, token)
        logger.info(f"[Group Sync] Background sync completed: {result.get('message')}")
    except Exception as e:
        logger.exception(f"Background group sync failed: {e}")
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


@router.post("/sync", response_model=GroupSyncResponse)
async def sync_groups(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    """Trigger a full group sync from the AirQo Platform API into the local database (runs in background)."""
    token = _validate_jwt_header(authorization)
    background_tasks.add_task(_run_sync_groups, token)

    return {
        "success": True,
        "message": "Group sync process started in the background. It may take a few minutes to complete.",
        "groups_synced": 0,
    }


@router.get("/synced", response_model=SyncedGroupResponse)
def get_synced_groups(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    group_ids: Optional[str] = None,
    grp_status: Optional[str] = Query(None, alias="status"),
    db: Annotated[Session, Depends(get_db)] = None,
):
    """List groups from the local sync table (source of truth).

    Optional ``group_ids`` (CSV) filters to a specific set of groups.
    Optional ``status`` filters by group status (e.g., ACTIVE).
    """
    try:
        result = group_sync_service.get_synced_groups(
            db,
            skip=skip,
            limit=limit,
            search=search,
            group_ids=group_ids,
            grp_status=grp_status,
        )
        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced groups: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/synced/{group_id}", response_model=SingleSyncedGroupResponse)
def get_synced_group(
    group_id: str,
    db: Annotated[Session, Depends(get_db)] = None,
):
    """Get a single group from the local sync table along with its cohorts."""
    try:
        result = group_sync_service.get_synced_group(db, group_id)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            raise HTTPException(status_code=status_code, detail=result.get("message"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced group {group_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/{group_ids}", response_model=SyncedGroupResponse)
def get_groups_by_ids(
    group_ids: str,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    """Fetch specific groups by ID (CSV) from the local sync tables."""
    _validate_jwt_header(authorization)

    try:
        result = group_sync_service.get_synced_groups(db, skip=0, limit=1000, group_ids=group_ids)

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching groups from local DB")
            raise HTTPException(status_code=status_code, detail=message)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching groups {group_ids}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
