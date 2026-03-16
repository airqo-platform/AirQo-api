from fastapi import APIRouter, HTTPException, Header, Depends
from typing import Optional
from sqlalchemy.orm import Session
import logging
from app.schemas.cohort import CohortResponse, SingleCohortResponse, SummaryCohortResponse
from app.services import cohort_service
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("")
async def get_cohorts(
    authorization: str = Header(...),
    tags: Optional[str] = None,
    includePerformance: bool = False,
    summary: bool = False,
    startDateTime: Optional[str] = None,
    endDateTime: Optional[str] = None,
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    frequency: Optional[str] = "hourly",
    search: Optional[str] = None,
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
        if tags:
            params["tags"] = tags
        if search:
            params["search"] = search
        if includePerformance:
            params["includePerformance"] = includePerformance
        if startDateTime:
            params["startDateTime"] = startDateTime
        if endDateTime:
            params["endDateTime"] = endDateTime
        result = await cohort_service.get_cohorts(token, params)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        # Summary path: use local sync_device_performance instead of raw data
        if includePerformance and summary:
            cohorts = result.get("cohorts", [])
            summary_result = cohort_service.get_cohorts_summary(cohorts, db)
            summary_result["meta"] = result.get("meta") or {
                "skip": skip,
                "limit": limit,
                "total": len(cohorts)
            }
            return summary_result

        if "meta" not in result or not result["meta"]:
            result["meta"] = {
                "skip": skip,
                "limit": limit,
                "total": len(result.get("cohorts", []))
            }
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching cohorts: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{cohort_ids}", response_model=CohortResponse)
async def get_cohorts_by_ids(
    cohort_ids: str,
    authorization: str = Header(...),
    includePerformance: bool = False,
    summary: bool = False,
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
    
    token = parts[1]
    
    try:
        params = {
            "frequency": frequency
        }
        if includePerformance:
            params["includePerformance"] = includePerformance
        if startDateTime:
            params["startDateTime"] = startDateTime
        if endDateTime:
            params["endDateTime"] = endDateTime
            
        result = await cohort_service.get_cohorts_by_ids(token, cohort_ids, params)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        # Summary path: use local sync_device_performance instead of raw data
        if includePerformance and summary:
            cohorts = result.get("cohorts", [])
            summary_result = cohort_service.get_cohorts_summary(cohorts, db)
            summary_result["meta"] = result.get("meta")
            return summary_result

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching cohorts {cohort_ids}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
