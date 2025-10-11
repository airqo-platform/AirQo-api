from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, and_
from typing import Optional
from datetime import datetime, timedelta, timezone
from app.deps import get_db
from app.models import Device, DeviceRead, DeviceCreate, DeviceUpdate, DeviceReading, Site
from app.models.location import Location
from app.crud import device as device_crud
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/stats")
async def get_comprehensive_device_stats(
    *,
    db: Session = Depends(get_db),
    include_networks: bool = Query(True, description="Include network breakdown"),
    include_categories: bool = Query(True, description="Include category breakdown"),
    include_maintenance: bool = Query(True, description="Include maintenance info")
):
    total_devices = db.exec(select(func.count(Device.device_key))).first() or 0
    active_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_active.is_(True))
    ).first() or 0
    online_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online.is_(True))
    ).first() or 0
    offline_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online.is_(False))
    ).first() or 0
    deployed = db.exec(
        select(func.count(Device.device_key)).where(Device.status == "deployed")
    ).first() or 0
    not_deployed = db.exec(
        select(func.count(Device.device_key)).where(
            (Device.status != "deployed") | (Device.status == None)
        )
    ).first() or 0
    recalled = db.exec(
        select(func.count(Device.device_key)).where(Device.status == "recalled")
    ).first() or 0
    statuses = db.exec(
        select(Device.status, func.count(Device.device_key))
        .group_by(Device.status)
    ).all()
    
    result = {
        "summary": {
            "total": total_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices,
            "online": online_devices,
            "offline": offline_devices
        },
        "deployment": {
            "deployed": deployed,
            "not_deployed": not_deployed,
            "recalled": recalled
        },
        "status_breakdown": {status or "unknown": count for status, count in statuses},
        "percentages": {
            "active_rate": round((active_devices / total_devices * 100), 2) if total_devices > 0 else 0,
            "online_rate": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
            "deployment_rate": round((deployed / total_devices * 100), 2) if total_devices > 0 else 0
        }
    }
    if include_networks:
        networks = db.exec(
            select(Device.network, func.count(Device.device_key))
            .group_by(Device.network)
        ).all()
        result["networks"] = {network or "unknown": count for network, count in networks}
    if include_categories:
        categories = db.exec(
            select(Device.category, func.count(Device.device_key))
            .group_by(Device.category)
        ).all()
        result["categories"] = {category or "unknown": count for category, count in categories}
    if include_maintenance:
        maintenance_cutoff = datetime.now(timezone.utc) + timedelta(days=30)
        upcoming_maintenance = db.exec(
            select(func.count(Device.device_key)).where(
                (Device.next_maintenance != None) & 
                (Device.next_maintenance <= maintenance_cutoff)
            )
        ).first() or 0
        result["maintenance"] = {
            "upcoming_30_days": upcoming_maintenance,
            "percentage": round((upcoming_maintenance / total_devices * 100), 2) if total_devices > 0 else 0
        }
    
    result["timestamp"] = datetime.now(timezone.utc).isoformat()
    return result




