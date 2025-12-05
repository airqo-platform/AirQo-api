from fastapi import APIRouter, Depends, HTTPException, Query, Path, UploadFile, File, Form, BackgroundTasks
from sqlmodel import Session
from typing import List, Optional
import uuid
import string
import random
from datetime import datetime, timezone, timedelta
import csv
import io
import json

from app.deps import get_db
from app.models import (
    AirQloud,
    AirQloudCreate,
    AirQloudUpdate,
    AirQloudRead,
    AirQloudWithDeviceCount,
    AirQloudWithPerformance,
    AirQloudDeviceCreate,
    AirQloudDeviceRead,
    AirQloudSingleBulkCreateResponse
)
from app.crud import airqloud as airqloud_crud
from app.utils.background_tasks import (
    fetch_missing_airqloud_performance_background,
    fetch_single_airqloud_with_devices_background
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def generate_unique_airqloud_id(db: Session) -> str:
    """Generate a unique AirQloud ID"""
    while True:
        # Generate a random 12-character ID with letters and numbers
        id_chars = string.ascii_lowercase + string.digits
        airqloud_id = 'aq_' + ''.join(random.choices(id_chars, k=10))
        
        # Check if ID already exists
        existing = airqloud_crud.get(db, id=airqloud_id)
        if not existing:
            return airqloud_id


@router.get("/")
async def get_airqlouds(
    *,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return"),
    country: Optional[str] = Query(None, description="Filter by country"),
    search: Optional[str] = Query(None, description="Search airqlouds by name, ID, or country"),
    include_performance: bool = Query(False, description="Include performance data for the past N days"),
    performance_days: int = Query(14, ge=1, le=365, description="Number of days of performance data to include starting from yesterday (default: 14)")
):
    """
    Get all AirQlouds with device counts and optionally performance data.
    
    **Behavior:**
    - Returns current data from the database immediately
    - If performance data is missing, it triggers a background fetch/computation
    - Subsequent requests will include the updated data
    
    **Query Parameters:**
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return
    - **country**: Filter AirQlouds by country (optional)
    - **search**: Search term to find airqlouds (searches across name, ID, country)
    - **include_performance**: Set to `true` to include performance data (default: false)
    - **performance_days**: Number of days of performance history to include starting from yesterday (default: 14, max: 365)
    
    **Search Fields:**
    The search parameter searches across:
    - AirQloud name (e.g., "Kampala Central")
    - AirQloud ID (e.g., "airqloud_001")
    - Country (e.g., "Uganda", "Kenya")
    
    **Search Behavior:**
    - Case-insensitive partial matching
    - Returns paginated results of matches
    
    **Returns:**
    List of AirQlouds with the number of devices in each cluster.
    
    When `include_performance=true`, each AirQloud includes compact performance arrays:
    - **freq**: Array of frequency values (one per day)
    - **error_margin**: Array of error margin values (one per day)
    - **timestamp**: Array of timestamps (one per day)
    
    **Response Format:**
    ```json
    [
      {
        "id": "aq_967u90womy",
        "name": "Kisumu",
        "country": "Kenya",
        "visibility": null,
        "is_active": false,
        "created_at": "2025-11-06T17:45:56.260014+03:00",
        "device_count": 15,
        "freq": [12, 14, 16, ...],
        "error_margin": [2.5, 3.1, 2.8, ...],
        "timestamp": ["2025-10-25T00:00:00", "2025-10-26T00:00:00", ...]
      }
    ]
    ```
    
    **Examples:**
    - `GET /airqlouds` - Get all airqlouds with device counts only
    - `GET /airqlouds?search=kampala` - Search for airqlouds matching "kampala"
    - `GET /airqlouds?country=Uganda&search=central` - Search in Uganda for "central"
    - `GET /airqlouds?include_performance=true` - Get airqlouds with performance for past 14 days
    - `GET /airqlouds?search=nairobi&include_performance=true&performance_days=7` - Search and include 7 days of performance
    """
    try:
        if include_performance:
            # Return current data without waiting for missing data fetch
            airqlouds = airqloud_crud.get_all_with_performance(
                db, 
                skip=skip, 
                limit=limit,
                country=country,
                search=search,
                days=performance_days,
                fetch_missing=False  # Don't block on fetching missing data
            )
            
            # Trigger background fetch for missing data
            airqloud_ids = [aq["id"] for aq in airqlouds]
            if airqloud_ids:
                end_date = datetime.now(timezone.utc) - timedelta(days=1)
                start_date = end_date - timedelta(days=performance_days-1)
                background_tasks.add_task(
                    fetch_missing_airqloud_performance_background,
                    airqloud_ids,
                    start_date,
                    end_date
                )
                logger.info(f"Triggered background fetch for {len(airqloud_ids)} airqlouds")
        else:
            airqlouds = airqloud_crud.get_all_with_device_counts(
                db, 
                skip=skip, 
                limit=limit,
                country=country,
                search=search
            )
        return airqlouds
    except Exception as e:
        logger.error(f"Error fetching AirQlouds: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch AirQlouds: {str(e)}")


@router.get("/{airqloud_id}")
async def get_airqloud(
    *,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks,
    airqloud_id: str = Path(..., description="AirQloud ID"),
    include_performance: bool = Query(False, description="Include performance data for the past N days"),
    performance_days: int = Query(14, ge=1, le=365, description="Number of days of performance data to include starting from yesterday (default: 14)")
):
    """
    Get a specific AirQloud by ID with device count and optionally performance data.
    
    **Behavior:**
    - Returns current data from the database immediately
    - If performance data is missing, it triggers a background fetch/computation
    - Subsequent requests will include the updated data
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud
    
    **Query Parameters:**
    - **include_performance**: Set to `true` to include performance data (default: false)
    - **performance_days**: Number of days of performance history to include starting from yesterday (default: 14, max: 365)
    
    **Returns:**
    AirQloud details including the number of devices.
    When `include_performance=true`, also includes:
    - `freq`: Array of frequency values for the airqloud (average across devices)
    - `error_margin`: Array of error margin values for the airqloud
    - `timestamp`: Array of timestamps corresponding to the metrics
    - `device_performance`: Array of objects containing performance data for each device:
      - `device_id`: ID of the device
      - `device_name`: Name of the device
      - `performance`: Object with `freq`, `error_margin`, and `timestamp` arrays
    
    **Examples:**
    - `GET /airqlouds/airqloud_001` - Get airqloud with device count only
    - `GET /airqlouds/airqloud_001?include_performance=true` - Get airqloud with performance for past 14 days
    - `GET /airqlouds/airqloud_001?include_performance=true&performance_days=7` - Get airqloud with performance for past 7 days
    """
    try:
        if include_performance:
            # Return current data without waiting for missing data fetch
            airqloud = airqloud_crud.get_with_performance(
                db, 
                airqloud_id=airqloud_id,
                days=performance_days,
                fetch_missing=False  # Don't block on fetching missing data
            )
            
            if airqloud:
                # Get device IDs for background fetch
                devices = airqloud_crud.get_devices(db, airqloud_id=airqloud_id, include_inactive=False)
                device_ids = [device.id for device in devices]
                
                # Trigger background fetch for missing data
                end_date = datetime.now(timezone.utc) - timedelta(days=1)
                start_date = end_date - timedelta(days=performance_days-1)
                background_tasks.add_task(
                    fetch_single_airqloud_with_devices_background,
                    airqloud_id,
                    device_ids,
                    start_date,
                    end_date
                )
                logger.info(f"Triggered background fetch for airqloud {airqloud_id} with {len(device_ids)} devices")
        else:
            airqloud = airqloud_crud.get_with_device_count(db, airqloud_id=airqloud_id)
        
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        return airqloud
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch AirQloud: {str(e)}")


@router.post("/", response_model=AirQloudRead, status_code=201)
async def create_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_in: AirQloudCreate
):
    """
    Create a new AirQloud.
    
    **Request Body:**
    Only the `name` field is required. All other fields are optional.
    ```json
    {
        "name": "Kampala Central",
        "country": "Uganda",
        "visibility": true,
        "is_active": false,
        "number_of_devices": 0
    }
    ```
    
    **Returns:**
    The created AirQloud details with an auto-generated unique ID.
    """
    try:
        # Generate a unique ID
        unique_id = generate_unique_airqloud_id(db)
        
        # Create the AirQloud data with generated ID and timestamp
        airqloud_data = airqloud_in.model_dump()
        airqloud_data['id'] = unique_id
        airqloud_data['created_at'] = datetime.now(timezone.utc)
        
        # Create AirQloud instance for database
        from app.models.airqloud import AirQloud
        airqloud = AirQloud(**airqloud_data)
        
        # Save to database
        db.add(airqloud)
        db.commit()
        db.refresh(airqloud)
        
        logger.info(f"Created AirQloud: {airqloud.name} (ID: {airqloud.id})")
        return airqloud
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating AirQloud: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create AirQloud: {str(e)}")


@router.put("/{airqloud_id}", response_model=AirQloudRead)
async def update_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID"),
    airqloud_in: AirQloudUpdate
):
    """
    Update an existing AirQloud.
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud to update
    
    **Request Body:**
    ```json
    {
        "name": "Updated Kampala Central",
        "country": "Uganda",
        "visibility": true,
        "is_active": true,
        "number_of_devices": 10
    }
    ```
    
    **Returns:**
    The updated AirQloud details.
    """
    try:
        airqloud = airqloud_crud.get(db, id=airqloud_id)
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        
        airqloud = airqloud_crud.update(db, db_obj=airqloud, obj_in=airqloud_in)
        logger.info(f"Updated AirQloud: {airqloud.name} (ID: {airqloud.id})")
        return airqloud
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update AirQloud: {str(e)}")


@router.delete("/{airqloud_id}", status_code=204)
async def delete_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID")
):
    """
    Delete an AirQloud.
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud to delete
    
    **Note:** This will also remove all device associations.
    """
    try:
        airqloud = airqloud_crud.get(db, id=airqloud_id)
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        
        airqloud_crud.remove(db, id=airqloud_id)
        logger.info(f"Deleted AirQloud: {airqloud.name} (ID: {airqloud.id})")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete AirQloud: {str(e)}")


@router.post("/{airqloud_id}/devices", response_model=AirQloudDeviceRead, status_code=201)
async def add_device_to_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID"),
    device_in: AirQloudDeviceCreate
):
    """
    Add a device to an AirQloud.
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud
    
    **Request Body:**
    ```json
    {
        "id": "device_001",
        "cohort_id": "airqloud_001",
        "name": "Device 1",
        "long_name": "Air Quality Device 1",
        "device_number": 1,
        "is_active": true,
        "is_online": true,
        "status": "active",
        "network": "airqo"
    }
    ```
    
    **Returns:**
    The created device-AirQloud relationship.
    """
    try:
        # Verify AirQloud exists
        airqloud = airqloud_crud.get(db, id=airqloud_id)
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        
        # Add device to AirQloud
        airqloud_device = airqloud_crud.add_device(
            db,
            airqloud_id=airqloud_id,
            device_data=device_in
        )
        logger.info(f"Added device {device_in.id} to AirQloud {airqloud.name}")
        return airqloud_device
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding device to AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add device: {str(e)}")


@router.delete("/{airqloud_id}/devices/{device_id}", status_code=204)
async def remove_device_from_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID"),
    device_id: str = Path(..., description="Device ID")
):
    """
    Remove a device from an AirQloud (soft delete).
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud
    - **device_id**: ID of the device to remove
    """
    try:
        # Verify AirQloud exists
        airqloud = airqloud_crud.get(db, id=airqloud_id)
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        
        # Remove device
        success = airqloud_crud.remove_device(
            db,
            airqloud_id=airqloud_id,
            device_id=device_id
        )
        
        if not success:
            raise HTTPException(
                status_code=404, 
                detail="Device not found in this AirQloud"
            )
        
        logger.info(f"Removed device {device_id} from AirQloud {airqloud.name}")
        return None
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing device from AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to remove device: {str(e)}")


