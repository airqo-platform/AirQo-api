from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlmodel import Session, select, func, and_
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.deps import get_db
from app.models import Device, DeviceRead, DeviceCreate, DeviceUpdate, DeviceFirmwareUpdate, DeviceReading, Site
from app.models.location import Location
from app.crud import device as device_crud
from app.utils.background_tasks import update_all_null_device_keys_background, update_missing_sites_background, sync_devices_background
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/summary")
async def get_device_summary(
    *,
    db: Session = Depends(get_db)
):
    """
    Get summary statistics for devices and airqlouds.
    
    Returns:
    - **total_devices**: Total number of devices in the system
    - **active_airqlouds**: Number of active airqlouds
    - **tracked_devices**: Number of unique devices associated with active airqlouds
    - **deployed_devices**: Total number of devices with status 'deployed'
    - **tracked_online**: Number of tracked devices that are currently online
    - **tracked_offline**: Number of tracked devices that are currently offline
    """
    return device_crud.get_summary_stats(db)


@router.get("/stats")
async def get_comprehensive_device_stats(
    *,
    db: Session = Depends(get_db),
    include_networks: bool = Query(True, description="Include network breakdown"),
    include_categories: bool = Query(True, description="Include category breakdown"),
    include_maintenance: bool = Query(True, description="Include maintenance info")
):
    """
    Get comprehensive device statistics including summary counts, deployment status,
    network breakdown, category breakdown, and maintenance information.
    """
    return device_crud.get_comprehensive_stats(
        db,
        include_networks=include_networks,
        include_categories=include_categories,
        include_maintenance=include_maintenance
    )

@router.get("/")
async def get_devices(
    *,
    db: Session = Depends(get_db),
    background_tasks: BackgroundTasks,
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: Optional[int] = Query(None, ge=1, le=10000, description="Number of items to return (omit for all devices)"),
    network: Optional[str] = Query(None, description="Filter by network name"),
    status: Optional[str] = Query(None, description="Filter by device status"),
    search: Optional[str] = Query(None, description="Search devices by name, device_id, site_id, or location (city, district, country, site_name)")
):
    """
    Get devices with related site, location, and reading data.
    Supports filtering, searching, and pagination with metadata.
    
    **Query Parameters:**
    - **skip**: Number of records to skip (for pagination)
    - **limit**: Maximum records to return (omit or set to None to get all devices)
    - **network**: Filter by network name
    - **status**: Filter by device status
    - **search**: Search term to find devices (searches across ALL data)
    
    **Search Fields:**
    The search parameter searches across:
    - Device name (e.g., "AirQo_Kampala_001")
    - Device ID (e.g., "aq_001")
    - Site ID (e.g., "kampala_central")
    - Site name (e.g., "Kampala Central Monitoring Station")
    - City (e.g., "Kampala", "Nairobi")
    - District (e.g., "Kampala Central", "Nakawa")
    - Country (e.g., "Uganda", "Kenya")
    - Location name
    
    **Search Behavior:**
    - Searches across the **entire dataset**, not just the current page
    - Case-insensitive partial matching
    - Returns paginated results of matches
    
    **Examples:**
    - `GET /devices?search=kampala` - Find all devices in Kampala (city/name/etc)
    - `GET /devices?search=nakawa` - Find devices in Nakawa district
    - `GET /devices?search=AQI` - Find all devices with "AQI" in name/id
    - `GET /devices?search=kampala&limit=50` - Search and paginate results
    - `GET /devices?network=airqo&search=kampala` - Combine filter and search
    
    **Returns:**
    ```json
    {
        "devices": [...],
        "pagination": {
            "total": 1500,           // Total devices matching filters + search
            "skip": 0,               // Number of records skipped
            "limit": 100,            // Limit per page (null if no limit)
            "returned": 100,         // Number of devices in this response
            "pages": 15,             // Total number of pages (0 if no limit)
            "current_page": 1,       // Current page number (0 if no limit)
            "has_next": true,        // Whether there are more pages
            "has_previous": false    // Whether there are previous pages
        }
    }
    ```
    
    **Note:** When fetching all devices (limit=None), the system processes data in batches
    to avoid overwhelming the database while still returning all results efficiently.
    """
    result = device_crud.get_devices_with_details(
        db,
        skip=skip,
        limit=limit,
        network=network,
        status=status,
        search=search
    )

    # Check for missing sites and trigger background update if needed
    # If a device has a site_id but no corresponding site_location data, it means the site is missing in dim_site
    devices_list = result.get("devices", [])
    has_missing_sites = False
    
    for device_data in devices_list:
        if device_data.get("site_id") and not device_data.get("site_location"):
            has_missing_sites = True
            break
            
    if has_missing_sites:
        # trigger background task
        background_tasks.add_task(update_missing_sites_background)
        
    return result


