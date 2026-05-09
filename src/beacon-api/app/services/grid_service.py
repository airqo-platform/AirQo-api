import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.services import grid_sync_service

logger = logging.getLogger(__name__)

def _format_synced_grid_to_platform(synced_grid: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a synced grid shape to the platform grid shape."""
    platform_sites = []
    for site in synced_grid.get("sites", []):
        platform_sites.append({
            "_id": site.get("site_id"),
            "name": site.get("name"),
            "latitude": site.get("latitude"),
            "longitude": site.get("longitude"),
            "network": site.get("network"),
            "country": site.get("country"),
            "city": site.get("city"),
            "county": site.get("county"),
            "district": site.get("district"),
            "region": site.get("region"),
            "data_provider": site.get("data_provider"),
            "description": site.get("description"),
            "generated_name": site.get("generated_name"),
            "site_tags": site.get("site_tags", []),
            "site_codes": site.get("site_codes", []),
            # Devices intentionally omitted to match typical platform summary response
            "devices": []
        })

    return {
        "_id": synced_grid.get("grid_id"),
        "name": synced_grid.get("name"),
        "visibility": synced_grid.get("visibility"),
        "admin_level": synced_grid.get("admin_level"),
        "network": synced_grid.get("network"),
        "long_name": synced_grid.get("long_name"),
        "flag_url": synced_grid.get("flag_url"),
        "numberOfSites": synced_grid.get("number_of_sites", 0),
        "sites": platform_sites,
    }


def get_grids_from_local(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
) -> Dict[str, Any]:
    """Fetch grids from the local sync table and format them like the platform API."""
    result = grid_sync_service.get_synced_grids(
        db, skip=skip, limit=limit, search=search
    )

    if not result.get("success"):
        return result

    synced_grids = result.get("grids", [])
    platform_grids = [_format_synced_grid_to_platform(g) for g in synced_grids]

    return {
        "success": True,
        "message": "Grids fetched successfully",
        "meta": result.get("meta"),
        "grids": platform_grids,
    }


def get_grids_by_ids_from_local(
    db: Session,
    grid_ids: str,
) -> Dict[str, Any]:
    """Fetch specific grids by ID from the local sync table and format them like the platform API."""
    result = grid_sync_service.get_synced_grids(
        db, skip=0, limit=1000, grid_ids=grid_ids
    )

    if not result.get("success"):
        return result

    synced_grids = result.get("grids", [])
    platform_grids = [_format_synced_grid_to_platform(g) for g in synced_grids]

    return {
        "success": True,
        "message": "Grids fetched successfully",
        "meta": {"total": len(platform_grids), "skip": 0, "limit": len(platform_grids)},
        "grids": platform_grids,
    }
