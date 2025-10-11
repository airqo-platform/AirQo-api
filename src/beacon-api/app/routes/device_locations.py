from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func, and_, or_
from sqlalchemy import Integer
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from app.deps import get_db, CommonQueryParams
from app.models import Device, DeviceRead, Site, DeviceReading, DeviceStatus
from app.models.location import Location
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def calculate_completeness(expected_entries: int, actual_entries: int) -> Dict[str, float]:
    """
    Calculate data completeness percentages
    - Optimal: >= 90%
    - Good: >= 75% and < 90%
    - Fair: >= 50% and < 75%
    - Poor: < 50%
    """
    if expected_entries == 0:
        return {
            "percentage": 0,
            "optimal": 0,
            "good": 0,
            "fair": 0,
            "poor": 100
        }
    
    percentage = (actual_entries / expected_entries) * 100
    
    return {
        "percentage": round(percentage, 2),
        "optimal": 100 if percentage >= 90 else 0,
        "good": 100 if 75 <= percentage < 90 else 0,
        "fair": 100 if 50 <= percentage < 75 else 0,
        "poor": 100 if percentage < 50 else 0
    }


@router.get("/devices/by-location", response_model=List[DeviceRead])
async def get_devices_by_location(
    *,
    db: Session = Depends(get_db),
    common: CommonQueryParams = Depends(),
    district: Optional[str] = Query(None, description="Filter by district"),
    city: Optional[str] = Query(None, description="Filter by city"),
    country: Optional[str] = Query(None, description="Filter by country"),
    site_name: Optional[str] = Query(None, description="Filter by site name"),
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    include_offline: bool = Query(True, description="Include offline devices")
):
    """
    Get devices filtered by location parameters with full device details
    """
    # Start with base query
    query = select(Device)
    
    # Join with Site if we need to filter by site properties
    if district or city or country or site_name:
        query = query.join(Site, Device.site_id == Site.site_id)
        
        if district:
            query = query.where(Site.district == district)
        if city:
            query = query.where(Site.city == city)
        if country:
            query = query.where(Site.country == country)
        if site_name:
            query = query.where(Site.site_name == site_name)
    
    # Direct site_id filter
    if site_id:
        query = query.where(Device.site_id == site_id)
    
    # Filter by online status
    if not include_offline:
        query = query.where(Device.is_online == True)
    
    # Apply pagination
    query = query.offset(common.skip).limit(common.limit)
    
    devices = db.exec(query).all()
    
    # Enrich with site information
    result = []
    for device in devices:
        device_dict = device.dict()
        
        # Get site information
        if device.site_id:
            site = db.exec(
                select(Site).where(Site.site_id == device.site_id)
            ).first()
            if site:
                device_dict["site_info"] = {
                    "site_name": site.site_name,
                    "district": site.district,
                    "city": site.city,
                    "country": site.country,
                    "latitude": site.latitude,
                    "longitude": site.longitude
                }
        
        result.append(DeviceRead(**device_dict))
    
    return result


