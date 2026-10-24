"""
Networks ("sensor manufacturers") endpoints.

Mirrors the platform's ``GET /devices/networks`` list, which Vertex shows as
"Sensor Manufacturers", and summarises beacon's mirrored devices per network.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.network import (
    NetworkListResponse,
    NetworkProfileSeedResponse,
    NetworkProfilesResponse,
    NetworkSyncResponse,
)
from app.services import network_sync_service
from app.core.security import extract_verified_token as _extract_token
from app.services.manufacturer_profiles import (
    assign_profiles_to_external_devices,
    ensure_manufacturer_profiles,
    manufacturer_profile_readiness,
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/sync", response_model=NetworkSyncResponse)
async def sync_networks(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
):
    """Mirror the platform's networks (sensor manufacturers) into sync_network."""
    token = _extract_token(authorization)
    try:
        result = await network_sync_service.sync_networks(db, token)
    except Exception as e:
        logger.exception(f"Unexpected error syncing networks: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    if not result.get("success", True):
        raise HTTPException(
            status_code=result.get("status_code", 400),
            detail=result.get("message", "Error fetching data from platform"),
        )
    return result


@router.get("/", response_model=NetworkListResponse)
def list_networks(
    db: Session = Depends(get_db),
    include_counts: bool = Query(default=True, description="Attach per-network device counts"),
    group: Optional[str] = Query(
        default=None,
        description=(
            "Comma-separated group title(s) (organisation). Scopes the device counts to that "
            "organisation's devices; omit for the whole fleet."
        ),
    ),
    only_with_devices: bool = Query(
        default=False, description="Drop networks with no device in scope (for a manufacturer filter)",
    ),
):
    """
    List networks (sensor manufacturers) with the number of mirrored, deployed
    and online devices each, optionally scoped to an organisation.
    """
    group_device_ids = None
    if group:
        from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids  # noqa: WPS433

        group_device_ids = resolve_group_device_ids(db, resolve_group_cohort_ids(db, group))
    try:
        return network_sync_service.list_networks(
            db,
            include_counts=include_counts,
            group_device_ids=group_device_ids,
            only_with_devices=only_with_devices,
        )
    except Exception as e:
        logger.exception(f"Unexpected error listing networks: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/profiles/seed", response_model=NetworkProfileSeedResponse)
def seed_manufacturer_profiles(db: Session = Depends(get_db)):
    """
    Create the per-manufacturer device profiles (airgradient_lowcost,
    iqair_lowcost, metone_bam, ...) that define how named readings map onto
    the field1..field20 slots, and assign them to mirrored devices that have
    no profile yet.
    """
    try:
        seeded = ensure_manufacturer_profiles(db)
        assigned = assign_profiles_to_external_devices(db)
        readiness = manufacturer_profile_readiness(db)
    except Exception as e:
        logger.exception(f"Unexpected error seeding manufacturer profiles: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    return {
        "success": True,
        "message": (
            f"{len(seeded['created'])} profiles created, "
            f"{len(seeded.get('components_added', []))} component models attached, "
            f"{assigned} devices assigned"
        ),
        "created": seeded["created"],
        "existing": seeded["existing"],
        "components_added": seeded.get("components_added", []),
        "devices_assigned": assigned,
        "diagnosable": [r["name"] for r in readiness if r["diagnosable"]],
    }


@router.get("/profiles", response_model=NetworkProfilesResponse)
def list_manufacturer_profiles(db: Session = Depends(get_db)):
    """
    The per-manufacturer device profiles and how the IoT diagnostic engine
    sees each one: whether it is diagnosable, its components, and the engine's
    readiness warnings (unmapped metrics, missing limits, ...).
    """
    try:
        profiles = manufacturer_profile_readiness(db)
    except Exception as e:
        logger.exception(f"Unexpected error reading manufacturer profile readiness: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    return {"success": True, "message": "Manufacturer profiles fetched successfully", "profiles": profiles}
