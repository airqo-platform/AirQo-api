from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, select, func
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta, timezone
from app.deps import get_db
from app.models import Device, DeviceReading, Site
from app.configs.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_summary(
    *,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive dashboard summary with all key metrics
    """
    # Device metrics
    total_devices = db.exec(select(func.count(Device.device_key))).first() or 0
    active_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_active == True)
    ).first() or 0
    
    # Online/Offline based on is_online flag
    online_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online == True)
    ).first() or 0
    
    offline_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online == False)
    ).first() or 0
    
    # Site metrics
    total_sites = db.exec(select(func.count(Site.site_key))).first() or 0
    # All sites in dim_site are considered active
    active_sites = total_sites
    
    # Recent data (last hour)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= one_hour_ago
        )
    ).first() or 0
    
    # Today's data
    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= today_start
        )
    ).first() or 0
    
    # Data quality (last 24 hours) - checking if PM2.5 values exist
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    total_24h_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= yesterday
        )
    ).first() or 0
    
    valid_24h_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= yesterday,
            (DeviceReading.pm2_5.is_not(None)) | (DeviceReading.pm10.is_not(None))
        )
    ).first() or 0
    
    # Devices needing maintenance
    maintenance_soon = db.exec(
        select(func.count(Device.device_key)).where(
            (Device.next_maintenance != None) & 
            (Device.next_maintenance <= datetime.now(timezone.utc) + timedelta(days=30))
        )
    ).first() or 0
    
    # Network distribution
    networks = db.exec(
        select(Device.network, func.count(Device.device_key))
        .where(Device.network.is_not(None))
        .group_by(Device.network)
    ).all()
    
    # Regional distribution
    regions = db.exec(
        select(Site.city, func.count(Site.site_key))
        .where(Site.city.is_not(None))
        .group_by(Site.city)
    ).all()
    
    return {
        "devices": {
            "total": total_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices,
            "online": online_devices,
            "offline": offline_devices,
            "maintenance_soon": maintenance_soon
        },
        "sites": {
            "total": total_sites,
            "active": active_sites,
            "inactive": total_sites - active_sites
        },
        "data": {
            "last_hour_readings": recent_readings,
            "today_readings": today_readings,
            "last_24h_readings": total_24h_readings,
            "data_quality_24h": round((valid_24h_readings / total_24h_readings * 100), 2) if total_24h_readings > 0 else 0
        },
        "network_distribution": {network: count for network, count in networks},
        "regional_distribution": {region: count for region, count in regions},
        "health_indicators": {
            "device_online_rate": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
            "device_active_rate": round((active_devices / total_devices * 100), 2) if total_devices > 0 else 0,
            "site_active_rate": round((active_sites / total_sites * 100), 2) if total_sites > 0 else 0,
            "maintenance_rate": round((maintenance_soon / total_devices * 100), 2) if total_devices > 0 else 0
        },
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }


@router.get("/summary")
async def get_system_summary(
    *,
    db: Session = Depends(get_db)
):
    """
    Get quick system summary
    """
    return {
        "devices": {
            "total": db.exec(select(func.count(Device.device_key))).first() or 0,
            "active": db.exec(select(func.count(Device.device_key)).where(Device.is_active == True)).first() or 0
        },
        "sites": {
            "total": db.exec(select(func.count(Site.site_key))).first() or 0,
            "active": db.exec(select(func.count(Site.site_key))).first() or 0  # All sites are active
        },
        "readings_today": db.exec(
            select(func.count(DeviceReading.reading_key)).where(
                DeviceReading.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            )
        ).first() or 0,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    }


@router.get("/data-transmission/summary")
async def get_data_transmission_summary(
    *,
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze")
):
    """
    Get data transmission analytics summary
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get total devices
    total_devices = db.exec(select(func.count(Device.device_key))).first()
    active_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_active == True)
    ).first()
    
    # Get total readings
    total_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= start_date,
            DeviceReading.created_at <= end_date
        )
    ).first()
    
    # Get valid readings (with PM2.5 data)
    valid_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= start_date,
            DeviceReading.created_at <= end_date,
            (DeviceReading.pm2_5.is_not(None)) | (DeviceReading.pm10.is_not(None))
        )
    ).first()
    
    invalid_readings = total_readings - valid_readings if total_readings else 0
    
    # Calculate transmission rate
    expected_readings = active_devices * days * 24 * 2  # Assuming readings every 30 minutes
    transmission_rate = (total_readings / expected_readings * 100) if expected_readings > 0 else 0
    
    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "devices": {
            "total": total_devices or 0,
            "active": active_devices or 0,
            "inactive": (total_devices - active_devices) if total_devices and active_devices else 0
        },
        "transmission": {
            "total_readings": total_readings or 0,
            "valid_readings": valid_readings or 0,
            "invalid_readings": invalid_readings,
            "data_quality": round((valid_readings / total_readings * 100), 2) if total_readings else 0,
            "transmission_rate": round(transmission_rate, 2),
            "average_daily_readings": round((total_readings / days), 2) if days > 0 else 0
        }
    }


