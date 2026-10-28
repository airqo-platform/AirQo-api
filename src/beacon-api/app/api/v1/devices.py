from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks, Query
import logging
from datetime import date
from sqlalchemy.orm import Session
from typing import Annotated, List, Optional
from app.db.session import get_db, SessionLocal
from app.schemas.data_sync import DeviceReadingsResponse
from app.schemas.device import (
    DeviceResponse, 
    SingleDeviceResponse, 
    DeviceMetadataResponse, 
    DeviceConfigDataResponse,
    DevicePerformanceResponse,
    DeviceFilesResponse,
    DeviceUpsertResponse,
    KeyValuePayload,
    DeviceSyncResponse,
)
from app.services import device_readings_service, device_service, site_service
from app.services.diagnostics.summaries import apply_diagnostics_to_devices
from app.utils.networks import is_network_enabled

router = APIRouter()
logger = logging.getLogger(__name__)

async def _run_sync_devices(token: str):
    """Background task to run device sync, then site sync, with its own DB session.

    Devices only carry a site_id; coordinates live on sync_site, so sites are
    refreshed afterwards to cover devices deployed to newly created sites.
    """
    db = SessionLocal()
    try:
        try:
            await device_service.sync_devices(db, token)
        except Exception as e:
            logger.exception(f"Background device sync failed: {e}")
            db.rollback()
        try:
            result = await site_service.sync_sites(db, token)
            if result.get("success", True):
                logger.info(f"[Site Sync] Sync after device sync completed: {result.get('message')}")
            else:
                logger.error(f"[Site Sync] Sync after device sync failed: {result.get('message')}")
        except Exception as e:
            logger.exception(f"Site sync after device sync failed: {e}")
    finally:
        db.close()

@router.post("/sync", response_model=DeviceSyncResponse)
async def sync_devices(
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
):
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]
    
    background_tasks.add_task(_run_sync_devices, token)
    
    return {
        "success": True, 
        "message": "Device and site sync process started in the background. It may take a few minutes to complete.",
        "updates_count": 0,
        "new_count": 0
    }

@router.post("/sites/sync", response_model=DeviceSyncResponse)
async def sync_device_sites(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]
    
    try:
        result = await device_service.sync_device_sites(db, token)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error syncing device sites")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error syncing device sites: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/category/sync", response_model=DeviceSyncResponse)
async def sync_device_categories(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]
    
    try:
        result = await device_service.sync_device_categories(db, token)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error syncing device categories")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error syncing device categories: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/metadata/{category_name}", response_model=DeviceMetadataResponse)
async def get_device_metadata(
    device_id: str,
    category_name: str,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.get_device_metadata(db, device_id, category_name, skip, limit)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching metadata")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching metadata for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/configdata/{category_name}", response_model=DeviceConfigDataResponse)
async def get_device_configdata(
    device_id: str,
    category_name: str,
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.get_device_configdata(db, device_id, category_name, skip, limit)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching config data")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching config data for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/{device_id}/metadata/{category_name}", response_model=DeviceUpsertResponse)
async def create_device_metadata(
    device_id: str,
    category_name: str,
    payload: KeyValuePayload,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.create_device_metadata(db, device_id, category_name, payload.values)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error creating metadata")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error creating metadata for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.post("/{device_id}/configdata/{category_name}", response_model=DeviceUpsertResponse)
async def create_device_configdata(
    device_id: str,
    category_name: str,
    payload: KeyValuePayload,
    db: Session = Depends(get_db)
):
    try:
        result = await device_service.create_device_configdata(db, device_id, category_name, payload.values)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error creating config data")
            raise HTTPException(status_code=status_code, detail=message)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error creating config data for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from typing import Optional

@router.get("/performance", response_model=DevicePerformanceResponse)
async def get_device_performance(
    background_tasks: BackgroundTasks,
    device_name: List[str] = Query(...),
    start_date_time: str = Query(..., alias="startDateTime"),
    end_date_time: str = Query(..., alias="endDateTime"),
    frequency: str = Query(default="raw", description="raw | hourly | daily"),
    db: Session = Depends(get_db)
):
    freq = (frequency or "raw").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid 'frequency'. Must be one of: raw, hourly, daily.",
        )
    try:
        result = await device_service.get_device_performance(
            db, device_name, start_date_time, end_date_time, frequency=freq,
        )
        # A single device viewed up to today: bring its readings up to date for
        # the next request. Multi-device views would fan out, so they don't.
        names = [n.strip() for raw in device_name for n in raw.split(",") if n.strip()]
        if len(names) == 1 and device_readings_service.covers_today(end_date_time):
            device_readings_service.refresh_viewed_device(db, background_tasks, names[0])
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching performance for devices {device_name}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/files", response_model=DeviceFilesResponse)
async def get_device_files(device_id: str):
    try:
        return await device_service.get_device_files(device_id)
    except Exception as e:
        logger.exception(f"Unexpected error fetching files for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/synced", response_model=DeviceResponse)
