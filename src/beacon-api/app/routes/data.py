from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, and_
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.deps import get_db
from app.models import Device, FirmwareDownloadState
from app.models.metadata_value import MetadataValues, MetadataValuesCreate, MetadataValuesRead
from app.models.config_value import ConfigValues, ConfigValuesCreate, ConfigValuesUpdate, ConfigValuesRead
from app.models.field_value import FieldValuesRead
from app.crud.device import device as device_crud
from app.crud.metadata_value import metadata_values as metadata_crud
from app.crud.config_value import config_values as config_crud
from app.crud.field_value import field_values as field_crud
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class MetadataUpdateRequest(BaseModel):
    """Request model for updating device metadata"""
    channel_id: int = Field(..., description="Device channel ID")
    firmware_version: Optional[str] = Field(None, description="Firmware version")
    metadata1: Optional[str] = Field(None, max_length=100)
    metadata2: Optional[str] = Field(None, max_length=100)
    metadata3: Optional[str] = Field(None, max_length=100)
    metadata4: Optional[str] = Field(None, max_length=100)
    metadata5: Optional[str] = Field(None, max_length=100)
    metadata6: Optional[str] = Field(None, max_length=100)
    metadata7: Optional[str] = Field(None, max_length=100)
    metadata8: Optional[str] = Field(None, max_length=100)
    metadata9: Optional[str] = Field(None, max_length=100)
    metadata10: Optional[str] = Field(None, max_length=100)
    metadata11: Optional[str] = Field(None, max_length=100)
    metadata12: Optional[str] = Field(None, max_length=100)
    metadata13: Optional[str] = Field(None, max_length=100)
    metadata14: Optional[str] = Field(None, max_length=100)
    metadata15: Optional[str] = Field(None, max_length=100)


class ConfigUpdateRequest(BaseModel):
    """Request model for updating device configurations"""
    device_ids: List[str] = Field(..., description="List of device IDs to update")
    config1: Optional[str] = Field(None, max_length=100)
    config2: Optional[str] = Field(None, max_length=100)
    config3: Optional[str] = Field(None, max_length=100)
    config4: Optional[str] = Field(None, max_length=100)
    config5: Optional[str] = Field(None, max_length=100)
    config6: Optional[str] = Field(None, max_length=100)
    config7: Optional[str] = Field(None, max_length=100)
    config8: Optional[str] = Field(None, max_length=100)
    config9: Optional[str] = Field(None, max_length=100)
    config10: Optional[str] = Field(None, max_length=100)


class DataResponse(BaseModel):
    """Combined data response model"""
    device_id: str
    channel_id: Optional[int]
    field_values: Optional[FieldValuesRead]
    config_values: Optional[ConfigValuesRead]
    metadata_values: Optional[MetadataValuesRead]
    created_at: datetime


class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""
    items: List[Any]
    pagination: Dict[str, Any]
    message: str


# Metadata endpoints
@router.post("/metadata", response_model=Dict[str, Any])
async def update_device_metadata(
    request: MetadataUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update device metadata using channel ID.
    
    - **channel_id**: Device channel ID (required)
    - **firmware_version**: Firmware version (optional)
    - **metadata1-15**: Metadata fields (all optional)
    
    If firmware_version matches device's current_firmware, firmware_download_state is set to 'updated'.
    """
    try:
        # Get device by channel_id
        device = device_crud.get_by_channel_id(db, channel_id=request.channel_id)
        if not device:
            raise HTTPException(status_code=404, detail=f"Device with channel_id {request.channel_id} not found")
        
        # Prepare metadata update data
        metadata_data = {
            "device_id": device.device_id,
            "metadata1": request.metadata1,
            "metadata2": request.metadata2,
            "metadata3": request.metadata3,
            "metadata4": request.metadata4,
            "metadata5": request.metadata5,
            "metadata6": request.metadata6,
            "metadata7": request.metadata7,
            "metadata8": request.metadata8,
            "metadata9": request.metadata9,
            "metadata10": request.metadata10,
            "metadata11": request.metadata11,
            "metadata12": request.metadata12,
            "metadata13": request.metadata13,
            "metadata14": request.metadata14,
            "metadata15": request.metadata15,
        }
        
        # Create metadata record
        metadata_create = MetadataValuesCreate(**metadata_data)
        metadata_record = metadata_crud.create(db, obj_in=metadata_create)
        
        # Handle firmware update if provided
        firmware_updated = False
        if request.firmware_version:
            if device.current_firmware == request.firmware_version:
                # Update firmware_download_state to 'updated' if versions match
                device_update = {"firmware_download_state": FirmwareDownloadState.updated}
                device_crud.update(db, db_obj=device, obj_in=device_update)
                firmware_updated = True
        
        return {
            "message": "Device metadata updated successfully",
            "device_id": device.device_id,
            "channel_id": request.channel_id,
            "metadata_record_id": str(metadata_record.id),
            "firmware_updated": firmware_updated,
            "created_at": metadata_record.created_at
        }
        
    except Exception as e:
        logger.error(f"Error updating device metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/metadata", response_model=PaginatedResponse)
async def get_device_metadata(
    *,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Number of items to return"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    channel_id: Optional[int] = Query(None, description="Filter by channel ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)")
):
    """
    Get device metadata with pagination and filtering.
    
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum records to return
    - **device_id**: Filter by specific device ID
    - **channel_id**: Filter by specific channel ID
    - **start_date**: Filter records from this date
    - **end_date**: Filter records until this date
    """
    try:
        # Build base query
        query = select(MetadataValues)
        count_query = select(func.count(MetadataValues.id))
        
        # Apply filters
        conditions = []
        
        if device_id:
            conditions.append(MetadataValues.device_id == device_id)
        
        if channel_id:
            # Get device by channel_id first
            device = device_crud.get_by_channel_id(db, channel_id=channel_id)
            if device:
                conditions.append(MetadataValues.device_id == device.device_id)
            else:
                # Return empty result if channel_id not found
                return PaginatedResponse(
                    items=[],
                    pagination={
                        "total": 0,
                        "skip": skip,
                        "limit": limit,
                        "pages": 0,
                        "current_page": 0
                    },
                    message="No device found with specified channel_id"
                )
        
        if start_date:
            conditions.append(MetadataValues.created_at >= start_date)
        
        if end_date:
            conditions.append(MetadataValues.created_at <= end_date)
        
        # Apply conditions to queries
        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))
        
        # Get total count
        total_count = db.exec(count_query).one()
        
        # Apply pagination and ordering
        query = query.order_by(MetadataValues.created_at.desc()).offset(skip).limit(limit)
        
        # Execute query
        metadata_records = db.exec(query).all()
        
        # Convert to response format
        items = []
        for metadata in metadata_records:
            # Get device info for channel_id
            device = device_crud.get_by_device_id(db, device_id=metadata.device_id)
            
            items.append({
                "id": str(metadata.id),
                "device_id": metadata.device_id,
                "channel_id": device.channel_id if device else None,
                "metadata1": metadata.metadata1,
                "metadata2": metadata.metadata2,
                "metadata3": metadata.metadata3,
                "metadata4": metadata.metadata4,
                "metadata5": metadata.metadata5,
                "metadata6": metadata.metadata6,
                "metadata7": metadata.metadata7,
                "metadata8": metadata.metadata8,
                "metadata9": metadata.metadata9,
                "metadata10": metadata.metadata10,
                "metadata11": metadata.metadata11,
                "metadata12": metadata.metadata12,
                "metadata13": metadata.metadata13,
                "metadata14": metadata.metadata14,
                "metadata15": metadata.metadata15,
                "created_at": metadata.created_at
            })
        
        # Calculate pagination info
        pages = (total_count + limit - 1) // limit if limit else 0
        current_page = (skip // limit) + 1 if limit else 0
        
        return PaginatedResponse(
            items=items,
            pagination={
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "pages": pages,
                "current_page": current_page
            },
            message=f"Retrieved {len(items)} metadata records"
        )
        
    except Exception as e:
        logger.error(f"Error retrieving device metadata: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Config endpoints
@router.post("/config", response_model=Dict[str, Any])
async def update_device_configs(
    request: ConfigUpdateRequest,
    db: Session = Depends(get_db)
):
    """
    Update device configurations for multiple devices.
    
    - **device_ids**: List of device IDs to update (required)
    - **config1-10**: Configuration fields (all optional)
    
    Sets config_updated to False for each updated device.
    """
    try:
        updated_devices = []
        failed_devices = []
        
        # Prepare config data (only include non-None values)
        config_data = {}
        for i in range(1, 11):
            field_name = f"config{i}"
            field_value = getattr(request, field_name)
            if field_value is not None:
                config_data[field_name] = field_value
        
        config_data["config_updated"] = False
        
        for device_id in request.device_ids:
            try:
                # Verify device exists
                device = device_crud.get_by_device_id(db, device_id=device_id)
                if not device:
                    failed_devices.append({
                        "device_id": device_id,
                        "error": "Device not found"
                    })
                    continue
                
                # Create config record
                config_create_data = {"device_id": device_id, **config_data}
                config_create = ConfigValuesCreate(**config_create_data)
                config_record = config_crud.create(db, obj_in=config_create)
                
                updated_devices.append({
                    "device_id": device_id,
                    "config_record_id": str(config_record.id),
                    "created_at": config_record.created_at
                })
                
            except Exception as e:
                failed_devices.append({
                    "device_id": device_id,
                    "error": str(e)
                })
        
        return {
            "message": f"Updated configurations for {len(updated_devices)} device(s)",
            "updated_devices": updated_devices,
            "failed_devices": failed_devices,
            "total_requested": len(request.device_ids),
            "successful": len(updated_devices),
            "failed": len(failed_devices)
        }
        
    except Exception as e:
        logger.error(f"Error updating device configurations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/config", response_model=Dict[str, Any])
async def get_device_config(
    *,
    db: Session = Depends(get_db),
    channel_id: int = Query(..., description="Device channel ID"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Number of items to return"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)")
):
    """
    Get device configuration by channel ID and set config_updated to True.
    
    - **channel_id**: Device channel ID (required)
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum records to return
    - **start_date**: Filter records from this date
    - **end_date**: Filter records until this date
    
    Returns the latest config for the device and marks config_updated as True.
    """
    try:
        # Get device by channel_id
        device = device_crud.get_by_channel_id(db, channel_id=channel_id)
        if not device:
            raise HTTPException(status_code=404, detail=f"Device with channel_id {channel_id} not found")
        
        # Build query for config records
        query = select(ConfigValues).where(ConfigValues.device_id == device.device_id)
        count_query = select(func.count(ConfigValues.id)).where(ConfigValues.device_id == device.device_id)
        
        # Apply date filters if provided
        conditions = [ConfigValues.device_id == device.device_id]
        
        if start_date:
            conditions.append(ConfigValues.created_at >= start_date)
        
        if end_date:
            conditions.append(ConfigValues.created_at <= end_date)
        
        # Apply conditions
        query = query.where(and_(*conditions))
        count_query = count_query.where(and_(*conditions))
        
        # Get total count
        total_count = db.exec(count_query).one()
        
        # Apply pagination and ordering (latest first)
        query = query.order_by(ConfigValues.created_at.desc()).offset(skip).limit(limit)
        
        # Execute query
        config_records = db.exec(query).all()
        
        # Update config_updated to True for retrieved records
        updated_count = 0
        items = []
        for config in config_records:
            if not config.config_updated:
                config_update = ConfigValuesUpdate(config_updated=True)
                config_crud.update(db, db_obj=config, obj_in=config_update)
                updated_count += 1
            
            items.append({
                "id": str(config.id),
                "device_id": config.device_id,
                "channel_id": channel_id,
                "config1": config.config1,
                "config2": config.config2,
                "config3": config.config3,
                "config4": config.config4,
                "config5": config.config5,
                "config6": config.config6,
                "config7": config.config7,
                "config8": config.config8,
                "config9": config.config9,
                "config10": config.config10,
                "config_updated": True,  # Now updated
                "created_at": config.created_at
            })
        
        # Calculate pagination info
        pages = (total_count + limit - 1) // limit if limit else 0
        current_page = (skip // limit) + 1 if limit else 0
        
        return {
            "items": items,
            "pagination": {
                "total": total_count,
                "skip": skip,
                "limit": limit,
                "pages": pages,
                "current_page": current_page
            },
            "message": f"Retrieved {len(items)} config records for device with channel_id {channel_id}",
            "device_id": device.device_id,
            "channel_id": channel_id,
            "config_updated_count": updated_count
        }
        
    except Exception as e:
        logger.error(f"Error retrieving device configuration: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Combined data endpoint (bonus)
@router.get("/combined", response_model=PaginatedResponse)
async def get_combined_device_data(
    *,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: Optional[int] = Query(100, ge=1, le=1000, description="Number of items to return"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    channel_id: Optional[int] = Query(None, description="Filter by channel ID"),
    start_date: Optional[datetime] = Query(None, description="Filter by start date (ISO format)"),
    end_date: Optional[datetime] = Query(None, description="Filter by end date (ISO format)")
):
    """
    Get combined field values, config values, and metadata for devices.
    
    Returns the latest values for each data type per device with pagination and filtering.
    """
    try:
        # Get devices based on filters
        device_query = select(Device)
        device_conditions = []
        
        if device_id:
            device_conditions.append(Device.device_id == device_id)
        
        if channel_id:
            device_conditions.append(Device.channel_id == channel_id)
        
        if device_conditions:
            device_query = device_query.where(and_(*device_conditions))
        
        # Apply pagination to devices
        total_devices = db.exec(select(func.count(Device.device_key)).where(and_(*device_conditions) if device_conditions else True)).one()
        device_query = device_query.offset(skip).limit(limit)
        devices = db.exec(device_query).all()
        
        items = []
        for device in devices:
            # Get latest field values
            latest_field = field_crud.get_latest_by_device(db, device_id=device.device_id)
            
            # Get latest config values
            latest_config = config_crud.get_latest_by_device(db, device_id=device.device_id)
            
            # Get latest metadata values
            latest_metadata = metadata_crud.get_latest_by_device(db, device_id=device.device_id)
            
            # Apply date filters if any data exists
            # Each timestamp must satisfy ALL applicable bounds (both start_date AND end_date)
            # Record is valid if at least one timestamp passes all checks
            if start_date or end_date:
                valid_item = False
                
                # Check each timestamp independently - must satisfy ALL applicable bounds
                for ts in [latest_field, latest_config, latest_metadata]:
                    if ts is None:
                        continue
                    # Check if this timestamp satisfies all applicable bounds
                    passes_start = start_date is None or ts.created_at >= start_date
                    passes_end = end_date is None or ts.created_at <= end_date
                    if passes_start and passes_end:
                        valid_item = True
                        break
                
                if not valid_item:
                    continue
            
            # Determine the most recent created_at timestamp
            created_timestamps = []
            if latest_field:
                created_timestamps.append(latest_field.created_at)
            if latest_config:
                created_timestamps.append(latest_config.created_at)
            if latest_metadata:
                created_timestamps.append(latest_metadata.created_at)
            
            latest_created_at = max(created_timestamps) if created_timestamps else datetime.now(timezone.utc)
            
            items.append({
                "device_id": device.device_id,
                "channel_id": device.channel_id,
                "field_values": {
                    "id": str(latest_field.id) if latest_field else None,
                    "field1": latest_field.field1 if latest_field else None,
                    "field2": latest_field.field2 if latest_field else None,
                    "field3": latest_field.field3 if latest_field else None,
                    "field4": latest_field.field4 if latest_field else None,
                    "field5": latest_field.field5 if latest_field else None,
                    "field6": latest_field.field6 if latest_field else None,
                    "field7": latest_field.field7 if latest_field else None,
                    "field8": latest_field.field8 if latest_field else None,
                    "field9": latest_field.field9 if latest_field else None,
                    "field10": latest_field.field10 if latest_field else None,
                    "field11": latest_field.field11 if latest_field else None,
                    "field12": latest_field.field12 if latest_field else None,
                    "field13": latest_field.field13 if latest_field else None,
                    "field14": latest_field.field14 if latest_field else None,
                    "field15": latest_field.field15 if latest_field else None,
                    "created_at": latest_field.created_at if latest_field else None
                } if latest_field else None,
                "config_values": {
                    "id": str(latest_config.id) if latest_config else None,
                    "config1": latest_config.config1 if latest_config else None,
                    "config2": latest_config.config2 if latest_config else None,
                    "config3": latest_config.config3 if latest_config else None,
                    "config4": latest_config.config4 if latest_config else None,
                    "config5": latest_config.config5 if latest_config else None,
                    "config6": latest_config.config6 if latest_config else None,
                    "config7": latest_config.config7 if latest_config else None,
                    "config8": latest_config.config8 if latest_config else None,
                    "config9": latest_config.config9 if latest_config else None,
                    "config10": latest_config.config10 if latest_config else None,
                    "config_updated": latest_config.config_updated if latest_config else None,
                    "created_at": latest_config.created_at if latest_config else None
                } if latest_config else None,
                "metadata_values": {
                    "id": str(latest_metadata.id) if latest_metadata else None,
                    "metadata1": latest_metadata.metadata1 if latest_metadata else None,
                    "metadata2": latest_metadata.metadata2 if latest_metadata else None,
                    "metadata3": latest_metadata.metadata3 if latest_metadata else None,
                    "metadata4": latest_metadata.metadata4 if latest_metadata else None,
                    "metadata5": latest_metadata.metadata5 if latest_metadata else None,
                    "metadata6": latest_metadata.metadata6 if latest_metadata else None,
                    "metadata7": latest_metadata.metadata7 if latest_metadata else None,
                    "metadata8": latest_metadata.metadata8 if latest_metadata else None,
                    "metadata9": latest_metadata.metadata9 if latest_metadata else None,
                    "metadata10": latest_metadata.metadata10 if latest_metadata else None,
                    "metadata11": latest_metadata.metadata11 if latest_metadata else None,
                    "metadata12": latest_metadata.metadata12 if latest_metadata else None,
                    "metadata13": latest_metadata.metadata13 if latest_metadata else None,
                    "metadata14": latest_metadata.metadata14 if latest_metadata else None,
                    "metadata15": latest_metadata.metadata15 if latest_metadata else None,
                    "created_at": latest_metadata.created_at if latest_metadata else None
                } if latest_metadata else None,
                "created_at": latest_created_at
            })
        
        # Calculate pagination info
        pages = (total_devices + limit - 1) // limit if limit else 0
        current_page = (skip // limit) + 1 if limit else 0
        
        return PaginatedResponse(
            items=items,
            pagination={
                "total": total_devices,
                "skip": skip,
                "limit": limit,
                "pages": pages,
                "current_page": current_page
            },
            message=f"Retrieved combined data for {len(items)} device(s)"
        )
        
    except Exception as e:
        logger.error(f"Error retrieving combined device data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")