@router.get("/")
async def get_devices(
    *,
    db: Session = Depends(get_db),
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: Optional[int] = Query(100, ge=1, le=10000, description="Number of items to return"),
    network: Optional[str] = None,
    status: Optional[str] = None
):
    # Build query using SQLModel
    query = select(Device)
    
    # Apply filters
    if network:
        query = query.where(Device.network == network)
    if status:
        query = query.where(Device.status == status)
    
    # Apply ordering
    query = query.order_by(Device.device_name)
    
    # Apply pagination
    query = query.offset(skip)
    if limit:
        query = query.limit(limit)
    
    # Execute query
    devices = db.exec(query).all()
    
    if not devices:
        return []
    
    # Collect all device keys and site_ids for batch queries
    device_keys = [device.device_key for device in devices]
    site_ids = list(set([device.site_id for device in devices if device.site_id]))  # Use set to remove duplicates
    
    # Initialize empty maps
    site_map = {}
    location_map = {}
    reading_map = {}
    
    # Only query if we have data to query for
    if site_ids:
        # Batch query for site information from dim_site
        sites = db.exec(
            select(Site).where(Site.site_id.in_(site_ids))
        ).all()
        site_map = {site.site_id: site for site in sites}
    
    # Batch query for latest locations (kept for backwards compatibility if needed)
    location_subquery = (
        select(
            Location.device_key,
            func.max(Location.recorded_at).label("max_recorded_at")
        )
        .where(Location.device_key.in_(device_keys))
        .where(Location.is_active.is_(True))
        .group_by(Location.device_key)
        .subquery()
    )
    
    locations_query = (
        select(Location)
        .join(
            location_subquery,
            and_(
                Location.device_key == location_subquery.c.device_key,
                Location.recorded_at == location_subquery.c.max_recorded_at,
                Location.is_active.is_(True)
            )
        )
    )
    locations = db.exec(locations_query).all()
    location_map = {loc.device_key: loc for loc in locations}
    
    # Batch query for latest readings
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
    
    # Format response
    device_list = []
    for device in devices:
        site = site_map.get(device.site_id) if device.site_id else None
        location = location_map.get(device.device_key)
        latest_reading = reading_map.get(device.device_key)
        
        device_data = {
            "device_key": device.device_key,
            "device_id": device.device_id,
            "device_name": device.device_name,
            "site_id": device.site_id,
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
            "site_location": {
                "site_name": site.site_name,
                "city": site.city,
                "district": site.district,
                "country": site.country,
                "latitude": site.latitude,
                "longitude": site.longitude,
                "site_category": site.site_category
            } if site else None,
            "location": {
                "latitude": location.latitude,
                "longitude": location.longitude,
                "site_name": location.site_name
            } if location else None,
            "latest_reading": {
                "pm2_5": latest_reading.pm2_5,
                "pm10": latest_reading.pm10,
                "temperature": latest_reading.temperature,
                "humidity": latest_reading.humidity,
                "timestamp": latest_reading.created_at.isoformat() if latest_reading.created_at else None
            } if latest_reading else None
        }
        device_list.append(device_data)
    
    return device_list


@router.get("/map-data")
async def get_map_data(
    *,
    db: Session = Depends(get_db)
):
    # Get deployed devices
    devices = db.exec(
        select(Device)
        .where(Device.status == 'deployed')
        .order_by(Device.device_name)
    ).all()
    
    result = []
    for device in devices:
        # Get active location
        location = db.exec(
            select(Location)
            .where(Location.device_key == device.device_key)
            .where(Location.is_active.is_(True))
            .order_by(Location.recorded_at.desc())
            .limit(1)
        ).first()
        
        if not location:
            continue
        
        # Get latest reading
        latest_reading = db.exec(
            select(DeviceReading)
            .where(DeviceReading.device_key == device.device_key)
            .order_by(DeviceReading.created_at.desc())
            .limit(1)
        ).first()
        
        result.append({
            "device_name": device.device_name,
            "is_online": device.is_online,
            "latitude": location.latitude,
            "longitude": location.longitude,
            "site_name": location.site_name if location else None,
            "recent_reading": {
                "timestamp": latest_reading.created_at.isoformat() if latest_reading and latest_reading.created_at else None,
                "pm2_5": latest_reading.pm2_5 if latest_reading else None,
                "pm10": latest_reading.pm10 if latest_reading else None
            } if latest_reading else None
        })
    
    return result


@router.get("/{device_id}")
async def get_device(
    *,
    db: Session = Depends(get_db),
    device_id: str
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
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
    
    # Build response with all device data plus location and recent reading
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
        } if recent_reading else None
    }
    
    return device_data


@router.post("/", response_model=DeviceRead)
async def create_device(
    *,
    db: Session = Depends(get_db),
    device_in: DeviceCreate
):
    existing = device_crud.get_by_name(db, device_name=device_in.device_name)
    if existing:
        raise HTTPException(status_code=400, detail="Device name already exists")
    
    device = device_crud.create(db, obj_in=device_in)
    return device


@router.patch("/{device_id}", response_model=DeviceRead)
async def update_device(
    *,
    db: Session = Depends(get_db),
    device_id: str,
    device_in: DeviceUpdate
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device = device_crud.update(db, db_obj=device, obj_in=device_in)
    return device


@router.delete("/{device_id}")
async def delete_device(
    *,
    db: Session = Depends(get_db),
    device_id: str
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    device_crud.remove(db, id=device.device_key)
    return {"message": "Device deleted successfully"}


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