@router.post("/sync")
async def sync_devices(
    *,
    background_tasks: BackgroundTasks
):
    """
    Trigger a background sync of devices from the Platform API.
    
    This process:
    - Fetches all devices from the Platform API
    - Updates local database with new/changed device data
    - Updates/creates associated sites
    - Decrypts keys if needed
    
    This is an async background task and returns immediately.
    """
    background_tasks.add_task(sync_devices_background)
    return {"message": "Device sync triggered in background"}


@router.get("/map-data")
async def get_map_data(
    *,
    db: Session = Depends(get_db)
):
    # Get deployed devices (filtered to AirQo network only)
    devices = db.exec(
        select(Device)
        .where(and_(Device.status == 'deployed', Device.network == 'airqo'))
    ).all()
    
    if not devices:
        return []

    device_keys = [d.device_key for d in devices]
    site_ids = [d.site_id for d in devices if d.site_id]
    
    # Bulk fetch active locations
    locations = db.exec(
        select(Location)
        .where(Location.device_key.in_(device_keys))
        .where(Location.is_active.is_(True))
    ).all()
    location_map = {loc.device_key: loc for loc in locations}
    
    # Bulk fetch sites for fallback
    sites = []
    if site_ids:
        sites = db.exec(
            select(Site)
            .where(Site.site_id.in_(site_ids))
        ).all()
    site_map = {site.site_id: site for site in sites}

    # Bulk fetch latest readings
    # Optimizing to use a subquery for max date per device is good, reuse similar logic
    reading_subquery = (
        select(
            DeviceReading.device_key,
            func.max(DeviceReading.created_at).label("max_created_at")
        )
        .where(DeviceReading.device_key.in_(device_keys))
        .group_by(DeviceReading.device_key)
        .subquery()
    )
    
    readings = db.exec(
        select(DeviceReading)
        .join(
            reading_subquery,
            and_(
                DeviceReading.device_key == reading_subquery.c.device_key,
                DeviceReading.created_at == reading_subquery.c.max_created_at
            )
        )
    ).all()
    reading_map = {r.device_key: r for r in readings}
    
    result = []
    for device in devices:
        lat = None
        lon = None
        site_name = None
        
        # 1. Try Active Location
        loc = location_map.get(device.device_key)
        if loc:
            lat = loc.latitude
            lon = loc.longitude
            site_name = loc.site_name
            
        # 2. Fallback to Site if coordinates missing
        if lat is None or lon is None:
            if device.site_id:
                site = site_map.get(device.site_id)
                if site:
                    lat = site.latitude
                    lon = site.longitude
                    if not site_name:
                        site_name = site.site_name
        
        # If still no coordinates, skip this device from map
        if lat is None or lon is None:
            continue
            
        latest_reading = reading_map.get(device.device_key)
        
        result.append({
            "device_name": device.device_name,
            "is_online": device.is_online,
            "latitude": lat,
            "longitude": lon,
            "site_name": site_name,
            "recent_reading": {
                "timestamp": latest_reading.created_at.isoformat() if latest_reading and latest_reading.created_at else None,
                "pm2_5": latest_reading.pm2_5 if latest_reading else None,
                "pm10": latest_reading.pm10 if latest_reading else None
            } if latest_reading else None
        })
    
    # Sort by device name
    result.sort(key=lambda x: x["device_name"])
    
    return result


