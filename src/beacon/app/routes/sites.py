from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from app.deps import get_db, CommonQueryParams
from app.models import Site, SiteRead, SiteCreate, SiteUpdate, Device, DeviceReading
from app.crud import site as site_crud
from app.configs.settings import settings
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/count")
async def get_site_count(
    *,
    db: Session = Depends(get_db),
    region: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None
):
    """
    Get total site count with optional filters
    """
    query = select(func.count(Site.id))
    
    if region:
        query = query.where(Site.region == region)
    if district:
        query = query.where(Site.district == district)
    if status:
        query = query.where(Site.status == status)
    
    total_count = db.exec(query).first()
    
    # Get active vs inactive
    active_count = db.exec(
        select(func.count(Site.id)).where(Site.status == "active")
    ).first()
    
    inactive_count = db.exec(
        select(func.count(Site.id)).where(Site.status != "active")
    ).first()
    
    return {
        "total": total_count or 0,
        "active": active_count or 0,
        "inactive": inactive_count or 0,
        "filters_applied": {
            "region": region,
            "district": district,
            "status": status
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/statistics")
async def get_site_statistics(
    *,
    db: Session = Depends(get_db)
):
    """
    Get comprehensive site statistics
    """
    total_sites = db.exec(select(func.count(Site.id))).first() or 0
    active_sites = db.exec(
        select(func.count(Site.id)).where(Site.status == "active")
    ).first() or 0
    
    # Sites with devices - currently not linked in Device model
    sites_with_devices = 0  # Device model doesn't have site_id field
    
    # Sites by region
    regions = db.exec(
        select(Site.region, func.count(Site.id))
        .where(Site.region != None)
        .group_by(Site.region)
    ).all()
    
    # Sites by type
    site_types = db.exec(
        select(Site.site_type, func.count(Site.id))
        .group_by(Site.site_type)
    ).all()
    
    # Average devices per site - currently not available
    device_counts = []
    avg_devices = 0
    
    return {
        "summary": {
            "total": total_sites,
            "active": active_sites,
            "inactive": total_sites - active_sites,
            "with_devices": sites_with_devices,
            "without_devices": total_sites - sites_with_devices
        },
        "by_region": {region: count for region, count in regions},
        "by_type": {site_type: count for site_type, count in site_types if site_type},
        "device_distribution": {
            "average_devices_per_site": round(avg_devices, 2),
            "total_device_count": sum(count for _, count in device_counts)
        },
        "percentages": {
            "active_rate": round((active_sites / total_sites * 100), 2) if total_sites > 0 else 0,
            "coverage_rate": round((sites_with_devices / total_sites * 100), 2) if total_sites > 0 else 0
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/", response_model=List[SiteRead])
async def get_sites(
    *,
    db: Session = Depends(get_db),
    common: CommonQueryParams = Depends(),
    region: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None
):
    """
    Get list of sites with optional filters
    """
    query = select(Site)
    
    if region:
        query = query.where(Site.region == region)
    if district:
        query = query.where(Site.district == district)
    if status:
        query = query.where(Site.status == status)
    
    query = query.offset(common.skip).limit(common.limit)
    
    sites = db.exec(query).all()
    
    # Add device count for each site
    result = []
    for site in sites:
        site_dict = site.dict()
        # Device count - currently not linked
        site_dict["device_count"] = 0
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
    
    # Add device count - currently not linked
    site_dict = site.dict()
    site_dict["device_count"] = 0
    
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
    existing = site_crud.get(db, id=site_in.id)
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
    
    # Add device count - currently not linked
    site_dict = site.dict()
    site_dict["device_count"] = 0
    
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
    
    # Check if site has devices - currently not linked
    device_count = 0
    
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
    Get all devices for a site
    """
    site = site_crud.get(db, id=site_id)
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    # Devices not linked to sites in current model
    devices = []
    
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
    
    # Devices not linked to sites in current model
    return {
        "site_id": site_id,
        "site_name": site.site_name,
        "message": "Device-site linkage not available in current model",
        "site_info": {
            "region": site.region,
            "district": site.district,
            "site_type": site.site_type,
            "coordinates": {
                "latitude": site.latitude,
                "longitude": site.longitude,
                "altitude": site.altitude
            }
        }
    }


@router.get("/regions/list")
async def get_regions(
    *,
    db: Session = Depends(get_db)
):
    """
    Get list of unique regions
    """
    query = select(Site.region).distinct().where(Site.region != None)
    regions = db.exec(query).all()
    
    return {
        "count": len(regions),
        "regions": sorted(regions)
    }


@router.get("/districts/list")
async def get_districts(
    *,
    db: Session = Depends(get_db),
    region: Optional[str] = None
):
    """
    Get list of unique districts, optionally filtered by region
    """
    query = select(Site.district).distinct().where(Site.district != None)
    
    if region:
        query = query.where(Site.region == region)
    
    districts = db.exec(query).all()
    
    return {
        "count": len(districts),
        "region": region,
        "districts": sorted(districts)
    }