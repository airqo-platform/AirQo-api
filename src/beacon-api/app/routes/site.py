from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from app.deps import get_db, CommonQueryParams
from app.models import Site, SiteRead, SiteCreate, SiteUpdate, Device, DeviceReading
from app.crud import site as site_crud
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/count")
async def get_site_count(
    *,
    db: Session = Depends(get_db),
    city: Optional[str] = None,
    district: Optional[str] = None,
    site_category: Optional[str] = None
):
    """
    Get total site count with optional filters
    """
    query = select(func.count(Site.site_key))
    
    if city:
        query = query.where(Site.city == city)
    if district:
        query = query.where(Site.district == district)
    if site_category:
        query = query.where(Site.site_category == site_category)
    
    total_count = db.exec(query).first()
    
    # All sites in dim_site are considered active
    active_count = total_count
    inactive_count = 0
    
    return {
        "total": total_count or 0,
        "active": active_count or 0,
        "inactive": inactive_count,
        "filters_applied": {
            "city": city,
            "district": district,
            "site_category": site_category
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/statistics")
async def get_site_statistics(
    *,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive site statistics
    """
    total_sites = db.exec(select(func.count(Site.site_key))).first() or 0
    active_sites = total_sites  # All sites in dim_site are considered active
    
    # Sites with devices through dim_device.site_id
    sites_with_devices = db.exec(
        select(func.count(func.distinct(Device.site_id)))
        .where(Device.site_id.is_not(None))
    ).first() or 0
    
    # Sites by city
    cities = db.exec(
        select(Site.city, func.count(Site.site_key))
        .where(Site.city.is_not(None))
        .group_by(Site.city)
    ).all()
    
    # Sites by district
    districts = db.exec(
        select(Site.district, func.count(Site.site_key))
        .where(Site.district.is_not(None))
        .group_by(Site.district)
    ).all()
    
    # Sites by category
    site_categories = db.exec(
        select(Site.site_category, func.count(Site.site_key))
        .where(Site.site_category.is_not(None))
        .group_by(Site.site_category)
    ).all()
    
    # Average devices per site
    device_counts = db.exec(
        select(Device.site_id, func.count(Device.device_key))
        .where(Device.site_id.is_not(None))
        .group_by(Device.site_id)
    ).all()
    
    avg_devices = sum(count for _, count in device_counts) / len(device_counts) if device_counts else 0
    
    return {
        "summary": {
            "total": total_sites,
            "active": active_sites,
            "inactive": total_sites - active_sites,
            "with_devices": sites_with_devices,
            "without_devices": total_sites - sites_with_devices
        },
        "by_city": {city: count for city, count in cities},
        "by_district": {district: count for district, count in districts},
        "by_category": {cat: count for cat, count in site_categories},
        "device_distribution": {
            "average_devices_per_site": round(avg_devices, 2),
            "total_device_count": sum(count for _, count in device_counts)
        },
        "percentages": {
            "active_rate": 100.0,  # All sites are active
            "coverage_rate": round((sites_with_devices / total_sites * 100), 2) if total_sites > 0 else 0
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@router.get("/", response_model=List[SiteRead])
async def get_sites(
    *,
    db: Session = Depends(get_db),
    common: CommonQueryParams = Depends(),
    city: Optional[str] = None,
    district: Optional[str] = None,
    site_category: Optional[str] = None
):
    """
    Get list of sites with optional filters
    """
    query = select(Site)
    
    if city:
        query = query.where(Site.city == city)
    if district:
        query = query.where(Site.district == district)
    if site_category:
        query = query.where(Site.site_category == site_category)
    
    query = query.offset(common.skip).limit(common.limit)
    
    sites = db.exec(query).all()
    
    # Add device count for each site
    result = []
    for site in sites:
        site_dict = site.dict()
        # Get device count from dim_device
        device_count = db.exec(
            select(func.count(Device.device_key))
            .where(Device.site_id == site.site_id)
        ).first() or 0
        site_dict["device_count"] = device_count
        result.append(SiteRead(**site_dict))
    
    return result


@router.get("/{site_id}", response_model=SiteRead)
async def get_site(
    *,
    db: Session = Depends(get_db),
    site_id: str
):
    """
    Get site by ID
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Get device count from dim_device
    device_count = db.exec(
        select(func.count(Device.device_key))
        .where(Device.site_id == site.site_id)
    ).first() or 0
    
    site_dict = site.dict()
    site_dict["device_count"] = device_count
    
    return SiteRead(**site_dict)


@router.post("/", response_model=SiteRead)
async def create_site(
    *,
    db: Session = Depends(get_db),
    site_in: SiteCreate
):
    """
    Create new site
    """
    # Check if site already exists
    existing = site_crud.get(db, id=site_in.site_id)
    if existing:
        raise HTTPException(status_code=400, detail="Site ID already exists")
    
    existing_name = site_crud.get_by_name(db, site_name=site_in.site_name)
    if existing_name:
        raise HTTPException(status_code=400, detail="Site name already exists")
    
    site = site_crud.create(db, obj_in=site_in)
    site_dict = site.dict()
    site_dict["device_count"] = 0
    
    return SiteRead(**site_dict)


@router.patch("/{site_id}", response_model=SiteRead)
async def update_site(
    *,
    db: Session = Depends(get_db),
    site_id: str,
    site_in: SiteUpdate
):
    """
    Update site
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    site = site_crud.update(db, db_obj=site, obj_in=site_in)
    
    # Get device count from dim_device
    device_count = db.exec(
        select(func.count(Device.device_key))
        .where(Device.site_id == site.site_id)
    ).first() or 0
    
    site_dict = site.dict()
    site_dict["device_count"] = device_count
    
    return SiteRead(**site_dict)


@router.delete("/{site_id}")
async def delete_site(
    *,
    db: Session = Depends(get_db),
    site_id: str
):
    """
    Delete site
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Check if site has devices
    active_device_count = db.exec(
        select(func.count(Device.device_key))
        .where(Device.site_id == site_id)
    ).first() or 0
    
    if active_device_count > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot delete site with {active_device_count} active device(s)"
        )
    
    site_crud.remove(db, id=site_id)
    return {"message": "Site deleted successfully"}


@router.get("/{site_id}/devices")
async def get_site_devices(
    *,
    db: Session = Depends(get_db),
    site_id: str,
    common: CommonQueryParams = Depends()
):
    """
    Get all devices for a site through dim_location
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Get devices linked to this site through dim_device.site_id
    devices = db.exec(
        select(Device)
        .where(Device.site_id == site_id)
        .offset(common.skip)
        .limit(common.limit)
    ).all()
    
    devices = [device.dict() for device in devices]
    
    return {
        "site_id": site_id,
        "site_name": site.site_name,
        "count": len(devices),
        "devices": devices
    }


@router.get("/{site_id}/performance")
async def get_site_performance(
    *,
    db: Session = Depends(get_db),
    site_id: str,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze")
):
    """
    Get aggregated performance metrics for all devices in a site
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Get device keys for this site
    device_keys = db.exec(
        select(Device.device_key)
        .where(Device.site_id == site_id)
    ).all()
    
    # Calculate time range
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)
    
    # Get aggregated readings for all devices at this site
    if device_keys:
        avg_pm25 = db.exec(
            select(func.avg(DeviceReading.s1_pm2_5))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
            .where(DeviceReading.s1_pm2_5.is_not(None))
        ).first()
        
        avg_pm10 = db.exec(
            select(func.avg(DeviceReading.s1_pm10))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
            .where(DeviceReading.s1_pm10.is_not(None))
        ).first()
        
        reading_count = db.exec(
            select(func.count(DeviceReading.reading_key))
            .where(DeviceReading.device_key.in_(device_keys))
            .where(DeviceReading.timestamp >= start_time)
            .where(DeviceReading.timestamp <= end_time)
        ).first() or 0
    else:
        avg_pm25 = None
        avg_pm10 = None
        reading_count = 0
    
    return {
        "site_id": site_id,
        "site_name": site.site_name,
        "period": {
            "days": days,
            "start": start_time.isoformat(),
            "end": end_time.isoformat()
        },
        "device_count": len(device_keys),
        "metrics": {
            "avg_pm2_5": round(avg_pm25, 2) if avg_pm25 else None,
            "avg_pm10": round(avg_pm10, 2) if avg_pm10 else None,
            "total_readings": reading_count
        },
        "site_info": {
            "city": site.city,
            "district": site.district,
            "category": site.site_category,
            "coordinates": {
                "latitude": site.latitude,
                "longitude": site.longitude
            }
        }
    }


@router.get("/cities/list")
async def get_cities(
    *,
    db: Session = Depends(get_db)
):
    """
    Get list of unique cities
    """
    query = select(Site.city).distinct().where(Site.city.is_not(None))
    cities = db.exec(query).all()
    
    return {
        "count": len(cities),
        "cities": sorted(cities)
    }


@router.get("/districts/list")
async def get_districts(
    *,
    db: Session = Depends(get_db),
    city: Optional[str] = None
):
    """
    Get list of unique districts, optionally filtered by city
    """
    query = select(Site.district).distinct().where(Site.district.is_not(None))
    
    if city:
        query = query.where(Site.city == city)
    
    districts = db.exec(query).all()
    
    return {
        "count": len(districts),
        "city": city,
        "districts": sorted(districts)
    }


@router.get("/categories/list")
async def get_categories(
    *,
    db: Session = Depends(get_db)
):
    """
    Get list of unique site categories
    """
    query = select(Site.site_category).distinct().where(Site.site_category.is_not(None))
    categories = db.exec(query).all()
    
    return {
        "count": len(categories),
        "categories": sorted(categories)
    }