# @router.post("/", response_model=DeviceRead)
# async def create_device(
#     *,
#     db: Session = Depends(get_db),
#     device_in: DeviceCreate
# ):
#     existing = device_crud.get_by_name(db, device_name=device_in.device_name)
#     if existing:
#         raise HTTPException(status_code=400, detail="Device name already exists")
    
#     device = device_crud.create(db, obj_in=device_in)
#     return device


# @router.patch("/{device_id}", response_model=DeviceRead)
# async def update_device(
#     *,
#     db: Session = Depends(get_db),
#     device_id: str,
#     device_in: DeviceUpdate
# ):
#     device = device_crud.get_by_device_id(db, device_id=device_id)
#     if not device:
#         raise HTTPException(status_code=404, detail="Device not found")
    
#     device = device_crud.update(db, db_obj=device, obj_in=device_in)
#     return device


@router.get("/debug/device-ids")
async def debug_device_ids(
    *,
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100, description="Number of device IDs to return")
):
    """Debug endpoint to see what device IDs are in the database"""
    devices = db.exec(select(Device.device_id, Device.device_name).limit(limit)).all()
    return {
        "total_found": len(devices),
        "device_ids": [{"device_id": d.device_id, "device_name": d.device_name} for d in devices]
    }


@router.get("/offline/list")
async def get_offline_devices(
    *,
    db: Session = Depends(get_db),
    hours: int = Query(24, ge=1, le=168, description="Hours to consider device offline")
):
    offline_devices = device_crud.get_offline_devices(db, hours=hours)
    
    return {
        "threshold_hours": hours,
        "count": len(offline_devices),
        "devices": [
            {
                "device_id": d.device_id,
                "device_key": d.device_key,
                "device_name": d.device_name,
                "network": d.network,
                "category": d.category,
                "last_updated": d.last_updated.isoformat() if d.last_updated else "Never",
                "status": d.status,
                "is_online": d.is_online,
                "is_active": d.is_active
            }
            for d in offline_devices
        ]
    }



@router.get("/maintenance/upcoming")
async def get_upcoming_maintenance_devices(
    *,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Days ahead to check for upcoming maintenance")
):
    current_time = datetime.now(timezone.utc)
    cutoff_time = current_time + timedelta(days=days)
    
    # Get devices with upcoming maintenance
    devices = db.exec(
        select(Device)
        .where(
            (Device.next_maintenance != None) & 
            (Device.next_maintenance >= current_time) &
            (Device.next_maintenance <= cutoff_time)
        )
        .order_by(Device.next_maintenance)
    ).all()
    
    device_keys = [device.device_key for device in devices]
    
    if not device_keys:
        return {
            "threshold_days": days,
            "count": 0,
            "devices": []
        }
    
    # Batch query for latest readings to get site names
    reading_subquery = (
        select(
            DeviceReading.device_key,
            func.max(DeviceReading.created_at).label("max_created_at")
        )
        .where(DeviceReading.device_key.in_(device_keys))
        .group_by(DeviceReading.device_key)
        .subquery()
    )
    
    readings_query = (
        select(DeviceReading)
        .join(
            reading_subquery,
            and_(
                DeviceReading.device_key == reading_subquery.c.device_key,
                DeviceReading.created_at == reading_subquery.c.max_created_at
            )
        )
    )
    readings = db.exec(readings_query).all()
    reading_map = {reading.device_key: reading for reading in readings}
    
    result_devices = []
    for device in devices:
        reading = reading_map.get(device.device_key)
        days_until_due = (device.next_maintenance - current_time).days
        
        result_devices.append({
            "device_id": device.device_id,
            "device_key": device.device_key,
            "device_name": device.device_name,
            "network": device.network,
            "category": device.category,
            "status": device.status,
            "is_active": device.is_active,
            "is_online": device.is_online,
            "next_maintenance": device.next_maintenance.isoformat(),
            "days_until_due": days_until_due,
            "site_name": reading.site_name if reading else None
        })
    
    return {
        "threshold_days": days,
        "count": len(result_devices),
        "devices": result_devices
    }


@router.get("/maintenance/overdue")
async def get_overdue_maintenance_devices(
    *,
    db: Session = Depends(get_db)
):
    current_time = datetime.now(timezone.utc)
    
    # Get devices with overdue maintenance
    devices = db.exec(
        select(Device)
        .where(
            (Device.next_maintenance != None) & 
            (Device.next_maintenance < current_time)
        )
        .order_by(Device.next_maintenance)
    ).all()
    
    device_keys = [device.device_key for device in devices]
    
    if not device_keys:
        return {
            "count": 0,
            "devices": []
        }
    
    # Batch query for latest readings to get site names
    reading_subquery = (
        select(
            DeviceReading.device_key,
            func.max(DeviceReading.created_at).label("max_created_at")
        )
        .where(DeviceReading.device_key.in_(device_keys))
        .group_by(DeviceReading.device_key)
        .subquery()
    )
    
    readings_query = (
        select(DeviceReading)
        .join(
            reading_subquery,
            and_(
                DeviceReading.device_key == reading_subquery.c.device_key,
                DeviceReading.created_at == reading_subquery.c.max_created_at
            )
        )
    )
    readings = db.exec(readings_query).all()
    reading_map = {reading.device_key: reading for reading in readings}
    
    result_devices = []
    for device in devices:
        reading = reading_map.get(device.device_key)
        days_overdue = (current_time - device.next_maintenance).days
        
        result_devices.append({
            "device_id": device.device_id,
            "device_key": device.device_key,
            "device_name": device.device_name,
            "network": device.network,
            "category": device.category,
            "status": device.status,
            "is_active": device.is_active,
            "is_online": device.is_online,
            "next_maintenance": device.next_maintenance.isoformat(),
            "days_overdue": days_overdue,
            "site_name": reading.site_name if reading else None
        })
    
    return {
        "count": len(result_devices),
        "devices": result_devices
    }