def get_synced_devices(
    group: Annotated[str, Query(description="Comma-separated group title(s) — required")],
    db: Annotated[Session, Depends(get_db)],
    limit: int = 30,
    skip: int = 0,
    search: Optional[str] = None,
    network: Optional[str] = Query(
        default=None,
        description="Comma-separated sensor manufacturer(s) / network(s), e.g. airqo,airgradient",
    ),
    include_performance: Annotated[bool, Query(alias="includePerformance")] = False,
    start_date_time: Annotated[Optional[str], Query(alias="startDateTime")] = None,
    end_date_time: Annotated[Optional[str], Query(alias="endDateTime")] = None,
    frequency: str = "hourly",
    include_diagnostics: Annotated[bool, Query(alias="includeDiagnostics")] = False,
):
    """List devices from the local sync_device table, filtered by group.

    ``network`` narrows the list to one or more sensor manufacturers.
    When ``includePerformance=true`` and both date bounds are provided, each
    device on the page is enriched with locally-computed metrics.
    When ``includeDiagnostics=true``, each device carries its most recent
    stored daily diagnosis under ``diagnostics``.
    """
    freq = (frequency or "hourly").lower()
    if freq not in {"raw", "hourly", "daily"}:
        raise HTTPException(
            status_code=400,
            detail="Invalid frequency. Expected one of: raw, hourly, daily.",
        )

    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids

    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)
    with_performance = bool(include_performance and start_date_time and end_date_time)

    query_params = {"group": group, "search": search, "network": network}
    if with_performance:
        query_params.update({
            "includePerformance": "true",
            "startDateTime": start_date_time,
            "endDateTime": end_date_time,
            "frequency": freq,
        })
    if include_diagnostics:
        query_params["includeDiagnostics"] = "true"

    try:
        result = device_service.get_synced_device_details(
            db,
            skip=skip,
            limit=limit,
            search=search,
            group_device_ids=group_device_ids,
            query_params=query_params,
            network=network,
        )

        if with_performance:
            device_service.apply_local_performance_synced_devices(
                result.get("devices", []),
                db,
                start_date_time,
                end_date_time,
                frequency=freq,
            )

        if include_diagnostics:
            apply_diagnostics_to_devices(result.get("devices", []), db, id_key="_id")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching synced devices: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}/readings", response_model=DeviceReadingsResponse)
