from fastapi import APIRouter, HTTPException, Header, Depends, Query, Body
from typing import Optional, List
from sqlalchemy.orm import Session
import logging
from app.schemas.collocation import (
    CollocationSitesResponse, InlabResponse, CollocationSiteDetailsResponse,
    InlabBatchCreate, InlabBatchUpdate, InlabBatchDeviceAdd,
    InlabBatchDeviceUpdate, InlabBatchListResponse, InlabBatchDetailResponse,
)
from app.services import collocation_service
from app.services import inlab_batch_service
from app.db.session import get_db

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Helper ─────────────────────────────────────────────────────────

def _extract_token(authorization: str) -> str:
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    return parts[1]


def _validate_frequency(frequency: str, default: str = "hourly") -> str:
    freq = (frequency or default).lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.",
        )
    return freq


# ── Collocation Sites ──────────────────────────────────────────────

@router.get("/sites", response_model=CollocationSitesResponse)
async def get_collocation_sites(
    authorization: str = Header(...),
    include_performance: bool = Query(False, alias="includePerformance"),
    start_date_time: Optional[str] = Query(None, alias="startDateTime"),
    end_date_time: Optional[str] = Query(None, alias="endDateTime"),
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    frequency: Optional[str] = "hourly",
    db: Session = Depends(get_db)
):
    token = _extract_token(authorization)
    freq = _validate_frequency(frequency)

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
        if include_performance:
            sites = result.get("sites", [])
            perf_result = collocation_service.apply_local_performance_to_sites(
                sites, db, start_date_time=start_date_time, end_date_time=end_date_time, frequency=freq,
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


# ── Inlab ──────────────────────────────────────────────────────────

@router.get("/inlab", response_model=InlabResponse)
async def get_inlab_collocation(
    authorization: str = Header(...),
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    start_date_time: Optional[str] = Query(None, alias="startDateTime"),
    end_date_time: Optional[str] = Query(None, alias="endDateTime"),
    frequency: Optional[str] = "daily",
    search: Optional[str] = Query(None, description="Search by device name"),
    db: Session = Depends(get_db)
):
    token = _extract_token(authorization)
    freq = _validate_frequency(frequency, default="daily")

    try:
        result = await collocation_service.get_inlab_collocation(
            token, db, skip=skip, limit=limit,
            start_date_time=start_date_time, end_date_time=end_date_time,
            frequency=freq, search=search,
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


# ── Inlab Batch CRUD ───────────────────────────────────────────────

@router.post("/inlab/batch", response_model=InlabBatchDetailResponse)
async def create_inlab_batch(
    payload: InlabBatchCreate,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.create_batch(
        db,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        device_ids=payload.device_ids,
    )
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.get("/inlab/batch", response_model=InlabBatchListResponse)
async def list_inlab_batches(
    authorization: str = Header(...),
    start_date_time: Optional[str] = Query(None, alias="startDateTime"),
    end_date_time: Optional[str] = Query(None, alias="endDateTime"),
    skip: Optional[int] = 0,
    limit: Optional[int] = 100,
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    # Inlab batch device time-series is always served at hourly granularity.
    return inlab_batch_service.list_batches(
        db, skip=skip, limit=limit,
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        frequency="hourly",
    )


@router.get("/inlab/batch/{batch_id}", response_model=InlabBatchDetailResponse)
async def get_inlab_batch_detail(
    batch_id: str,
    authorization: str = Header(...),
    start_date_time: Optional[str] = Query(None, alias="startDateTime"),
    end_date_time: Optional[str] = Query(None, alias="endDateTime"),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    # Inlab batch device time-series is always served at hourly granularity.
    result = inlab_batch_service.get_batch_detail(
        db, batch_id,
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        frequency="hourly",
    )
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result


@router.patch("/inlab/batch/{batch_id}", response_model=InlabBatchDetailResponse)
async def update_inlab_batch(
    batch_id: str,
    payload: InlabBatchUpdate,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.update_batch(
        db, batch_id,
        name=payload.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    if not result.get("success"):
        status = 404 if "not found" in result.get("message", "").lower() else 400
        raise HTTPException(status_code=status, detail=result.get("message"))
    return result


@router.delete("/inlab/batch/{batch_id}")
async def delete_inlab_batch(
    batch_id: str,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.delete_batch(db, batch_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result


@router.post("/inlab/batch/{batch_id}/devices", response_model=InlabBatchDetailResponse)
async def add_devices_to_inlab_batch(
    batch_id: str,
    payload: InlabBatchDeviceAdd,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.add_devices_to_batch(db, batch_id, payload.device_ids)
    if not result.get("success"):
        status = 404 if "not found" in result.get("message", "").lower() else 400
        raise HTTPException(status_code=status, detail=result.get("message"))
    return result


@router.delete("/inlab/batch/{batch_id}/devices/{device_id}")
async def remove_device_from_inlab_batch(
    batch_id: str,
    device_id: str,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.remove_device_from_batch(db, batch_id, device_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("message"))
    return result


@router.patch("/inlab/batch/{batch_id}/devices/{device_id}")
async def update_inlab_batch_device(
    batch_id: str,
    device_id: str,
    payload: InlabBatchDeviceUpdate,
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    _extract_token(authorization)
    result = inlab_batch_service.update_batch_device(
        db, batch_id, device_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
    )
    if not result.get("success"):
        status = 404 if "not found" in result.get("message", "").lower() else 400
        raise HTTPException(status_code=status, detail=result.get("message"))
    return result


# ── Collocation Site Details ───────────────────────────────────────

@router.get("/sites/{site_id}", response_model=CollocationSiteDetailsResponse)
async def get_collocation_site_details(
    site_id: str,
    start_date_time: Optional[str] = Query(None, alias="startDateTime"),
    end_date_time: Optional[str] = Query(None, alias="endDateTime"),
    frequency: Optional[str] = "raw",
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>" (kept for auth parity
    # with the rest of the collocation endpoints, even though this handler
    # now sources data entirely from the local DB).
    _extract_token(authorization)
    freq = _validate_frequency(frequency, default="raw")

    try:
        result = collocation_service.get_collocation_site_details(
            site_id, db,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=freq,
        )
        return result
    except Exception as e:
        logger.exception(f"Unexpected error fetching collocation site details: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