@router.get("/reliability/metrics")
async def get_reliability_metrics(
    *,
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365, description="Days to analyze"),
    top_n: int = Query(10, ge=1, le=50, description="Number of devices with longest downtime to return")
):
    """
    Get device reliability metrics including average uptime, downtime, MTBF, and devices with longest downtime
    """
    current_time = datetime.now(timezone.utc)
    start_time = current_time - timedelta(days=days)
    
    # Get all devices
    devices = db.exec(select(Device)).all()
    
    if not devices:
        return {
            "period": {"days": days, "start": start_time.isoformat(), "end": current_time.isoformat()},
            "metrics": {
                "average_uptime_percentage": 0,
                "average_downtime_hours": 0,
                "mtbf_hours": 0,
                "total_devices": 0
            },
            "devices_with_longest_downtime": []
        }
    
    device_metrics = []
    total_uptime_percentage = 0
    total_downtime_hours = 0
    total_failures = 0
    
    for device in devices:
        # Get device status history from DeviceStatus table
        from app.models import DeviceStatus
        
        status_history = db.exec(
            select(DeviceStatus)
            .where(DeviceStatus.device_key == device.device_key)
            .where(DeviceStatus.timestamp >= start_time)
            .where(DeviceStatus.timestamp <= current_time)
            .order_by(DeviceStatus.timestamp)
        ).all()
        
        if not status_history:
            # If no status history, check last_updated to estimate downtime
            if device.last_updated and device.last_updated < start_time:
                # Device has been offline since before the analysis period
                downtime_hours = (current_time - start_time).total_seconds() / 3600
                uptime_percentage = 0
            elif device.is_online:
                # Currently online, assume full uptime
                downtime_hours = 0
                uptime_percentage = 100
            else:
                # Currently offline, calculate based on last_updated
                if device.last_updated:
                    downtime_start = max(device.last_updated, start_time)
                    downtime_hours = (current_time - downtime_start).total_seconds() / 3600
                    uptime_percentage = max(0, 100 - (downtime_hours / (days * 24) * 100))
                else:
                    downtime_hours = days * 24
                    uptime_percentage = 0
        else:
            # Calculate from status history
            online_time = 0
            offline_time = 0
            failures = 0
            last_status = None
            
            for i, status in enumerate(status_history):
                if last_status is not None:
                    time_diff = (status.timestamp - last_status.timestamp).total_seconds()
                    if last_status.is_online:
                        online_time += time_diff
                    else:
                        offline_time += time_diff
                    
                    # Count transitions from online to offline as failures
                    if last_status.is_online and not status.is_online:
                        failures += 1
                
                last_status = status
            
            # Handle time from last status to current time
            if last_status:
                time_diff = (current_time - last_status.timestamp).total_seconds()
                if last_status.is_online:
                    online_time += time_diff
                else:
                    offline_time += time_diff
            
            total_time = online_time + offline_time
            uptime_percentage = (online_time / total_time * 100) if total_time > 0 else 0
            downtime_hours = offline_time / 3600
            total_failures += failures
        
        device_metrics.append({
            "device_id": device.device_id,
            "device_name": device.device_name,
            "device_key": device.device_key,
            "network": device.network,
            "site_id": device.site_id,
            "status": device.status,
            "is_online": device.is_online,
            "uptime_percentage": round(uptime_percentage, 2),
            "downtime_hours": round(downtime_hours, 2),
            "last_seen": device.last_updated.isoformat() if device.last_updated else None
        })
        
        total_uptime_percentage += uptime_percentage
        total_downtime_hours += downtime_hours
    
    # Calculate averages
    num_devices = len(devices)
    average_uptime = total_uptime_percentage / num_devices if num_devices > 0 else 0
    average_downtime = total_downtime_hours / num_devices if num_devices > 0 else 0
    
    # Calculate MTBF (Mean Time Between Failures)
    # MTBF = Total Operating Time / Number of Failures
    total_operating_hours = days * 24 * num_devices
    mtbf = total_operating_hours / total_failures if total_failures > 0 else total_operating_hours
    
    # Sort devices by downtime (longest first)
    device_metrics.sort(key=lambda x: x["downtime_hours"], reverse=True)
    
    # Get site names for top devices with longest downtime
    top_devices = device_metrics[:top_n]
    for device_data in top_devices:
        if device_data["site_id"]:
            from app.models import Site
            site = db.exec(
                select(Site).where(Site.site_id == device_data["site_id"])
            ).first()
            if site:
                device_data["site_name"] = site.site_name
                device_data["district"] = site.district
                device_data["city"] = site.city
            else:
                device_data["site_name"] = None
                device_data["district"] = None
                device_data["city"] = None
        else:
            device_data["site_name"] = None
            device_data["district"] = None
            device_data["city"] = None
    
    return {
        "period": {
            "days": days,
            "start": start_time.isoformat(),
            "end": current_time.isoformat()
        },
        "metrics": {
            "average_uptime_percentage": round(average_uptime, 2),
            "average_downtime_hours": round(average_downtime, 2),
            "mtbf_hours": round(mtbf, 2),
            "total_devices": num_devices,
            "total_failures": total_failures
        },
        "devices_with_longest_downtime": top_devices,
        "timestamp": current_time.isoformat()
    }


# =============================================================================
# PARAMETERIZED ROUTES - These must come AFTER all static path routes
# to avoid path conflicts (e.g., /{device_id} would capture /offline/list)
# =============================================================================