@router.get("/data-transmission/hourly")
async def get_hourly_transmission(
    *,
    db: Session = Depends(get_db),
    date: Optional[datetime] = None
):
    """
    Get hourly data transmission statistics for a specific day
    """
    if not date:
        date = datetime.now(timezone.utc).date()
    else:
        date = date.date()
    
    start_time = datetime(
        year=date.year, month=date.month, day=date.day, tzinfo=timezone.utc
    )
    end_time = start_time + timedelta(days=1)
    
    hourly_stats = []
    
    for hour in range(24):
        hour_start = start_time + timedelta(hours=hour)
        hour_end = hour_start + timedelta(hours=1)
        
        readings_count = db.exec(
            select(func.count(DeviceReading.reading_key)).where(
                DeviceReading.created_at >= hour_start,
                DeviceReading.created_at < hour_end
            )
        ).first()
        
        hourly_stats.append({
            "hour": hour,
            "time": f"{hour:02d}:00",
            "readings": readings_count or 0
        })
    
    total_readings = sum(h["readings"] for h in hourly_stats)
    
    return {
        "date": date.isoformat(),
        "total_readings": total_readings,
        "hourly_distribution": hourly_stats,
        "peak_hour": max(hourly_stats, key=lambda x: x["readings"]) if hourly_stats else None,
        "average_per_hour": round(total_readings / 24, 2)
    }