@router.get("/{airqloud_id}/devices", response_model=List[AirQloudDeviceRead])
async def get_airqloud_devices(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID"),
    include_inactive: bool = Query(False, description="Include inactive devices"),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of items to return")
):
    """
    Get all devices in an AirQloud.
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud
    
    **Query Parameters:**
    - **include_inactive**: Include devices that have been removed (is_active=false)
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum number of records to return
    
    **Returns:**
    List of device-AirQloud relationships.
    """
    try:
        # Verify AirQloud exists
        airqloud = airqloud_crud.get(db, id=airqloud_id)
        if not airqloud:
            raise HTTPException(status_code=404, detail="AirQloud not found")
        
        devices = airqloud_crud.get_devices(
            db,
            airqloud_id=airqloud_id,
            include_inactive=include_inactive,
            skip=skip,
            limit=limit
        )
        return devices
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching devices for AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch devices: {str(e)}")


@router.post("/create-with-devices", response_model=AirQloudSingleBulkCreateResponse, status_code=201)
async def create_airqloud_with_devices_csv(
    *,
    db: Session = Depends(get_db),
    file: UploadFile = File(..., description="CSV file containing device data"),
    name: str = Form(..., description="Name of the AirQloud"),
    country: Optional[str] = Form(None, description="Country of the AirQloud"),
    visibility: Optional[bool] = Form(None, description="Visibility of the AirQloud"),
    column_mappings: str = Form(..., description="JSON string mapping CSV columns to device fields")
):
    """
    Create a single AirQloud and add all devices from CSV to it.
    
    **Form Parameters:**
    - **file**: CSV file containing device identifiers
    - **name**: Name of the AirQloud (required)
    - **country**: Country of the AirQloud (optional)
    - **visibility**: Visibility boolean (optional)
    - **column_mappings**: JSON string mapping CSV columns to device fields
    
    **Column Mappings Format:**
    ```json
    {
        "device": "device_id",
        "read": "read_key", 
        "channel": "channel_id"
    }
    ```
    
    **Supported Device Fields:**
    - `device_id`: Device ID
    - `read_key`: Device read key
    - `channel_id`: Device channel ID
    
    **CSV Example:**
    ```csv
    device,read,channel,description
    device_001,RK001,101,"Air quality sensor 1"
    device_002,RK002,102,"Air quality sensor 2"
    ,,103,"Channel only device"
    ```
    
    **Column Mappings Example:**
    ```json
    {"device": "device_id", "read": "read_key", "channel": "channel_id"}
    ```
    
    **Returns:**
    Details of created AirQloud, successfully added devices, errors, and summary statistics.
    """
    
    # Validate file type
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="File must be a CSV file")
    
    try:
        # Parse column mappings
        try:
            mappings = json.loads(column_mappings)
            if not isinstance(mappings, dict):
                raise ValueError("Column mappings must be a JSON object")
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON in column_mappings: {str(e)}")
        
        # Validate mapping values
        valid_fields = ["device_id", "read_key", "channel_id"]
        for csv_col, device_field in mappings.items():
            if device_field not in valid_fields:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid device field '{device_field}'. Must be one of: {', '.join(valid_fields)}"
                )
        
        if not mappings:
            raise HTTPException(status_code=400, detail="At least one column mapping is required")
        
        # Read CSV file
        content = await file.read()
        csv_content = content.decode('utf-8')
        csv_reader = csv.DictReader(io.StringIO(csv_content))
        
        # Validate that mapped columns exist in CSV
        csv_columns = csv_reader.fieldnames or []
        for csv_col in mappings.keys():
            if csv_col not in csv_columns:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Column '{csv_col}' not found in CSV. Available columns: {', '.join(csv_columns)}"
                )
        
        # Parse CSV data
        devices_data = []
        for row in csv_reader:
            devices_data.append(row)
        
        if not devices_data:
            raise HTTPException(status_code=400, detail="No device data found in CSV file")
        
        # Create AirQloud with devices
        logger.info(f"Creating AirQloud '{name}' with {len(devices_data)} devices using mappings: {mappings}")
        result = airqloud_crud.create_single_airqloud_with_devices_csv(
            db,
            airqloud_name=name,
            airqloud_country=country,
            airqloud_visibility=visibility,
            devices_data=devices_data,
            column_mappings=mappings
        )
        
        logger.info(f"AirQloud creation completed: {result['summary']}")
        return AirQloudSingleBulkCreateResponse(**result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating AirQloud with devices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create AirQloud: {str(e)}")