@router.get("/{device_id}")
async def get_device(
    *,
    db: Session = Depends(get_db),
    device_id: str,
    background_tasks: BackgroundTasks
):
    from app.models.field_value import FieldValues
    
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    # Check if device has null keys and trigger background update for ALL devices with null keys
    if device.read_key is None or device.write_key is None or device.channel_id is None:
        background_tasks.add_task(update_all_null_device_keys_background)
    
    # Get location from dim_location
    location = db.exec(
        select(Location)
        .where(Location.device_key == device.device_key)
        .where(Location.is_active.is_(True))
        .order_by(Location.recorded_at.desc())
        .limit(1)
    ).first()
    
    # Get recent reading from fact_device_readings
    recent_reading = db.exec(
        select(DeviceReading)
        .where(DeviceReading.device_key == device.device_key)
        .order_by(DeviceReading.created_at.desc())
        .limit(1)
    ).first()
    
    # Get last 50 field data entries
    field_data_entries = db.exec(
        select(FieldValues)
        .where(FieldValues.device_id == device_id)
        .order_by(FieldValues.created_at.desc())
        .limit(50)
    ).all()
    
    # Format field data entries
    field_data = []
    for entry in field_data_entries:
        field_data.append({
            "id": str(entry.id),  # UUID
            "entry_id": entry.entry_id,  # Sequential integer ID
            "timestamp": entry.created_at.isoformat() if entry.created_at else None,
            "field1": entry.field1,
            "field2": entry.field2,
            "field3": entry.field3,
            "field4": entry.field4,
            "field5": entry.field5,
            "field6": entry.field6,
            "field7": entry.field7,
            "field8": entry.field8,
            "field9": entry.field9,
            "field10": entry.field10,
            "field11": entry.field11,
            "field12": entry.field12,
            "field13": entry.field13,
            "field14": entry.field14,
            "field15": entry.field15
        })
    
    # Build response with all device data plus location, recent reading, and field data
    device_data = {
        "device_key": device.device_key,
        "device_id": device.device_id,
        "device_name": device.device_name,
        "network": device.network,
        "category": device.category,
        "is_active": device.is_active,
        "status": device.status,
        "is_online": device.is_online,
        "mount_type": device.mount_type,
        "power_type": device.power_type,
        "height": device.height,
        "next_maintenance": device.next_maintenance.isoformat() if device.next_maintenance else None,
        "first_seen": device.first_seen.isoformat() if device.first_seen else None,
        "last_updated": device.last_updated.isoformat() if device.last_updated else None,
        "created_at": device.created_at.isoformat() if device.created_at else None,
        "updated_at": device.updated_at.isoformat() if device.updated_at else None,
        # New fields added
        "read_key": device.read_key,
        "write_key": device.write_key,
        "channel_id": device.channel_id,
        "network_id": device.network_id,
        "current_firmware": device.current_firmware,
        "previous_firmware": device.previous_firmware,
        "target_firmware": device.target_firmware,
        "location": {
            "latitude": location.latitude,
            "longitude": location.longitude,
        } if location else None,
        "recent_reading": {
            "site_name": recent_reading.site_name,
            "temperature": recent_reading.temperature,
            "humidity": recent_reading.humidity,
            "pm2_5": recent_reading.pm2_5,
            "pm10": recent_reading.pm10,
            "timestamp": recent_reading.created_at.isoformat() if recent_reading.created_at else None
        } if recent_reading else None,
        "field_data": field_data
    }
    
    return device_data