def get_device_readings(
    device_id: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
    day: Optional[date] = Query(default=None, alias="date", description="UTC day (YYYY-MM-DD); defaults to today"),
    frequency: str = Query(default="raw", description="raw | hourly"),
    refresh: bool = Query(default=True, description="Refresh today's readings in the background when they are stale"),
    limit: int = Query(default=10000, ge=1, le=10000, description="Max records to return"),
    db: Session = Depends(get_db),
):
    """
    Stored readings of one device (registry id or name) for a UTC day, oldest
    first. Answers straight from the local tables; for today, a device whose
    newest reading is stale is refreshed from ThingSpeak or its manufacturer
    in the background, and ``refresh`` says whether to ask again shortly.
    """
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    if len(authorization.split(" ")) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")

    freq = (frequency or "raw").lower()
    if freq not in {"raw", "hourly"}:
        raise HTTPException(status_code=400, detail="Invalid 'frequency'. Must be one of: raw, hourly.")

    try:
        dev = device_readings_service.find_device(db, device_id)
        if dev is None or not is_network_enabled(dev.network_id):
            raise HTTPException(status_code=404, detail=f"Device {device_id} not found")
        return device_readings_service.get_device_readings(
            db, background_tasks, dev, day=day, frequency=freq, refresh=refresh, limit=limit,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching readings for device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/{device_id}", response_model=SingleDeviceResponse)
async def get_device(
    device_id: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(...),
    db: Session = Depends(get_db)
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]
    
    try:
        result = await device_service.get_device_by_id(db, token, device_id)

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        # Someone is looking at this device: bring its readings up to date
        device_readings_service.refresh_viewed_device(db, background_tasks, device_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching device {device_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/", response_model=DeviceResponse)
async def get_devices(
    authorization: str = Header(...),
    group: str = Query(..., description="Comma-separated group title(s) — required"),
    db: Session = Depends(get_db),
    limit: int = 30,
    skip: int = 0,
    search: Optional[str] = None,
    network: Optional[str] = Query(
        default=None,
        description="Sensor manufacturer / network to filter by (passed through to the platform)",
    ),
):
    # The token should be in the format "JWT <token>"
    if not authorization.startswith("JWT "):
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'JWT <token>'")
    
    parts = authorization.split(" ")
    if len(parts) < 2:
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Missing token.")
    
    token = parts[1]

    # Resolve group → device IDs
    from app.services.group_filter import resolve_group_cohort_ids, resolve_group_device_ids
    cohort_ids = resolve_group_cohort_ids(db, group)
    group_device_ids = resolve_group_device_ids(db, cohort_ids)
    group_device_id_set = set(group_device_ids or [])
    
    try:
        # Supergroup (`group_device_ids is None`) means unrestricted devices.
        # Empty list means restricted group with no devices.
        if group_device_ids == []:
            return {
                "success": True,
                "message": "Devices fetched successfully",
                "meta": {
                    "total": 0,
                    "limit": limit,
                    "skip": skip,
                },
                "devices": [],
            }

        params = {
            "limit": limit,
            "skip": skip,
        }
        if group_device_ids is not None:
            params["device_id__in"] = ",".join(group_device_ids)
        if search:
            params["search"] = search
        if network:
            params["network"] = network

        result = await device_service.get_device_details(db, token, params)
        
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching data from platform")
            raise HTTPException(status_code=status_code, detail=message)

        devices = result.get("devices", []) or []
        supports_in_filter = True
        if group_device_ids is not None:
            supports_in_filter = all(
                device.get("_id") in group_device_id_set for device in devices
            )

        if group_device_ids is not None and not supports_in_filter:
            fallback_params = {}
            if search:
                fallback_params["search"] = search
            if network:
                fallback_params["network"] = network

            fallback_result = await device_service.get_device_details(db, token, fallback_params)
            if not fallback_result.get("success", True):
                status_code = fallback_result.get("status_code", 400)
                message = fallback_result.get("message", "Error fetching data from platform")
                raise HTTPException(status_code=status_code, detail=message)

            filtered_devices = [
                device for device in (fallback_result.get("devices", []) or [])
                if device.get("_id") in group_device_id_set
            ]
            result["devices"] = filtered_devices[skip: skip + limit]

            meta = result.get("meta")
            if not isinstance(meta, dict):
                meta = {}
                result["meta"] = meta
            meta["total"] = len(filtered_devices)
            meta["limit"] = limit
            meta["skip"] = skip
            
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error fetching devices: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")
