from fastapi import APIRouter, HTTPException, Header, Query, BackgroundTasks, Depends
from typing import Optional
from datetime import date, datetime
import logging

from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.data_sync import (
    SyncTriggerResponse,
    RawDataResponse,
    HourlyDataResponse,
    DailyDataResponse,
    RawDeviceDataRecord,
    HourlyDeviceDataRecord,
    DailyDeviceDataRecord,
)
from app.crud import crud_device_data

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


@router.post("/sync-thingspeak", response_model=SyncTriggerResponse)
async def sync_thingspeak_data(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
    days: int = Query(default=14, ge=1, le=90, description="Lookback period in days"),
    start_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    start_time: str = Query(default="00:00:00", description="Start time (HH:MM:SS)"),
    end_time: str = Query(default="23:59:59", description="End time (HH:MM:SS)"),
):
    """
    Trigger ThingSpeak data sync for all registered devices.
    Fetches raw data, computes hourly and daily aggregations, and runs retention cleanup.
    Runs as a background task.
    """
    _extract_token(authorization)  # validate auth

    try:
        from app.services.thingspeak_sync_service import sync_device_data

        background_tasks.add_task(
            sync_device_data,
            days=days,
            start_date=start_date.isoformat() if start_date else None,
            end_date=end_date.isoformat() if end_date else None,
            start_time=start_time,
            end_time=end_time,
        )
        return SyncTriggerResponse(
            success=True,
            message=(
                "ThingSpeak data sync started in the background. "
                "It may take several minutes depending on the number of devices."
            ),
        )
    except Exception as e:
        logger.exception(f"Error triggering ThingSpeak sync: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/raw", response_model=RawDataResponse)
def get_raw_data(
    authorization: str = Header(...),
    channel_id: Optional[str] = Query(default=None, description="Filter by ThingSpeak channel ID"),
    start: Optional[datetime] = Query(default=None, description="Start datetime (ISO format)"),
    end: Optional[datetime] = Query(default=None, description="End datetime (ISO format)"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """Query stored raw ThingSpeak data."""
    _extract_token(authorization)
    try:
        records = crud_device_data.get_raw_data(db, channel_id, start, end, limit)
        return RawDataResponse(
            data=[RawDeviceDataRecord.model_validate(r) for r in records],
            count=len(records),
        )
    except Exception as e:
        logger.exception(f"Error fetching raw data: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/hourly", response_model=HourlyDataResponse)
def get_hourly_data(
    authorization: str = Header(...),
    channel_id: Optional[str] = Query(default=None, description="Filter by ThingSpeak channel ID"),
    start: Optional[datetime] = Query(default=None, description="Start datetime (ISO format)"),
    end: Optional[datetime] = Query(default=None, description="End datetime (ISO format)"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """Query stored hourly aggregated ThingSpeak data."""
    _extract_token(authorization)
    try:
        records = crud_device_data.get_hourly_data(db, channel_id, start, end, limit)
        return HourlyDataResponse(
            data=[HourlyDeviceDataRecord.model_validate(r) for r in records],
            count=len(records),
        )
    except Exception as e:
        logger.exception(f"Error fetching hourly data: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/daily", response_model=DailyDataResponse)
def get_daily_data(
    authorization: str = Header(...),
    channel_id: Optional[str] = Query(default=None, description="Filter by ThingSpeak channel ID"),
    start_date: Optional[date] = Query(default=None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(default=None, description="End date (YYYY-MM-DD)"),
    limit: int = Query(default=1000, ge=1, le=10000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """Query stored daily aggregated ThingSpeak data."""
    _extract_token(authorization)
    try:
        records = crud_device_data.get_daily_data(db, channel_id, start_date, end_date, limit)
        return DailyDataResponse(
            data=[DailyDeviceDataRecord.model_validate(r) for r in records],
            count=len(records),
        )
    except Exception as e:
        logger.exception(f"Error fetching daily data: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
