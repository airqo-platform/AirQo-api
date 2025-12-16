from fastapi import APIRouter, Depends, HTTPException, Query, Path, BackgroundTasks
from sqlmodel import Session
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta

from app.deps import get_db
from app.models import (
    AirQloudUpdate,
    AirQloudRead,
    AirQloudDeviceRead,
)
from app.crud import airqloud as airqloud_crud
from app.utils.background_tasks import (
    fetch_missing_airqloud_performance_background,
    fetch_single_airqloud_with_devices_background
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def run_airqloud_sync(force_sync: bool = False) -> Dict[str, Any]:
    """
    Run the airqloud sync from Platform API.
    This is extracted to be callable from both the endpoint and scheduled jobs.
    """
    from app.configs.database import SessionLocal
    from cronjobs.update_airqlouds import AirQloudUpdater
    
    session = SessionLocal()
    try:
        updater = AirQloudUpdater(session)
        results = updater.run(force_sync=force_sync)
        return results
    finally:
        session.close()


@router.post("/sync", status_code=200)
async def sync_airqlouds(
    *,
    background_tasks: BackgroundTasks,
    force: bool = Query(False, description="Force full sync even if counts match"),
    run_in_background: bool = Query(True, description="Run sync in background (default: true)")
):
    """
    Trigger sync of AirQlouds (cohorts) from Platform API.
    
    This endpoint fetches the latest cohorts from the Platform API and updates
    the local database. Use this to manually refresh airqloud data.
    
    **Query Parameters:**
    - **force**: Force full sync even if API and DB counts match (default: false)
    - **run_in_background**: Run sync in background and return immediately (default: true)
    
    **Behavior:**
    - Compares API total count with database count
    - If counts differ (or force=true), fetches and syncs all cohorts
    - Creates new airqlouds, updates existing ones
    - Preserves manually-set country field
    - Soft-deletes devices removed from cohorts
    
    **Returns:**
    - If run_in_background=true: Acknowledgment that sync was triggered
    - If run_in_background=false: Full sync statistics
    
    **Examples:**
    - `POST /airqlouds/sync` - Trigger background sync
    - `POST /airqlouds/sync?force=true` - Force full sync in background
    - `POST /airqlouds/sync?run_in_background=false` - Run sync and wait for results
    """
    try:
        if run_in_background:
            # Run in background and return immediately
            background_tasks.add_task(run_airqloud_sync, force)
            logger.info(f"Triggered background airqloud sync (force={force})")
            return {
                "success": True,
                "message": "Airqloud sync triggered in background",
                "force": force
            }
        else:
            # Run synchronously and return results
            logger.info(f"Starting synchronous airqloud sync (force={force})")
            results = run_airqloud_sync(force)
            
            if results.get('success'):
                return {
                    "success": True,
                    "message": "Airqloud sync completed successfully",
                    "statistics": {
                        "total_fetched": results.get('total_fetched', 0),
                        "new_airqlouds": results.get('new_airqlouds', 0),
                        "updated_airqlouds": results.get('updated_airqlouds', 0),
                        "new_devices": results.get('new_devices', 0),
                        "updated_devices": results.get('updated_devices', 0),
                        "deactivated_devices": results.get('deactivated_devices', 0),
                        "errors": results.get('errors', 0),
                        "db_count_before": results.get('db_count_before', 0),
                        "db_count_after": results.get('db_count_after', 0),
                    }
                }
            else:
                raise HTTPException(
                    status_code=500, 
                    detail=f"Sync failed: {results.get('error', 'Unknown error')}"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering airqloud sync: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to trigger sync: {str(e)}")


# REMOVED: generate_unique_airqloud_id - no longer needed as IDs come from Platform API


@router.get("")
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


# REMOVED: Manual creation endpoint - AirQlouds are synced from Platform API cohorts
# @router.post("", response_model=AirQloudRead, status_code=201)
# async def create_airqloud(...):


@router.put("/{airqloud_id}", response_model=AirQloudRead)
async def update_airqloud(
    *,
    db: Session = Depends(get_db),
    airqloud_id: str = Path(..., description="AirQloud ID"),
    airqloud_in: AirQloudUpdate
):
    """
    Update an existing AirQloud's country field.
    
    **Note:** AirQlouds are synced from the Platform API. Only the country field
    can be manually updated as it is managed locally in the beacon database.
    
    **Path Parameters:**
    - **airqloud_id**: ID of the AirQloud to update
    
    **Request Body:**
    ```json
    {
        "country": "Uganda"
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
        logger.info(f"Updated AirQloud country: {airqloud.name} (ID: {airqloud.id}) -> {airqloud.country}")
        return airqloud
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating AirQloud {airqloud_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update AirQloud: {str(e)}")


# REMOVED: Manual creation endpoint - AirQlouds are synced from Platform API
# @router.post("", response_model=AirQloudRead, status_code=201)
# async def create_airqloud(...):

# REMOVED: Delete endpoint - AirQlouds are synced from Platform API
# @router.delete("/{airqloud_id}", status_code=204)
# async def delete_airqloud(...):

# REMOVED: Add device endpoint - Devices are synced from Platform API cohorts
# @router.post("/{airqloud_id}/devices", response_model=AirQloudDeviceRead, status_code=201)
# async def add_device_to_airqloud(...):

# REMOVED: Remove device endpoint - Devices are synced from Platform API cohorts
# @router.delete("/{airqloud_id}/devices/{device_id}", status_code=204)
# async def remove_device_from_airqloud(...):


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


# REMOVED: Bulk CSV create endpoint - AirQlouds are synced from Platform API cohorts
# @router.post("/create-with-devices", response_model=AirQloudSingleBulkCreateResponse, status_code=201)
# async def create_airqloud_with_devices_csv(...):
