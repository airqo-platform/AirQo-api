from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from sqlalchemy import Integer
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from app.deps import get_db
from app.models import Device, Site, DeviceReading, DeviceStatus

router = APIRouter()


@router.get("/cities/overview")
async def get_all_cities_overview(
    *,
    db: Session = Depends(get_db),
    hours: int = Query(24, description="Hours to look back for metrics"),
    min_sites: int = Query(1, description="Minimum number of sites to include city"),
    sort_by: str = Query("total_devices", description="Sort by: total_devices, online_percentage, data_availability")
):
    """
    Get overview of all cities with their infrastructure and data quality metrics
    """
    # Get all cities with their sites
    cities_data = db.exec(
        select(Site.city, func.count(Site.site_key).label('site_count'))
        .where(Site.city.is_not(None))
        .group_by(Site.city)
        .having(func.count(Site.site_key) >= min_sites)
    ).all()
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    cities_analysis = []
    
    for city_data in cities_data:
        city = city_data.city
        site_count = city_data.site_count
        
        # Get sites in this city
        sites = db.exec(
            select(Site).where(Site.city == city)
        ).all()
        
        site_ids = [s.site_id for s in sites]
        
        # Get devices for this city
        devices = db.exec(
            select(Device).where(Device.site_id.in_(site_ids))
        ).all()
        
        device_keys = [d.device_key for d in devices]
        
        # Calculate basic metrics
        total_devices = len(devices)
        online_devices = sum(1 for d in devices if d.is_online)
        active_devices = sum(1 for d in devices if d.is_active)
        sites_with_devices = len(set(d.site_id for d in devices if d.site_id))
        
        # Calculate data availability if devices exist
        data_availability = 0
        uptime_percentage = 0
        
        if device_keys:
            # Get readings count
            readings_count = db.exec(
                select(func.count(DeviceReading.reading_key))
                .where(DeviceReading.device_key.in_(device_keys))
                .where(DeviceReading.timestamp >= start_time)
                .where(DeviceReading.timestamp <= end_time)
            ).first() or 0
            
            expected_readings = 60 * hours * total_devices  # 1-minute frequency
            data_availability = round((readings_count / expected_readings * 100), 2) if expected_readings > 0 else 0
            
            # Calculate uptime
            status_records = db.exec(
                select(
                    func.count(DeviceStatus.status_key).label('total'),
                    func.sum(func.cast(DeviceStatus.is_online, Integer)).label('online')
                )
                .where(DeviceStatus.device_key.in_(device_keys))
                .where(DeviceStatus.timestamp >= start_time)
                .where(DeviceStatus.timestamp <= end_time)
            ).first()
            
            if status_records and status_records.total > 0:
                uptime_percentage = round((status_records.online / status_records.total * 100), 2)
        
        # Get districts in this city
        districts = set(s.district for s in sites if s.district)
        
        cities_analysis.append({
            "city": city,
            "infrastructure": {
                "total_sites": site_count,
                "sites_with_devices": sites_with_devices,
                "site_coverage_percentage": round((sites_with_devices / site_count * 100), 2) if site_count > 0 else 0,
                "total_devices": total_devices,
                "districts": len(districts),
                "average_devices_per_site": round(total_devices / site_count, 2) if site_count > 0 else 0
            },
            "operational_status": {
                "online_devices": online_devices,
                "offline_devices": total_devices - online_devices,
                "active_devices": active_devices,
                "online_percentage": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
                "active_percentage": round((active_devices / total_devices * 100), 2) if total_devices > 0 else 0
            },
            "data_quality": {
                "uptime_percentage": uptime_percentage,
                "data_availability": data_availability
            }
        })
    
    # Sort results
    if sort_by == "total_devices":
        cities_analysis.sort(key=lambda x: x["infrastructure"]["total_devices"], reverse=True)
    elif sort_by == "online_percentage":
        cities_analysis.sort(key=lambda x: x["operational_status"]["online_percentage"], reverse=True)
    elif sort_by == "data_availability":
        cities_analysis.sort(key=lambda x: x["data_quality"]["data_availability"], reverse=True)
    else:
        cities_analysis.sort(key=lambda x: x["infrastructure"]["total_devices"], reverse=True)
    
    # Calculate global statistics
    total_cities = len(cities_analysis)
    total_all_sites = sum(c["infrastructure"]["total_sites"] for c in cities_analysis)
    total_all_devices = sum(c["infrastructure"]["total_devices"] for c in cities_analysis)
    total_online = sum(c["operational_status"]["online_devices"] for c in cities_analysis)
    
    return {
        "analysis_period": {
            "hours": hours,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "filters_applied": {
            "min_sites": min_sites,
            "sort_by": sort_by
        },
        "global_summary": {
            "total_cities": total_cities,
            "total_sites": total_all_sites,
            "total_devices": total_all_devices,
            "global_online_percentage": round((total_online / total_all_devices * 100), 2) if total_all_devices > 0 else 0,
            "average_devices_per_city": round(total_all_devices / total_cities, 2) if total_cities > 0 else 0,
            "average_sites_per_city": round(total_all_sites / total_cities, 2) if total_cities > 0 else 0
        },
        "cities": cities_analysis,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/cities/comparison")
async def get_cities_comparison(
    *,
    db: Session = Depends(get_db),
    cities: str = Query(..., description="Comma-separated list of cities to compare"),
    hours: int = Query(24, description="Hours to look back for metrics"),
    metric: str = Query("all", description="Specific metric to compare: all, devices, uptime, data_availability")
):
    """
    Compare specific cities side by side with detailed metrics
    """
    city_list = [city.strip() for city in cities.split(",")]
    
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)
    
    comparison_data = []
    
    for city in city_list:
        # Get sites in this city
        sites = db.exec(
            select(Site).where(Site.city == city)
        ).all()
        
        if not sites:
            comparison_data.append({
                "city": city,
                "status": "not_found",
                "message": f"No sites found in {city}"
            })
            continue
            
        site_ids = [s.site_id for s in sites]
        
        # Get devices for this city
        devices = db.exec(
            select(Device).where(Device.site_id.in_(site_ids))
        ).all()
        
        device_keys = [d.device_key for d in devices]
        
        # Calculate comprehensive metrics
        total_devices = len(devices)
        online_devices = sum(1 for d in devices if d.is_online)
        active_devices = sum(1 for d in devices if d.is_active)
        sites_with_devices = len(set(d.site_id for d in devices if d.site_id))
        
        # Data quality metrics
        data_availability = 0
        uptime_percentage = 0
        sensor_error_rate = 0
        
        if device_keys:
            # Get readings count and errors
            reading_stats = db.exec(
                select(
                    func.count(DeviceReading.reading_key).label('total_readings'),
                    func.sum(
                        func.cast(
                            func.coalesce(DeviceReading.s1_pm2_5, 0).is_(None) |
                            func.coalesce(DeviceReading.s2_pm2_5, 0).is_(None), 
                            Integer
                        )
                    ).label('error_readings')
                )
                .where(DeviceReading.device_key.in_(device_keys))
                .where(DeviceReading.timestamp >= start_time)
                .where(DeviceReading.timestamp <= end_time)
            ).first()
            
            total_readings = reading_stats.total_readings or 0
            error_readings = reading_stats.error_readings or 0
            
            expected_readings = 60 * hours * total_devices  # 1-minute frequency
            data_availability = round((total_readings / expected_readings * 100), 2) if expected_readings > 0 else 0
            sensor_error_rate = round((error_readings / total_readings * 100), 2) if total_readings > 0 else 0
            
            # Calculate uptime
            status_records = db.exec(
                select(
                    func.count(DeviceStatus.status_key).label('total'),
                    func.sum(func.cast(DeviceStatus.is_online, Integer)).label('online')
                )
                .where(DeviceStatus.device_key.in_(device_keys))
                .where(DeviceStatus.timestamp >= start_time)
                .where(DeviceStatus.timestamp <= end_time)
            ).first()
            
            if status_records and status_records.total > 0:
                uptime_percentage = round((status_records.online / status_records.total * 100), 2)
        
        # Site categories and districts
        site_categories = {}
        districts = set()
        for site in sites:
            if site.site_category:
                site_categories[site.site_category] = site_categories.get(site.site_category, 0) + 1
            if site.district:
                districts.add(site.district)
        
        comparison_data.append({
            "city": city,
            "status": "found",
            "infrastructure": {
                "total_sites": len(sites),
                "sites_with_devices": sites_with_devices,
                "total_devices": total_devices,
                "districts_count": len(districts),
                "site_categories": site_categories,
                "device_density": round(total_devices / len(sites), 2) if sites else 0
            },
            "operational_metrics": {
                "online_devices": online_devices,
                "offline_devices": total_devices - online_devices,
                "active_devices": active_devices,
                "online_percentage": round((online_devices / total_devices * 100), 2) if total_devices > 0 else 0,
                "uptime_percentage": uptime_percentage
            },
            "data_quality": {
                "data_availability": data_availability,
                "sensor_error_rate": sensor_error_rate,
                "expected_readings": 60 * hours * total_devices if device_keys else 0,
                "actual_readings": total_readings if device_keys else 0
            }
        })
    
    # Calculate comparison insights
    found_cities = [c for c in comparison_data if c["status"] == "found"]
    
    insights = {}
    if found_cities:
        # Best/worst performing cities
        best_online = max(found_cities, key=lambda x: x["operational_metrics"]["online_percentage"])
        worst_online = min(found_cities, key=lambda x: x["operational_metrics"]["online_percentage"])
        
        best_data_availability = max(found_cities, key=lambda x: x["data_quality"]["data_availability"])
        worst_data_availability = min(found_cities, key=lambda x: x["data_quality"]["data_availability"])
        
        insights = {
            "best_online_performance": {
                "city": best_online["city"],
                "percentage": best_online["operational_metrics"]["online_percentage"]
            },
            "worst_online_performance": {
                "city": worst_online["city"], 
                "percentage": worst_online["operational_metrics"]["online_percentage"]
            },
            "best_data_availability": {
                "city": best_data_availability["city"],
                "percentage": best_data_availability["data_quality"]["data_availability"]
            },
            "worst_data_availability": {
                "city": worst_data_availability["city"],
                "percentage": worst_data_availability["data_quality"]["data_availability"]
            },
            "total_devices_compared": sum(c["infrastructure"]["total_devices"] for c in found_cities),
            "average_uptime": round(sum(c["operational_metrics"]["uptime_percentage"] for c in found_cities) / len(found_cities), 2)
        }
    
    return {
        "comparison_request": {
            "cities_requested": city_list,
            "analysis_period": {
                "hours": hours,
                "start": start_time.isoformat(),
                "end": end_time.isoformat()
            },
            "metric_focus": metric
        },
        "insights": insights,
        "cities_data": comparison_data,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }