from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from sqlalchemy.orm import Session
import logging
from app.schemas.collocation import CollocationSitesResponse, InlabResponse, CollocationSiteDetailsResponse
from app.services import collocation_service
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/sites", response_model=CollocationSitesResponse)
async def get_collocation_sites(
    authorization: str = Header(...),
    includePerformance: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    frequency: Optional[str] = "hourly",
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]

    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.",
        )

    try:
        params = {
            "skip": skip,
            "limit": limit,
            "frequency": freq,
        }

        result = await collocation_service.get_collocation_sites(token, db, params)

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        # Performance path: read from local sync_*_device_data tables.
        if includePerformance:
            sites = result.get("sites", [])
            perf_result = collocation_service.apply_local_performance_to_sites(
                sites, db, startDateTime=startDateTime, endDateTime=endDateTime, frequency=freq,
            )
            perf_result["meta"] = result.get("meta") or {
                "skip": skip,
                "limit": limit,
                "total": len(sites),
            }
            return perf_result

        # Bare listing: no performance data, just site metadata
        if "meta" not in result or not result["meta"]:
            result["meta"] = {
                "skip": skip,
                "limit": limit,
                "total": len(result.get("sites", []))
            }
        # Strip the internal devices_info helper from bare listing
        for site in result.get("sites", []):
            site.pop("devices_info", None)
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching collocation sites: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/inlab", response_model=InlabResponse)
async def get_inlab_collocation(
    authorization: str = Header(...),
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    frequency: Optional[str] = "daily",
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    token = parts[1]

    freq = (frequency or "daily").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.",
        )

    try:
        result = await collocation_service.get_inlab_collocation(
            token, db, skip=skip, limit=limit,
            startDateTime=startDateTime, endDateTime=endDateTime,
            frequency=freq,
        )

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching inlab data")
            raise HTTPException(status_code=status_code, detail=message)

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching inlab collocation: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/sites/{site_id}", response_model=CollocationSiteDetailsResponse)
async def get_collocation_site_details(
    site_id: str,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    frequency: Optional[str] = "raw",
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>" (kept for auth parity
    # with the rest of the collocation endpoints, even though this handler
    # now sources data entirely from the local DB).
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    freq = (frequency or "raw").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.",
        )

    try:
        result = collocation_service.get_collocation_site_details(
            site_id, db,
            startDateTime=startDateTime,
            endDateTime=endDateTime,
            frequency=freq,
        )
        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching collocation site details: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
