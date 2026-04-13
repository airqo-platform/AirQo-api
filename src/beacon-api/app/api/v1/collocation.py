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
    summary: bool = False,
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
    
    try:
        params = {
            "skip": skip,
            "limit": limit,
            "frequency": frequency
        }
        
        # In collocation/sites, we mainly care about summary=true path for now as per description
        result = await collocation_service.get_collocation_sites(token, db, params)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        # Summary path: use local sync_device_performance instead of raw data.
        # Triggered by summary=true (with or without includePerformance)
        if summary:
            sites = result.get("sites", [])
            summary_result = collocation_service.get_sites_summary(
                sites, db, startDateTime=startDateTime, endDateTime=endDateTime
            )
            summary_result["meta"] = result.get("meta") or {
                "skip": skip,
                "limit": limit,
                "total": len(sites)
            }
            return summary_result

        # Live Performance path: fetch from platform API.
        # Triggered by includePerformance=true (and summary=false)
        if includePerformance:
            sites = result.get("sites", [])
            perf_result = await collocation_service.get_sites_performance(
                sites, token, startDateTime, endDateTime, frequency, db
            )
            perf_result["meta"] = result.get("meta") or {
                "skip": skip,
                "limit": limit,
                "total": len(sites)
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
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    token = parts[1]

    try:
        result = await collocation_service.get_inlab_collocation(
            token, db, skip=skip, limit=limit,
            startDateTime=startDateTime, endDateTime=endDateTime
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
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")

    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    token = parts[1]

    try:
        result = await collocation_service.get_collocation_site_details(
            site_id, token, db, startDateTime, endDateTime
        )
        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching collocation site details: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
