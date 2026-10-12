"""
Networks ("sensor manufacturers") endpoints.

Mirrors the platform's ``GET /devices/networks`` list, which Vertex shows as
"Sensor Manufacturers", and summarises beacon's mirrored devices per network.
"""

import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.network import NetworkListResponse, NetworkProfileSeedResponse, NetworkSyncResponse
from app.services import network_sync_service
from app.services.manufacturer_profiles import (
    assign_profiles_to_external_devices,
    ensure_manufacturer_profiles,
)

router = APIRouter()
logger = logging.getLogger(__name__)


def _extract_token(authorization: str) -> str:
    if not authorization.startswith("JWT "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format. Expected 'JWT <token>'",
        )
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    return parts[1]


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
):
    """List networks with the number of mirrored, deployed and online devices each."""
    try:
        return network_sync_service.list_networks(db, include_counts=include_counts)
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
    except Exception as e:
        logger.exception(f"Unexpected error seeding manufacturer profiles: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
    return {
        "success": True,
        "message": f"{len(seeded['created'])} profiles created, {assigned} devices assigned",
        "created": seeded["created"],
        "existing": seeded["existing"],
        "devices_assigned": assigned,
    }