@router.get("/network-performance")
async def get_network_performance(
    *,
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=30)
):
    """
    Get performance metrics grouped by network
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get unique networks
    networks = db.exec(select(Device.network).distinct().where(Device.network.is_not(None))).all()
    
    network_stats = []
    
    for network in networks:
        # Get devices in network
        devices = db.exec(select(Device).where(Device.network == network)).all()
        device_keys = [d.device_key for d in devices]
        
        if not device_keys:
            continue
        
        # Get readings for network
        readings_count = db.exec(
            select(func.count(DeviceReading.reading_key)).where(
                DeviceReading.device_key.in_(device_keys),
                DeviceReading.created_at >= start_date,
                DeviceReading.created_at <= end_date
            )
        ).first() or 0
        
        valid_readings = db.exec(
            select(func.count(DeviceReading.reading_key)).where(
                DeviceReading.device_key.in_(device_keys),
                DeviceReading.created_at >= start_date,
                DeviceReading.created_at <= end_date,
                (DeviceReading.pm2_5.is_not(None)) | (DeviceReading.pm10.is_not(None))
            )
        ).first() or 0
        
        active_devices = len([d for d in devices if d.is_active == True])
        
        network_stats.append({
            "network": network,
            "devices": {
                "total": len(devices),
                "active": active_devices
            },
            "readings": {
                "total": readings_count,
                "valid": valid_readings,
                "data_quality": round((valid_readings / readings_count * 100), 2) if readings_count else 0
            },
            "performance": {
                "average_readings_per_device": round(readings_count / active_devices, 2) if active_devices else 0
            }
        })
    
    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "networks": network_stats,
        "summary": {
            "total_networks": len(network_stats),
            "best_performing": max(network_stats, key=lambda x: x["readings"]["data_quality"]) if network_stats else None
        }
    }


@router.get("/regional-analysis")
async def get_regional_analysis(
    *,
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=30)
):
    """
    Get analysis grouped by region
    """
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get unique cities (dim_site uses city instead of region)
    cities = db.exec(select(Site.city).distinct().where(Site.city.is_not(None))).all()
    
    regional_stats = []
    
    for city in cities:
        # Get sites in city
        sites = db.exec(select(Site).where(Site.city == city)).all()
        site_ids = [s.site_id for s in sites]
        
        # Get devices in this city (now that Device has site_id)
        devices_in_city = db.exec(
            select(Device).where(Device.site_id.in_(site_ids))
        ).all() if site_ids else []
        
        # Get device keys for readings
        device_keys = [d.device_key for d in devices_in_city]
        
        # Get readings for these devices
        readings_count = db.exec(
            select(func.count(DeviceReading.reading_key))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.created_at >= start_date)
            .where(DeviceReading.created_at <= end_date)
        ).first() if device_keys else 0
        
        # Calculate average PM values
        avg_pm25 = db.exec(
            select(func.avg(DeviceReading.s1_pm2_5))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.created_at >= start_date)
            .where(DeviceReading.created_at <= end_date)
            .where(DeviceReading.s1_pm2_5.is_not(None))
        ).first() if device_keys else None
        
        regional_stats.append({
            "city": city,
            "sites": len(sites),
            "devices": len(devices_in_city),
            "readings_count": readings_count or 0,
            "avg_pm2_5": round(avg_pm25, 2) if avg_pm25 else None
        })
    
    return {
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat(),
            "days": days
        },
        "regions": regional_stats,
        "summary": {
            "total_regions": len(regional_stats),
            "most_devices": max(regional_stats, key=lambda x: x["devices"]) if regional_stats else None,
            "most_data": max(regional_stats, key=lambda x: x["readings_count"]) if regional_stats else None
        }
    }


@router.get("/system-health")
async def get_system_health(
    *,
    db: Session = Depends(get_db)
):
    """
    Get overall system health metrics
    """
    # Device statistics
    total_devices = db.exec(select(func.count(Device.device_key))).first()
    active_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_active == True)
    ).first()
    
    # Offline devices
    offline_devices = db.exec(
        select(func.count(Device.device_key)).where(Device.is_online == False)
    ).first()
    
    # Site statistics
    total_sites = db.exec(select(func.count(Site.site_key))).first()
    active_sites = total_sites  # All sites in dim_site are active
    
    # Recent data statistics (last hour)
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    recent_readings = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= one_hour_ago
        )
    ).first()
    
    # Data quality (last 24 hours)
    one_day_ago = datetime.now(timezone.utc) - timedelta(days=1)
    daily_total = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= one_day_ago
        )
    ).first()
    
    daily_valid = db.exec(
        select(func.count(DeviceReading.reading_key)).where(
            DeviceReading.created_at >= one_day_ago,
            (DeviceReading.pm2_5.is_not(None)) | (DeviceReading.pm10.is_not(None))
        )
    ).first()
    
    health_score = 100
    issues = []
    
    # Calculate health score based on various factors
    if offline_devices and total_devices:
        offline_percentage = (offline_devices / total_devices) * 100
        if offline_percentage > 20:
            health_score -= 30
            issues.append(f"{offline_devices} devices offline")
        elif offline_percentage > 10:
            health_score -= 15
            issues.append(f"{offline_devices} devices offline")
    
    if daily_total and daily_valid:
        data_quality = (daily_valid / daily_total) * 100
        if data_quality < 80:
            health_score -= 20
            issues.append(f"Data quality at {round(data_quality, 1)}%")
    
    if recent_readings and recent_readings < 10:
        health_score -= 10
        issues.append("Low data transmission rate")
    
    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "health_score": max(0, health_score),
        "status": "healthy" if health_score >= 80 else "degraded" if health_score >= 60 else "unhealthy",
        "issues": issues,
        "statistics": {
            "devices": {
                "total": total_devices or 0,
                "active": active_devices or 0,
                "offline": offline_devices or 0
            },
            "sites": {
                "total": total_sites or 0,
                "active": active_sites or 0
            },
            "data": {
                "last_hour_readings": recent_readings or 0,
                "last_24h_readings": daily_total or 0,
                "data_quality_24h": round((daily_valid / daily_total * 100), 2) if daily_total else 0
            }
        }
    }