from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.deps import get_db, CommonQueryParams
from app.models import Device, DeviceRead, DeviceCreate, DeviceUpdate, DeviceReading
from app.crud import device as device_crud
from app.configs.settings import settings
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
        select(func.count(Device.device_key)).where(Device.is_active == True)
    ).first() or 0
    online_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online == True)
    ).first() or 0
    offline_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online == False)
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
        maintenance_cutoff = datetime.utcnow() + timedelta(days=30)
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
    
    result["timestamp"] = datetime.utcnow().isoformat()
    return result




@router.get("/", response_model=List[DeviceRead])
async def get_devices(
    *,
    db: Session = Depends(get_db),
    common: CommonQueryParams = Depends(),
    site_id: Optional[str] = None,
    network: Optional[str] = None,
    status: Optional[str] = None
):
    query = select(Device)
    
    if site_id:
        query = query.where(Device.site_id == site_id)
    if network:
        query = query.where(Device.network == network)
    if status:
        query = query.where(Device.status == status)
    
    query = query.offset(common.skip).limit(common.limit)
    
    devices = db.exec(query).all()
    return devices


@router.get("/{device_id}", response_model=DeviceRead)
async def get_device(
    *,
    db: Session = Depends(get_db),
    device_id: str
):
    device = device_crud.get_by_device_id(db, device_id=device_id)
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


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
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    readings_query = select(DeviceReading).where(
        DeviceReading.device_key == device.device_key,
        DeviceReading.timestamp >= start_date,
        DeviceReading.timestamp <= end_date
    )
    readings = db.exec(readings_query).all()
    total_hours = days * 24
    expected_readings = total_hours * 2
    actual_readings = len(readings)
    uptime_percentage = (actual_readings / expected_readings * 100) if expected_readings > 0 else 0
    valid_readings = [r for r in readings if r.s1_pm2_5 is not None or r.s2_pm2_5 is not None]
    data_completeness = (len(valid_readings) / actual_readings * 100) if actual_readings > 0 else 0
    pm2_5_values = []
    pm10_values = []
    temp_values = []
    humidity_values = []
    
    for r in readings:
        if hasattr(r, 's1_pm2_5') and r.s1_pm2_5 is not None:
            pm2_5_values.append(r.s1_pm2_5)
        if hasattr(r, 's2_pm2_5') and r.s2_pm2_5 is not None:
            pm2_5_values.append(r.s2_pm2_5)
        if hasattr(r, 's1_pm10') and r.s1_pm10 is not None:
            pm10_values.append(r.s1_pm10)
        if hasattr(r, 's2_pm10') and r.s2_pm10 is not None:
            pm10_values.append(r.s2_pm10)
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
        query = query.where(DeviceReading.timestamp >= start_date)
    if end_date:
        query = query.where(DeviceReading.timestamp <= end_date)
    
    query = query.order_by(DeviceReading.timestamp.desc()).limit(limit)
    
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