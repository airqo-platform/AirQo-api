import httpx
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sync import SyncGrid, SyncGridSite, SyncSite, SyncDevice, SyncSiteDevice
from app.services.site_service import upsert_site_to_sync

logger = logging.getLogger(__name__)
AIRQO_NETWORK = "airqo"


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _parse_platform_created(raw_created: Optional[str]) -> Optional[datetime]:
    """Parse an ISO datetime string from the platform; return None on failure."""
    if not raw_created:
        return None
    try:
        return datetime.fromisoformat(raw_created.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


async def _fetch_grid_page(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    page: int,
    skip: int,
    limit: int,
) -> Optional[Dict[str, Any]]:
    """Fetch a single page of grids. Returns parsed JSON or None on error."""
    params = {"limit": limit, "skip": skip}
    logger.info(f"[Grid Sync] Fetching page {page} (skip={skip})...")
    response = await client.get(url, headers=headers, params=params)
    if response.status_code != 200:
        logger.error(f"[Grid Sync] Platform API error on page {page}: {response.status_code}")
        return None
    return response.json()


async def _fetch_all_grids(token: str, limit: int = 100) -> Optional[List[Dict[str, Any]]]:
    """Fetch all grids from the platform across paginated requests.

    Returns None when any page fetch fails.
    """
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/grids/summary"

    all_grids: List[Dict[str, Any]] = []
    page = 1
    actual_limit = limit

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        while True:
            try:
                data = await _fetch_grid_page(
                    client, url, headers, page, (page - 1) * actual_limit, limit
                )
            except Exception as e:
                logger.exception(f"[Grid Sync] Error fetching page {page}: {e}")
                return None

            if data is None:
                logger.error(f"[Grid Sync] Failed to fetch page {page}; aborting grid sync fetch")
                return None

            grids_page = data.get("grids", [])
            all_grids.extend(grids_page)

            meta = data.get("meta", {})
            total_pages = meta.get("totalPages", 1)
            actual_limit = meta.get("limit", limit)

            logger.info(
                f"[Grid Sync] Page {page}/{total_pages}: "
                f"got {len(grids_page)} grids (total so far: {len(all_grids)}, "
                f"platform limit: {actual_limit})"
            )

            if page >= total_pages:
                break
            page += 1

    return all_grids


def _apply_grid_scalars(db_grid: SyncGrid, grid_data: Dict[str, Any]) -> bool:
    """Update scalar fields on a SyncGrid. Returns True if anything changed."""
    platform_created = _parse_platform_created(grid_data.get("createdAt"))

    updates = [
        ("name", grid_data.get("name"), db_grid.name),
        ("visibility", bool(grid_data.get("visibility", False)), bool(db_grid.visibility)),
        ("admin_level", grid_data.get("admin_level"), db_grid.admin_level),
        ("network", grid_data.get("network"), db_grid.network),
        ("long_name", grid_data.get("long_name"), db_grid.long_name),
        ("flag_url", grid_data.get("flag_url"), db_grid.flag_url),
    ]

    changed = False
    for attr, new_val, current_val in updates:
        if current_val != new_val:
            setattr(db_grid, attr, new_val)
            changed = True

    if platform_created and db_grid.platform_created_at != platform_created:
        db_grid.platform_created_at = platform_created
        changed = True

    return changed


def _build_desired_sites(
    db: Session, grid_sites: List[Dict[str, Any]]
) -> Tuple[Dict[str, bool], int]:
    """Build {site_id: is_active} from the platform payload, backfilling sync_site."""
    desired: Dict[str, bool] = {}
    backfilled = 0
    for site in grid_sites:
        site_id = site.get("_id")
        if not site_id:
            continue
        desired[site_id] = True # Grids payload currently doesn't have isActive for sites, assume true if present

        _, site_is_new, _ = upsert_site_to_sync(db, site, is_authoritative=False)
        if site_is_new:
            backfilled += 1
    return desired, backfilled


def _sync_grid_junctions(
    db: Session, grid_id: str, desired: Dict[str, bool]
) -> bool:
    """Reconcile sync_grid_site rows against the desired set. Returns True if changed."""
    existing_rows = (
        db.query(SyncGridSite)
        .filter(SyncGridSite.grid_id == grid_id)
        .all()
    )
    existing: Dict[str, SyncGridSite] = {r.site_id: r for r in existing_rows}
    changed = False

    for site_id, row in existing.items():
        if site_id not in desired:
            db.delete(row)
            changed = True

    for site_id, is_active in desired.items():
        row = existing.get(site_id)
        if row is None:
            db.add(SyncGridSite(
                grid_id=grid_id, site_id=site_id, is_active=is_active,
            ))
            changed = True
        elif bool(row.is_active) != is_active:
            row.is_active = is_active
            changed = True

    return changed


def _upsert_single_grid(
    db: Session, grid_data: Dict[str, Any]
) -> Optional[Tuple[str, int]]:
    """
    Upsert one grid and reconcile its sites.

    Returns (status, backfilled_count) where status is one of
    'new' | 'updated' | 'unchanged', or None if the grid had no id.
    """
    grid_id = grid_data.get("_id")
    if not grid_id:
        return None

    db_grid = db.query(SyncGrid).filter(SyncGrid.grid_id == grid_id).first()
    is_new = db_grid is None
    if is_new:
        db_grid = SyncGrid(grid_id=grid_id)
        db.add(db_grid)

    grid_field_changed = _apply_grid_scalars(db_grid, grid_data)
    desired, backfilled = _build_desired_sites(db, grid_data.get("sites", []))
    junction_changed = _sync_grid_junctions(db, grid_id, desired)

    if is_new:
        status = "new"
    elif grid_field_changed or junction_changed:
        status = "updated"
    else:
        status = "unchanged"
    return status, backfilled


# ---------------------------------------------------------------------------
# Sync: Platform → Local DB
# ---------------------------------------------------------------------------

async def sync_grids(db: Session, token: str) -> Dict[str, Any]:
    """
    Fetch all grids from the platform API sequentially (page by page),
    upsert into sync_grid, and rebuild the sync_grid_site junction.

    Embedded sites are backfilled into sync_site non-authoritatively.
    """
    all_grids = await _fetch_all_grids(token)

    if all_grids is None:
        return {
            "success": False,
            "message": "Failed to fetch grids from platform",
            "grids_synced": 0,
            "sites_backfilled": 0,
        }

    if not all_grids:
        return {
            "success": True,
            "message": "No grids found on platform",
            "grids_synced": 0,
            "sites_backfilled": 0,
        }

    counts = {"new": 0, "updated": 0, "unchanged": 0}
    sites_backfilled = 0

    for grid_data in all_grids:
        try:
            result = _upsert_single_grid(db, grid_data)
            if result is None:
                continue
            status, backfilled = result
            counts[status] += 1
            sites_backfilled += backfilled

            # Commit in batches
            if (counts["new"] + counts["updated"]) % 20 == 0:
                db.commit()
        except Exception as e:
            logger.error(
                f"[Grid Sync] Error syncing grid {grid_data.get('_id')}: {e}"
            )
            db.rollback()

    db.commit()

    total_synced = counts["new"] + counts["updated"] + counts["unchanged"]
    logger.info(
        f"[Grid Sync] Done — {total_synced} grids processed "
        f"({counts['new']} new, {counts['updated']} updated, {counts['unchanged']} unchanged), "
        f"{sites_backfilled} sites backfilled"
    )

    return {
        "success": True,
        "message": (
            f"Processed {total_synced} grids: {counts['new']} new, "
            f"{counts['updated']} updated, {counts['unchanged']} unchanged. "
            f"{sites_backfilled} new sites backfilled."
        ),
        "grids_synced": counts["new"] + counts["updated"],
        "grids_new": counts["new"],
        "grids_updated": counts["updated"],
        "grids_unchanged": counts["unchanged"],
        "sites_backfilled": sites_backfilled,
    }


# ---------------------------------------------------------------------------
# Read: Local DB (source of truth)
# ---------------------------------------------------------------------------

def _build_grid_site_devices(
    db: Session,
    site_id: str,
    group_device_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Return junction-derived device dicts for a single site."""
    query = db.query(SyncSiteDevice).filter(SyncSiteDevice.site_id == site_id)
    if group_device_ids is not None:
        query = query.filter(SyncSiteDevice.device_id.in_(group_device_ids))
    junctions = query.all()
    site = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
    site_latitude = site.latitude if site else None
    site_longitude = site.longitude if site else None
    devices = []
    for j in junctions:
        sync_dev = (
            db.query(SyncDevice).filter(SyncDevice.device_id == j.device_id).first()
        )
        devices.append({
            "device_id": j.device_id,
            "device_name": sync_dev.device_name if sync_dev else None,
            "latitude": site_latitude,
            "longitude": site_longitude,
            "network_id": sync_dev.network_id if sync_dev else None,
            "is_active": j.is_active or False,
        })
    return devices


def _build_grid_sites(
    db: Session,
    grid_id: str,
    group_device_ids: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Return junction-derived site dicts for a single grid, including underlying devices."""
    junctions = (
        db.query(SyncGridSite)
        .filter(SyncGridSite.grid_id == grid_id)
        .all()
    )
    sites = []
    for j in junctions:
        sync_site = (
            db.query(SyncSite).filter(SyncSite.site_id == j.site_id).first()
        )
        if sync_site:
            devices = _build_grid_site_devices(db, sync_site.site_id, group_device_ids=group_device_ids)
            if group_device_ids is not None and not devices:
                continue
            sites.append({
                "site_id": sync_site.site_id,
                "name": sync_site.name,
                "latitude": sync_site.latitude,
                "longitude": sync_site.longitude,
                "network": sync_site.network,
                "country": sync_site.country,
                "city": sync_site.city,
                "county": sync_site.county,
                "district": sync_site.district,
                "region": sync_site.region,
                "data_provider": sync_site.data_provider,
                "description": sync_site.description,
                "generated_name": sync_site.generated_name,
                "site_tags": json.loads(sync_site.site_tags) if sync_site.site_tags else [],
                "site_codes": json.loads(sync_site.site_codes) if sync_site.site_codes else [],
                "number_of_devices": len(devices),
                "devices": devices
            })
    return sites


def _serialize_grid(db: Session, g: SyncGrid) -> Dict[str, Any]:
    """Serialize a SyncGrid plus its sites into the public dict shape."""
    sites = _build_grid_sites(db, g.grid_id)
    return {
        "grid_id": g.grid_id,
        "name": g.name,
        "visibility": g.visibility,
        "admin_level": g.admin_level,
        "network": g.network,
        "long_name": g.long_name,
        "flag_url": g.flag_url,
        "number_of_sites": len(sites),
        "sites": sites,
    }


def _serialize_grid_scoped(
    db: Session,
    g: SyncGrid,
    group_device_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Serialize a SyncGrid with optional device-level group scoping."""
    sites = _build_grid_sites(db, g.grid_id, group_device_ids=group_device_ids)
    return {
        "grid_id": g.grid_id,
        "name": g.name,
        "visibility": g.visibility,
        "admin_level": g.admin_level,
        "network": g.network,
        "long_name": g.long_name,
        "flag_url": g.flag_url,
        "number_of_sites": len(sites),
        "sites": sites,
    }


def _apply_grid_query_filters(
    query,
    search: Optional[str],
    grid_ids: Optional[str],
    tags: Optional[str],
    admin_level: Optional[str],
):
    """Apply optional filters to a SyncGrid query."""
    if grid_ids:
        ids = [gid.strip() for gid in grid_ids.split(",") if gid.strip()]
        if ids:
            query = query.filter(SyncGrid.grid_id.in_(ids))

    if search:
        query = query.filter(SyncGrid.name.ilike(f"%{search}%"))

    if tags:
        matching_grid_ids = _query_grid_ids_for_site_tags(query.session, tags)
        query = query.filter(SyncGrid.grid_id.in_(matching_grid_ids))

    if admin_level:
        query = query.filter(SyncGrid.admin_level.ilike(admin_level))

    return query


def _query_grid_ids_for_site_tags(db: Session, tags: str):
    """Return a query of grid IDs whose linked sites contain every supplied tag."""
    query = (
        db.query(SyncGridSite.grid_id)
        .join(SyncSite, SyncSite.site_id == SyncGridSite.site_id)
        .filter(SyncGridSite.is_active == True)  # noqa: E712
    )
    for tag in (t.strip() for t in tags.split(",") if t.strip()):
        query = query.filter(SyncSite.site_tags.ilike(f'%"{tag}"%'))
    return query


def get_synced_grids(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    grid_ids: Optional[str] = None,
    tags: Optional[str] = None,
    admin_level: Optional[str] = None,
    group_device_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Read grids from the local sync_grid table.

    When ``group_device_ids`` is provided, only grids whose sites contain
    at least one of the given device IDs are returned.
    """
    safe_skip = max(skip, 0)
    safe_limit = max(limit, 1)

    query = _apply_grid_query_filters(
        db.query(SyncGrid), search, grid_ids, tags, admin_level
    )

    # Group-scoped filtering: keep only grids that have at least one site
    # containing a device from the group's cohorts.
    if group_device_ids is not None:
        matching_grid_ids = (
            db.query(SyncGridSite.grid_id)
            .join(SyncSiteDevice, SyncSiteDevice.site_id == SyncGridSite.site_id)
            .filter(SyncSiteDevice.device_id.in_(group_device_ids))
            .distinct()
        )
        query = query.filter(SyncGrid.grid_id.in_(matching_grid_ids))

    total = query.count()
    grids = query.order_by(SyncGrid.name).offset(safe_skip).limit(safe_limit).all()

    total_pages = max(1, (total + safe_limit - 1) // safe_limit)
    current_page = (safe_skip // safe_limit) + 1
    next_page = (
        f"skip={safe_skip + safe_limit}&limit={safe_limit}"
        if (safe_skip + safe_limit) < total
        else None
    )

    return {
        "success": True,
        "message": "Synced grids fetched successfully",
        "meta": {
            "total": total,
            "totalResults": total,
            "skip": safe_skip,
            "limit": safe_limit,
            "page": current_page,
            "totalPages": total_pages,
            "detailLevel": "local",
            "usedCache": False,
            "nextPage": next_page,
        },
        "grids": [_serialize_grid_scoped(db, g, group_device_ids=group_device_ids) for g in grids],
    }


def get_synced_grid(
    db: Session,
    grid_id: str,
    group_device_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Read a single grid from the local sync_grid table."""
    g = db.query(SyncGrid).filter(SyncGrid.grid_id == grid_id).first()
    if not g:
        return {
            "success": False,
            "message": f"Grid {grid_id} not found in local sync table",
            "status_code": 404,
        }

    serialized_grid = _serialize_grid_scoped(db, g, group_device_ids=group_device_ids)

    if group_device_ids is not None and not serialized_grid.get("sites"):
        return {
            "success": False,
            "message": "Grid not found in group scope",
            "status_code": 404,
        }

    return {
        "success": True,
        "message": "Synced grid fetched successfully",
        "grid": serialized_grid,
    }


# ---------------------------------------------------------------------------
# Performance enrichment for synced-shape grids
# ---------------------------------------------------------------------------

_PER_DEVICE_PERF_KEYS = ("uptime", "data_completeness", "averages")


def _is_airqo_network_id(network_id: Optional[str]) -> bool:
    return (network_id or "").strip().lower() == AIRQO_NETWORK


def _prune_grid_to_airqo_devices(synced_grid: Dict[str, Any]) -> bool:
    """
    Keep only devices whose ``network_id`` is airqo.

    Returns True if the grid still has at least one eligible device.
    """
    filtered_sites: List[Dict[str, Any]] = []
    total_devices = 0

    for site in synced_grid.get("sites", []) or []:
        filtered_devices = [
            dev
            for dev in (site.get("devices", []) or [])
            if _is_airqo_network_id(dev.get("network_id"))
        ]
        if not filtered_devices:
            continue

        site["devices"] = filtered_devices
        site["number_of_devices"] = len(filtered_devices)
        filtered_sites.append(site)
        total_devices += len(filtered_devices)

    synced_grid["sites"] = filtered_sites
    synced_grid["number_of_sites"] = len(filtered_sites)
    return total_devices > 0


def _build_mirror_cohort_from_grid(
    synced_grid: Dict[str, Any],
    device_back_refs: Dict[int, Dict[str, Any]],
) -> Dict[str, Any]:
    """Return a platform-shape cohort mirror for all devices under a grid."""
    mirror_devices: List[Dict[str, Any]] = []
    seen_device_ids = set()
    for site in synced_grid.get("sites", []) or []:
        for synced_dev in site.get("devices", []) or []:
            device_id = synced_dev.get("device_id")
            if not device_id or device_id in seen_device_ids:
                continue
            seen_device_ids.add(device_id)
            mirror_dev = {
                "_id": device_id,
                "name": synced_dev.get("device_name") or device_id,
                "isActive": bool(synced_dev.get("is_active")),
            }
            mirror_devices.append(mirror_dev)
            device_back_refs[id(mirror_dev)] = synced_dev

    return {
        "_id": synced_grid.get("grid_id"),
        "name": synced_grid.get("name"),
        "devices": mirror_devices,
    }


def _copy_grid_perf_back(
    synced_grid: Dict[str, Any], mirror_cohort: Dict[str, Any]
) -> None:
    """Copy grid-level aggregate performance fields from the mirror cohort."""
    synced_grid["uptime"] = mirror_cohort.get("uptime", 0.0)
    synced_grid["data_completeness"] = mirror_cohort.get("data_completeness", 0.0)
    synced_grid["averages"] = mirror_cohort.get("averages", {}) or {}
    synced_grid["data"] = mirror_cohort.get("data", []) or []


def _copy_grid_devices_perf_back(
    mirror_cohort: Dict[str, Any],
    device_back_refs: Dict[int, Dict[str, Any]],
) -> None:
    """Copy per-device performance fields from mirror devices to grid devices."""
    for mirror_dev in mirror_cohort.get("devices", []):
        synced_dev = device_back_refs.get(id(mirror_dev))
        if synced_dev is None:
            continue
        synced_dev["data"] = mirror_dev.get("data", []) or []
        for key in _PER_DEVICE_PERF_KEYS:
            if key in mirror_dev:
                synced_dev[key] = mirror_dev.get(key)


def apply_local_performance_synced_grids(
    grids: List[Dict[str, Any]],
    db: Session,
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
) -> None:
    """
    Enrich synced-shape grids in place with locally-computed performance.

    Grid devices are nested under sites, so this builds a temporary
    platform-shape cohort per grid, applies the existing cohort performance
    pipeline, then copies metrics back to each nested grid device and the grid.
    """
    from app.services import cohort_service  # noqa: WPS433

    if not grids:
        return

    eligible_grids = [g for g in grids if _prune_grid_to_airqo_devices(g)]
    grids[:] = eligible_grids
    if not grids:
        return

    device_back_refs: Dict[int, Dict[str, Any]] = {}
    mirror_cohorts = [
        _build_mirror_cohort_from_grid(synced_grid, device_back_refs)
        for synced_grid in grids
    ]

    cohort_service.apply_local_performance(
        mirror_cohorts, db, start_date_time, end_date_time, frequency=frequency
    )

    for synced_grid, mirror_cohort in zip(grids, mirror_cohorts):
        _copy_grid_perf_back(synced_grid, mirror_cohort)
        _copy_grid_devices_perf_back(mirror_cohort, device_back_refs)