@router.patch("/{device_id}/details", response_model=DeviceRead)
async def update_device_firmware(
    *,
    db: Session = Depends(get_db),
    device_id: str,
    firmware_update: DeviceFirmwareUpdate
):
    """
    Update device firmware versions and network_id only.
    
    This endpoint allows updating only firmware-related fields:
    - network_id: Network identifier for the device
    - current_firmware: Current firmware version
    - previous_firmware: Previous firmware version  
    - target_firmware: Target firmware version for updates
    
    All fields are optional - only provided fields will be updated.
    """
    logger.info(f"Attempting to update firmware for device_id: {device_id}")
    
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        logger.warning(f"Device not found with device_id: {device_id}")
        raise HTTPException(
            status_code=404, 
            detail=f"Device not found with device_id: {device_id}"
        )
    
    logger.info(f"Found device: {device.device_name} (key: {device.device_key})")
    
    # Convert Pydantic model to dict and filter out None values
    firmware_data = firmware_update.model_dump(exclude_unset=True, exclude_none=True)
    
    if not firmware_data:
        raise HTTPException(status_code=400, detail="No valid firmware fields provided for update")
    
    logger.info(f"Updating firmware data: {firmware_data}")
    
    try:
        updated_device = device_crud.update_firmware(db, device_id=device_id, firmware_data=firmware_data)
        
        if not updated_device:
            raise HTTPException(status_code=404, detail="Device not found during update")
        
        logger.info(f"Successfully updated device firmware for {device_id}")
        return updated_device
        
    except ValueError as e:
        # Handle firmware not found errors
        logger.error(f"Firmware validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # Handle any other database/integrity errors
        logger.error(f"Database error updating firmware: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to update device firmware")


@router.get("/{device_id}/performance")
async def get_device_performance(
    *,
    db: Session = Depends(get_db),
    device_id: str,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze")
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    readings_query = select(DeviceReading).where(
        DeviceReading.device_key == device.device_key,
        DeviceReading.created_at >= start_date,
        DeviceReading.created_at <= end_date
    )
    readings = db.exec(readings_query).all()
    total_hours = days * 24
    expected_readings = total_hours * 2
    actual_readings = len(readings)
    uptime_percentage = (actual_readings / expected_readings * 100) if expected_readings > 0 else 0
    valid_readings = [r for r in readings if r.pm2_5 is not None or r.pm10 is not None]
    data_completeness = (len(valid_readings) / actual_readings * 100) if actual_readings > 0 else 0
    pm2_5_values = []
    pm10_values = []
    temp_values = []
    humidity_values = []
    
    for r in readings:
        if hasattr(r, 'pm2_5') and r.pm2_5 is not None:
            pm2_5_values.append(r.pm2_5)
        if hasattr(r, 'pm10') and r.pm10 is not None:
            pm10_values.append(r.pm10)
        if hasattr(r, 'temperature') and r.temperature is not None:
            temp_values.append(r.temperature)
        if hasattr(r, 'humidity') and r.humidity is not None:
            humidity_values.append(r.humidity)
    
    return {
        "device_id": device.device_id,
        "device_name": device.device_name,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "metrics": {
            "uptime_percentage": round(uptime_percentage, 2),
            "data_completeness": round(data_completeness, 2),
            "total_readings": actual_readings,
            "valid_readings": len(valid_readings),
            "error_readings": actual_readings - len(valid_readings)
        },
        "averages": {
            "pm2_5": round(sum(pm2_5_values) / len(pm2_5_values), 2) if pm2_5_values else None,
            "pm10": round(sum(pm10_values) / len(pm10_values), 2) if pm10_values else None,
            "temperature": round(sum(temp_values) / len(temp_values), 2) if temp_values else None,
            "humidity": round(sum(humidity_values) / len(humidity_values), 2) if humidity_values else None
        },
        "status": {
            "current_status": device.status,
            "is_active": device.is_active,
            "is_online": device.is_online,
            "last_updated": device.last_updated.isoformat() if device.last_updated else None
        }
    }


@router.get("/{device_id}/readings")
async def get_device_readings(
    *,
    db: Session = Depends(get_db),
    device_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    query = select(DeviceReading).where(DeviceReading.device_key == device.device_key)
    
    if start_date:
        query = query.where(DeviceReading.created_at >= start_date)
    if end_date:
        query = query.where(DeviceReading.created_at <= end_date)
    
    query = query.order_by(DeviceReading.created_at.desc()).limit(limit)
    
    readings = db.exec(query).all()
    
    return {
        "device_id": device_id,
        "device_name": device.device_name,
        "count": len(readings),
        "readings": readings
    }