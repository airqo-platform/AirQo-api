from fastapi import APIRouter, Depends, HTTPException, Header
import logging
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.schemas.device import (
    DeviceResponse, 
    SingleDeviceResponse, 
    DeviceMetadataResponse, 
    DeviceConfigDataResponse,
    DevicePerformanceResponse,
    DeviceFilesResponse,
    DeviceUpsertResponse,
    KeyValuePayload,
)
from app.services import device_service

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{device_id}/metadata/{category_name}", response_model=DeviceMetadataResponse)
async def get_device_metadata(
    device_id: str,
    category_name: str,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.get_device_metadata(db, device_id, category_name, skip, limit)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching metadata")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching metadata for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/configdata/{category_name}", response_model=DeviceConfigDataResponse)
async def get_device_configdata(
    device_id: str,
    category_name: str,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.get_device_configdata(db, device_id, category_name, skip, limit)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching config data")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching config data for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/{device_id}/metadata/{category_name}", response_model=DeviceUpsertResponse)
async def create_device_metadata(
    device_id: str,
    category_name: str,
    payload: KeyValuePayload,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.create_device_metadata(db, device_id, category_name, payload.values)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error creating metadata")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error creating metadata for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/{device_id}/configdata/{category_name}", response_model=DeviceUpsertResponse)
async def create_device_configdata(
    device_id: str,
    category_name: str,
    payload: KeyValuePayload,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.create_device_configdata(db, device_id, category_name, payload.values)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error creating config data")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error creating config data for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from typing import Optional

@router.get("/performance", response_model=DevicePerformanceResponse)
async def get_device_performance(
    device_name: List[str] = Query(...),
    startDateTime: str = Query(...),
    endDateTime: str = Query(...)
):
    try:
        return await device_service.get_device_performance(device_name, startDateTime, endDateTime)
    except Exception as e:
        logger.exception(f"Unexpected error fetching performance for devices {device_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/files", response_model=DeviceFilesResponse)
async def get_device_files(device_id: str):
    try:
        return await device_service.get_device_files(device_id)
    except Exception as e:
        logger.exception(f"Unexpected error fetching files for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}", response_model=SingleDeviceResponse)
async def get_device(
    device_id: str,
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
        result = await device_service.get_device_by_id(db, token, device_id)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("", response_model=DeviceResponse)
async def get_devices(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
    limit: int = 30,
    skip: int = 0,
    search: Optional[str] = None
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
            "limit": limit,
            "skip": skip
        }
        if search:
            params["search"] = search
        result = await device_service.get_device_details(db, token, params)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching devices: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