@router.get("/devices/summary/by-location")
async def get_device_summary_by_location(
    *,
    db: Session = Depends(get_db),
    district: Optional[str] = Query(None, description="Filter by district"),
    city: Optional[str] = Query(None, description="Filter by city"),
    country: Optional[str] = Query(None, description="Filter by country"),
    site_name: Optional[str] = Query(None, description="Filter by site name"),
    site_id: Optional[str] = Query(None, description="Filter by site ID"),
    hours: int = Query(24, description="Hours to look back for metrics")
):
    """
    Get comprehensive device summary statistics filtered by location
    """
    # Build base query for devices
    device_query = select(Device)
    
    # Join with Site if we need to filter by site properties
    if district or city or country or site_name:
        device_query = device_query.join(Site, Device.site_id == Site.site_id)
        
        if district:
            device_query = device_query.where(Site.district == district)
        if city:
            device_query = device_query.where(Site.city == city)
        if country:
            device_query = device_query.where(Site.country == country)
        if site_name:
            device_query = device_query.where(Site.site_name == site_name)
    
    if site_id:
        device_query = device_query.where(Device.site_id == site_id)
    
    # Get all matching devices
    devices = db.exec(device_query).all()
    device_keys = [d.device_key for d in devices]
    
    # Calculate time window
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    # Basic counts
    total_devices = len(devices)
    online_devices = sum(1 for d in devices if d.is_online)
    offline_devices = total_devices - online_devices
    active_devices = sum(1 for d in devices if d.is_active)
    
    # Initialize metrics
    uptime_percentage = 0
    avg_sensor_errors = 0
    hourly_entries = {}
    completeness_stats = {
        "optimal": 0,
        "good": 0,
        "fair": 0,
        "poor": 0
    }
    
    if device_keys:
        # Calculate uptime (percentage of time devices were online in the period)
        status_records = db.exec(
            select(
                DeviceStatus.device_key,
                func.count(DeviceStatus.status_key).label('total_checks'),
                func.sum(func.cast(DeviceStatus.is_online, Integer)).label('online_checks')
            )
            .where(DeviceStatus.device_key.in_(device_keys))
            .where(DeviceStatus.timestamp >= start_time)
            .where(DeviceStatus.timestamp <= end_time)
            .group_by(DeviceStatus.device_key)
        ).all()
        
        if status_records:
            total_uptime = sum(r.online_checks / r.total_checks * 100 for r in status_records if r.total_checks > 0)
            uptime_percentage = round(total_uptime / len(status_records), 2) if status_records else 0
        
        # Calculate sensor errors (readings with null PM values)
        sensor_error_count = db.exec(
            select(
                func.count(DeviceReading.reading_key).label('total'),
                func.sum(
                    func.cast(
                        or_(
                            DeviceReading.s1_pm2_5.is_(None),
                            DeviceReading.s2_pm2_5.is_(None)
                        ), 
                        Integer
                    )
                ).label('errors')
            )
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
        ).first()
        
        if sensor_error_count and sensor_error_count.total > 0:
            avg_sensor_errors = round((sensor_error_count.errors / sensor_error_count.total) * 100, 2)
        
        # Calculate hourly entries and completeness
        expected_entries_per_hour = 60  # Assuming 1-minute frequency
        expected_total = expected_entries_per_hour * hours * total_devices
        
        # Get hourly data
        hourly_data = db.exec(
            select(
                func.date_trunc('hour', DeviceReading.timestamp).label('hour'),
                func.count(func.distinct(DeviceReading.device_key)).label('reporting_devices'),
                func.count(DeviceReading.reading_key).label('entries')
            )
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
            .group_by(func.date_trunc('hour', DeviceReading.timestamp))
            .order_by(func.date_trunc('hour', DeviceReading.timestamp))
        ).all()
        
        # Process hourly data
        total_entries = 0
        for hour_data in hourly_data:
            hour_str = hour_data.hour.strftime('%Y-%m-%d %H:00')
            hourly_entries[hour_str] = {
                "devices_reporting": hour_data.reporting_devices,
                "entries": hour_data.entries,
                "expected": expected_entries_per_hour * total_devices,
                "completeness": round((hour_data.entries / (expected_entries_per_hour * total_devices)) * 100, 2) if total_devices > 0 else 0
            }
            total_entries += hour_data.entries
        
        # Calculate overall completeness
        if expected_total > 0:
            overall_completeness = (total_entries / expected_total) * 100
            
            # Categorize completeness for each device
            for device in devices:
                device_entries = db.exec(
                    select(func.count(DeviceReading.reading_key))
                    .where(DeviceReading.device_key == device.device_key)
                    .where(DeviceReading.timestamp >= start_time)
                    .where(DeviceReading.timestamp <= end_time)
                ).first() or 0
                
                device_expected = expected_entries_per_hour * hours
                device_completeness = calculate_completeness(device_expected, device_entries)
                
                if device_completeness["optimal"] > 0:
                    completeness_stats["optimal"] += 1
                elif device_completeness["good"] > 0:
                    completeness_stats["good"] += 1
                elif device_completeness["fair"] > 0:
                    completeness_stats["fair"] += 1
                else:
                    completeness_stats["poor"] += 1
            
            # Convert to percentages
            if total_devices > 0:
                for key in completeness_stats:
                    completeness_stats[key] = round((completeness_stats[key] / total_devices) * 100, 2)
    
    # Build location filter info
    location_filter = {}
    if district:
        location_filter["district"] = district
    if city:
        location_filter["city"] = city
    if country:
        location_filter["country"] = country
    if site_name:
        location_filter["site_name"] = site_name
    if site_id:
        location_filter["site_id"] = site_id
    
    return {
        "location_filter": location_filter,
        "time_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "device_counts": {
            "total": total_devices,
            "online": online_devices,
            "offline": offline_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices
        },
        "performance_metrics": {
            "uptime_percentage": uptime_percentage,
            "avg_sensor_error_rate": avg_sensor_errors,
            "total_readings": total_entries if device_keys else 0,
            "expected_readings": expected_total if device_keys else 0
        },
        "completeness_percentages": completeness_stats,
        "average_hourly_entries": round(total_entries / hours, 2) if hours > 0 and device_keys else 0,
        "hourly_breakdown": hourly_entries,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/sites/{site_id}/devices/detailed")
async def get_site_devices_detailed(
    *,
    db: Session = Depends(get_db),
    site_id: str,
    include_metrics: bool = Query(True, description="Include performance metrics"),
    hours: int = Query(24, description="Hours for metrics calculation")
):
    """
    Get detailed device information for a specific site with optional metrics
    """
    # Verify site exists
    site = db.exec(select(Site).where(Site.site_id == site_id)).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Get all devices for this site
    devices = db.exec(
        select(Device).where(Device.site_id == site_id)
    ).all()
    
    if not include_metrics:
        return {
            "site": {
                "site_id": site.site_id,
                "site_name": site.site_name,
                "district": site.district,
                "city": site.city,
                "country": site.country
            },
            "device_count": len(devices),
            "devices": [device.dict() for device in devices]
        }
    
    # Calculate metrics for each device
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    devices_with_metrics = []
    
    for device in devices:
        device_dict = device.dict()
        
        # Get recent readings count
        reading_count = db.exec(
            select(func.count(DeviceReading.reading_key))
            .where(DeviceReading.device_key == device.device_key)
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
        ).first() or 0
        
        # Get latest reading
        latest_reading = db.exec(
            select(DeviceReading)
            .where(DeviceReading.device_key == device.device_key)
            .order_by(DeviceReading.timestamp.desc())
            .limit(1)
        ).first()
        
        # Calculate uptime for this device
        status_data = db.exec(
            select(
                func.count(DeviceStatus.status_key).label('total'),
                func.sum(func.cast(DeviceStatus.is_online, Integer)).label('online')
            )
            .where(DeviceStatus.device_key == device.device_key)
            .where(DeviceStatus.timestamp >= start_time)
            .where(DeviceStatus.timestamp <= end_time)
        ).first()
        
        uptime = 0
        if status_data and status_data.total > 0:
            uptime = round((status_data.online / status_data.total) * 100, 2)
        
        # Calculate completeness
        expected_entries = 60 * hours  # Assuming 1-minute frequency
        completeness = calculate_completeness(expected_entries, reading_count)
        
        device_dict["metrics"] = {
            "readings_last_period": reading_count,
            "expected_readings": expected_entries,
            "completeness_percentage": completeness["percentage"],
            "completeness_category": (
                "optimal" if completeness["optimal"] > 0 else
                "good" if completeness["good"] > 0 else
                "fair" if completeness["fair"] > 0 else
                "poor"
            ),
            "uptime_percentage": uptime,
            "last_reading": latest_reading.timestamp.isoformat() if latest_reading else None,
            "last_pm2_5": latest_reading.s1_pm2_5 if latest_reading else None,
            "last_pm10": latest_reading.s1_pm10 if latest_reading else None
        }
        
        devices_with_metrics.append(device_dict)
    
    # Calculate site-level statistics
    online_count = sum(1 for d in devices if d.is_online)
    active_count = sum(1 for d in devices if d.is_active)
    
    return {
        "site": {
            "site_id": site.site_id,
            "site_name": site.site_name,
            "district": site.district,
            "city": site.city,
            "country": site.country,
            "coordinates": {
                "latitude": site.latitude,
                "longitude": site.longitude
            }
        },
        "summary": {
            "total_devices": len(devices),
            "online": online_count,
            "offline": len(devices) - online_count,
            "active": active_count,
            "inactive": len(devices) - active_count
        },
        "time_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "devices": devices_with_metrics
    }


@router.get("/districts/{district}/summary")
async def get_district_summary(
    *,
    db: Session = Depends(get_db),
    district: str,
    hours: int = Query(24, description="Hours to look back for metrics")
):
    """
    Get summary statistics for all devices in a district
    """
    # Get all sites in the district
    sites = db.exec(
        select(Site).where(Site.district == district)
    ).all()
    
    if not sites:
        raise HTTPException(status_code=404, detail=f"No sites found in district: {district}")
    
    site_ids = [s.site_id for s in sites]
    
    # Get all devices in these sites
    devices = db.exec(
        select(Device).where(Device.site_id.in_(site_ids))
    ).all()
    
    # Get summary for the district
    # Reuse the same logic from get_device_summary_by_location
    device_query = select(Device).join(Site, Device.site_id == Site.site_id).where(Site.district == district)
    devices = db.exec(device_query).all()
    device_keys = [d.device_key for d in devices]
    
    # Calculate metrics
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    total_devices = len(devices)
    online_devices = sum(1 for d in devices if d.is_online)
    active_devices = sum(1 for d in devices if d.is_active)
    
    return {
        "location_filter": {"district": district},
        "time_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "device_counts": {
            "total": total_devices,
            "online": online_devices,
            "offline": total_devices - online_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/cities/{city}/analysis")
async def get_comprehensive_city_analysis(
    *,
    db: Session = Depends(get_db),
    city: str,
    hours: int = Query(24, description="Hours to look back for metrics"),
    include_site_details: bool = Query(False, description="Include individual site details")
):
    """
    Get comprehensive analysis for a city including sites, devices, and data quality metrics
    """
    # Get all sites in the city
    sites = db.exec(
        select(Site).where(Site.city == city)
    ).all()
    
    if not sites:
        raise HTTPException(status_code=404, detail=f"No sites found in city: {city}")
    
    site_ids = [s.site_id for s in sites]
    
    # Get all devices in these sites
    devices = db.exec(
        select(Device).where(Device.site_id.in_(site_ids))
    ).all()
    
    device_keys = [d.device_key for d in devices]
    
    # Calculate time window
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    # Basic counts
    total_sites = len(sites)
    sites_with_devices = len(set(d.site_id for d in devices if d.site_id))
    total_devices = len(devices)
    online_devices = sum(1 for d in devices if d.is_online)
    active_devices = sum(1 for d in devices if d.is_active)
    
    # Site categories distribution
    site_categories = {}
    districts_in_city = {}
    for site in sites:
        if site.site_category:
            site_categories[site.site_category] = site_categories.get(site.site_category, 0) + 1
        if site.district:
            districts_in_city[site.district] = districts_in_city.get(site.district, 0) + 1
    
    # Device network distribution
    device_networks = {}
    device_categories = {}
    for device in devices:
        if device.network:
            device_networks[device.network] = device_networks.get(device.network, 0) + 1
        if device.category:
            device_categories[device.category] = device_categories.get(device.category, 0) + 1
    
    # Initialize metrics
    uptime_percentage = 0
    data_completeness_stats = {"optimal": 0, "good": 0, "fair": 0, "poor": 0}
    total_readings = 0
    expected_readings = 0
    avg_sensor_errors = 0
    
    if device_keys:
        # Calculate uptime
        status_records = db.exec(
            select(
                DeviceStatus.device_key,
                func.count(DeviceStatus.status_key).label('total_checks'),
                func.sum(func.cast(DeviceStatus.is_online, Integer)).label('online_checks')
            )
            .where(DeviceStatus.device_key.in_(device_keys))
            .where(DeviceStatus.timestamp >= start_time)
            .where(DeviceStatus.timestamp <= end_time)
            .group_by(DeviceStatus.device_key)
        ).all()
        
        if status_records:
            total_uptime = sum(r.online_checks / r.total_checks * 100 for r in status_records if r.total_checks > 0)
            uptime_percentage = round(total_uptime / len(status_records), 2) if status_records else 0
        
        # Calculate total readings and expected
        expected_per_device_per_hour = 60  # Assuming 1-minute frequency
        expected_readings = expected_per_device_per_hour * hours * total_devices
        
        total_readings = db.exec(
            select(func.count(DeviceReading.reading_key))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
        ).first() or 0
        
        # Calculate sensor errors
        sensor_error_count = db.exec(
            select(
                func.count(DeviceReading.reading_key).label('total'),
                func.sum(
                    func.cast(
                        or_(
                            DeviceReading.s1_pm2_5.is_(None),
                            DeviceReading.s2_pm2_5.is_(None)
                        ), 
                        Integer
                    )
                ).label('errors')
            )
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
        ).first()
        
        if sensor_error_count and sensor_error_count.total > 0:
            avg_sensor_errors = round((sensor_error_count.errors / sensor_error_count.total) * 100, 2)
        
        # Calculate completeness for each device
        for device in devices:
            device_readings = db.exec(
                select(func.count(DeviceReading.reading_key))
                .where(DeviceReading.device_key == device.device_key)
                .where(DeviceReading.timestamp >= start_time)
                .where(DeviceReading.timestamp <= end_time)
            ).first() or 0
            
            device_expected = expected_per_device_per_hour * hours
            completeness = calculate_completeness(device_expected, device_readings)
            
            if completeness["optimal"] > 0:
                data_completeness_stats["optimal"] += 1
            elif completeness["good"] > 0:
                data_completeness_stats["good"] += 1
            elif completeness["fair"] > 0:
                data_completeness_stats["fair"] += 1
            else:
                data_completeness_stats["poor"] += 1
        
        # Convert to percentages
        if total_devices > 0:
            for key in data_completeness_stats:
                data_completeness_stats[key] = round((data_completeness_stats[key] / total_devices) * 100, 2)
    
    # Site details if requested
    site_details = []
    if include_site_details:
        for site in sites:
            site_devices = [d for d in devices if d.site_id == site.site_id]
            site_details.append({
                "site_id": site.site_id,
                "site_name": site.site_name,
                "district": site.district,
                "category": site.site_category,
                "coordinates": {
                    "latitude": site.latitude,
                    "longitude": site.longitude
                },
                "device_count": len(site_devices),
                "online_devices": sum(1 for d in site_devices if d.is_online),
                "active_devices": sum(1 for d in site_devices if d.is_active)
            })
    
    return {
        "city": city,
        "analysis_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "infrastructure_summary": {
            "total_sites": total_sites,
            "sites_with_devices": sites_with_devices,
            "sites_without_devices": total_sites - sites_with_devices,
            "site_coverage_percentage": round((sites_with_devices / total_sites * 100), 2) if total_sites > 0 else 0,
            "total_devices": total_devices,
            "average_devices_per_site": round(total_devices / total_sites, 2) if total_sites > 0 else 0
        },
        "device_status": {
            "online": online_devices,
            "offline": total_devices - online_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices,
            "online_percentage": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
            "active_percentage": round((active_devices / total_devices * 100), 2) if total_devices > 0 else 0
        },
        "data_quality_metrics": {
            "uptime_percentage": uptime_percentage,
            "total_readings": total_readings,
            "expected_readings": expected_readings,
            "data_availability": round((total_readings / expected_readings * 100), 2) if expected_readings > 0 else 0,
            "sensor_error_rate": avg_sensor_errors,
            "completeness_distribution": data_completeness_stats
        },
        "geographic_distribution": {
            "districts": districts_in_city,
            "total_districts": len(districts_in_city)
        },
        "infrastructure_types": {
            "site_categories": site_categories,
            "device_networks": device_networks,
            "device_categories": device_categories
        },
        "site_details": site_details if include_site_details else None,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/cities/{city}/summary")
async def get_city_summary(
    *,
    db: Session = Depends(get_db),
    city: str,
    hours: int = Query(24, description="Hours to look back for metrics")
):
    """
    Get basic summary statistics for all devices in a city (legacy endpoint)
    """
    # Get all sites in the city
    sites = db.exec(
        select(Site).where(Site.city == city)
    ).all()
    
    if not sites:
        raise HTTPException(status_code=404, detail=f"No sites found in city: {city}")
    
    # Get summary for the city
    # Reuse the same logic from get_device_summary_by_location
    device_query = select(Device).join(Site, Device.site_id == Site.site_id).where(Site.city == city)
    devices = db.exec(device_query).all()
    
    # Calculate metrics
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    total_devices = len(devices)
    online_devices = sum(1 for d in devices if d.is_online)
    active_devices = sum(1 for d in devices if d.is_active)
    
    return {
        "location_filter": {"city": city},
        "time_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "device_counts": {
            "total": total_devices,
            "online": online_devices,
            "offline": total_devices - online_devices,
            "active": active_devices,
            "inactive": total_devices - active_devices
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }