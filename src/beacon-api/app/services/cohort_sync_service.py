import httpx
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sync import SyncCohort, SyncCohortDevice, SyncDevice
from app.services.device_service import upsert_device_to_sync

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _normalize_tags(value) -> str:
    """Stable JSON serialization so string compare == semantic compare."""
    try:
        return json.dumps(value or [], sort_keys=True)
    except TypeError:
        return json.dumps([], sort_keys=True)


def _parse_platform_created(raw_created: Optional[str]) -> Optional[datetime]:
    """Parse an ISO datetime string from the platform; return None on failure."""
    if not raw_created:
        return None
    try:
        return datetime.fromisoformat(raw_created.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


async def _fetch_cohort_page(
    client: httpx.AsyncClient,
    url: str,
    headers: Dict[str, str],
    page: int,
    skip: int,
    limit: int,
) -> Optional[Dict[str, Any]]:
    """Fetch a single page of cohorts. Returns parsed JSON or None on error."""
    params = {"limit": limit, "skip": skip}
    logger.info(f"[Cohort Sync] Fetching page {page} (skip={skip})...")
    response = await client.get(url, headers=headers, params=params)
    if response.status_code != 200:
        logger.error(f"[Cohort Sync] Platform API error on page {page}: {response.status_code}")
        return None
    return response.json()


async def _fetch_all_cohorts(token: str, limit: int = 100) -> List[Dict[str, Any]]:
    """Fetch all cohorts from the platform across paginated requests."""
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts"

    all_cohorts: List[Dict[str, Any]] = []
    page = 1
    actual_limit = limit  # Overridden after the first response

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        while True:
            try:
                data = await _fetch_cohort_page(
                    client, url, headers, page, (page - 1) * actual_limit, limit
                )
            except Exception as e:  # noqa: BLE001
                logger.error(f"[Cohort Sync] Error fetching page {page}: {e}")
                break

            if data is None:
                break

            cohorts_page = data.get("cohorts", [])
            all_cohorts.extend(cohorts_page)

            meta = data.get("meta", {})
            total_pages = meta.get("totalPages", 1)
            actual_limit = meta.get("limit", limit)

            logger.info(
                f"[Cohort Sync] Page {page}/{total_pages}: "
                f"got {len(cohorts_page)} cohorts (total so far: {len(all_cohorts)}, "
                f"platform limit: {actual_limit})"
            )

            if page >= total_pages:
                break
            page += 1

    return all_cohorts


def _apply_cohort_scalars(db_cohort: SyncCohort, cohort_data: Dict[str, Any]) -> bool:
    """Update scalar fields on a SyncCohort. Returns True if anything changed."""
    new_tags = _normalize_tags(cohort_data.get("cohort_tags", []))
    new_codes = _normalize_tags(cohort_data.get("cohort_codes", []))
    existing_tags = (
        _normalize_tags(json.loads(db_cohort.cohort_tags))
        if db_cohort.cohort_tags else _normalize_tags([])
    )
    existing_codes = (
        _normalize_tags(json.loads(db_cohort.cohort_codes))
        if db_cohort.cohort_codes else _normalize_tags([])
    )
    platform_created = _parse_platform_created(cohort_data.get("createdAt"))

    updates = [
        ("name", cohort_data.get("name"), db_cohort.name),
        ("network", cohort_data.get("network"), db_cohort.network),
        ("visibility", bool(cohort_data.get("visibility", False)), bool(db_cohort.visibility)),
        ("cohort_tags", new_tags, existing_tags),
        ("cohort_codes", new_codes, existing_codes),
        ("number_of_devices", cohort_data.get("numberOfDevices", 0) or 0,
         db_cohort.number_of_devices or 0),
    ]

    changed = False
    for attr, new_val, current_val in updates:
        if current_val != new_val:
            setattr(db_cohort, attr, new_val)
            changed = True

    if platform_created and db_cohort.platform_created_at != platform_created:
        db_cohort.platform_created_at = platform_created
        changed = True

    return changed


def _build_desired_devices(
    db: Session, cohort_devices: List[Dict[str, Any]]
) -> Tuple[Dict[str, bool], int]:
    """Build {device_id: is_active} from the platform payload, backfilling sync_device."""
    desired: Dict[str, bool] = {}
    backfilled = 0
    for dev in cohort_devices:
        device_id = dev.get("_id")
        if not device_id:
            continue
        desired[device_id] = bool(dev.get("isActive", False))

        _, dev_is_new, _ = upsert_device_to_sync(db, dev, is_authoritative=False)
        if dev_is_new:
            backfilled += 1
    return desired, backfilled


def _sync_cohort_junctions(
    db: Session, cohort_id: str, desired: Dict[str, bool]
) -> bool:
    """Reconcile sync_cohort_device rows against the desired set. Returns True if changed."""
    existing_rows = (
        db.query(SyncCohortDevice)
        .filter(SyncCohortDevice.cohort_id == cohort_id)
        .all()
    )
    existing: Dict[str, SyncCohortDevice] = {r.device_id: r for r in existing_rows}
    changed = False

    for dev_id, row in existing.items():
        if dev_id not in desired:
            db.delete(row)
            changed = True

    for dev_id, is_active in desired.items():
        row = existing.get(dev_id)
        if row is None:
            db.add(SyncCohortDevice(
                cohort_id=cohort_id, device_id=dev_id, is_active=is_active,
            ))
            changed = True
        elif bool(row.is_active) != is_active:
            row.is_active = is_active
            changed = True

    return changed


def _upsert_single_cohort(
    db: Session, cohort_data: Dict[str, Any]
) -> Optional[Tuple[str, int]]:
    """
    Upsert one cohort and reconcile its devices.

    Returns (status, backfilled_count) where status is one of
    'new' | 'updated' | 'unchanged', or None if the cohort had no id.
    """
    cohort_id = cohort_data.get("_id")
    if not cohort_id:
        return None

    db_cohort = db.query(SyncCohort).filter(SyncCohort.cohort_id == cohort_id).first()
    is_new = db_cohort is None
    if is_new:
        db_cohort = SyncCohort(cohort_id=cohort_id)
        db.add(db_cohort)

    cohort_field_changed = _apply_cohort_scalars(db_cohort, cohort_data)
    desired, backfilled = _build_desired_devices(db, cohort_data.get("devices", []))
    junction_changed = _sync_cohort_junctions(db, cohort_id, desired)

    if is_new:
        status = "new"
    elif cohort_field_changed or junction_changed:
        status = "updated"
    else:
        status = "unchanged"
    return status, backfilled


# ---------------------------------------------------------------------------
# Sync: Platform → Local DB
# ---------------------------------------------------------------------------

async def sync_cohorts(db: Session, token: str) -> Dict[str, Any]:
    """
    Fetch all cohorts from the platform API sequentially (page by page),
    upsert into sync_cohort, and rebuild the sync_cohort_device junction.

    Embedded devices are backfilled into sync_device non-authoritatively.
    """
    all_cohorts = await _fetch_all_cohorts(token)

    if not all_cohorts:
        return {
            "success": True,
            "message": "No cohorts found on platform",
            "cohorts_synced": 0,
            "devices_backfilled": 0,
        }

    counts = {"new": 0, "updated": 0, "unchanged": 0}
    devices_backfilled = 0

    for cohort_data in all_cohorts:
        try:
            result = _upsert_single_cohort(db, cohort_data)
            if result is None:
                continue
            status, backfilled = result
            counts[status] += 1
            devices_backfilled += backfilled

            # Commit in batches
            if (counts["new"] + counts["updated"]) % 20 == 0:
                db.commit()
        except Exception as e:  # noqa: BLE001
            logger.error(
                f"[Cohort Sync] Error syncing cohort {cohort_data.get('_id')}: {e}"
            )
            db.rollback()

    db.commit()

    total_synced = counts["new"] + counts["updated"] + counts["unchanged"]
    logger.info(
        f"[Cohort Sync] Done — {total_synced} cohorts processed "
        f"({counts['new']} new, {counts['updated']} updated, {counts['unchanged']} unchanged), "
        f"{devices_backfilled} devices backfilled"
    )

    return {
        "success": True,
        "message": (
            f"Processed {total_synced} cohorts: {counts['new']} new, "
            f"{counts['updated']} updated, {counts['unchanged']} unchanged. "
            f"{devices_backfilled} new devices backfilled."
        ),
        "cohorts_synced": counts["new"] + counts["updated"],
        "cohorts_new": counts["new"],
        "cohorts_updated": counts["updated"],
        "cohorts_unchanged": counts["unchanged"],
        "devices_backfilled": devices_backfilled,
    }


# ---------------------------------------------------------------------------
# Read: Local DB (source of truth)
# ---------------------------------------------------------------------------

def _build_cohort_devices(db: Session, cohort_id: str) -> List[Dict[str, Any]]:
    """Return junction-derived device dicts for a single cohort."""
    junctions = (
        db.query(SyncCohortDevice)
        .filter(SyncCohortDevice.cohort_id == cohort_id)
        .all()
    )
    devices = []
    for j in junctions:
        sync_dev = (
            db.query(SyncDevice).filter(SyncDevice.device_id == j.device_id).first()
        )
        devices.append({
            "device_id": j.device_id,
            "device_name": sync_dev.device_name if sync_dev else None,
            "is_active": j.is_active or False,
        })
    return devices


def _serialize_cohort(db: Session, c: SyncCohort) -> Dict[str, Any]:
    """Serialize a SyncCohort plus its devices into the public dict shape."""
    return {
        "cohort_id": c.cohort_id,
        "name": c.name,
        "network": c.network,
        "visibility": c.visibility,
        "cohort_tags": json.loads(c.cohort_tags) if c.cohort_tags else [],
        "cohort_codes": json.loads(c.cohort_codes) if c.cohort_codes else [],
        "number_of_devices": c.number_of_devices or 0,
        "devices": _build_cohort_devices(db, c.cohort_id),
    }


def _apply_cohort_query_filters(
    query,
    search: Optional[str],
    cohort_ids: Optional[str],
    tags: Optional[str],
):
    """Apply optional filters to a SyncCohort query."""
    if cohort_ids:
        ids = [cid.strip() for cid in cohort_ids.split(",") if cid.strip()]
        if ids:
            query = query.filter(SyncCohort.cohort_id.in_(ids))

    if search:
        query = query.filter(SyncCohort.name.ilike(f"%{search}%"))

    if tags:
        for t in (t.strip() for t in tags.split(",") if t.strip()):
            # cohort_tags is JSON-serialized; substring-match against the JSON text.
            query = query.filter(SyncCohort.cohort_tags.ilike(f'%"{t}"%'))

    return query


def get_synced_cohorts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    cohort_ids: Optional[str] = None,
    tags: Optional[str] = None,
) -> Dict[str, Any]:
    """Read cohorts from the local sync_cohort table."""
    query = _apply_cohort_query_filters(
        db.query(SyncCohort), search, cohort_ids, tags
    )

    total = query.count()
    cohorts = query.order_by(SyncCohort.name).offset(skip).limit(limit).all()

    return {
        "success": True,
        "message": "Synced cohorts fetched successfully",
        "meta": {"total": total, "skip": skip, "limit": limit},
        "cohorts": [_serialize_cohort(db, c) for c in cohorts],
    }


def get_synced_cohort(db: Session, cohort_id: str) -> Dict[str, Any]:
    """Read a single cohort from the local sync_cohort table."""
    c = db.query(SyncCohort).filter(SyncCohort.cohort_id == cohort_id).first()
    if not c:
        return {
            "success": False,
            "message": f"Cohort {cohort_id} not found in local sync table",
            "status_code": 404,
        }

    return {
        "success": True,
        "message": "Synced cohort fetched successfully",
        "cohort": _serialize_cohort(db, c),
    }


# ---------------------------------------------------------------------------
# Performance enrichment for synced-shape cohorts
# ---------------------------------------------------------------------------

_PER_DEVICE_PERF_KEYS = ("uptime", "data_completeness", "averages")


def _build_mirror_cohort(
    synced_cohort: Dict[str, Any],
    device_back_refs: Dict[int, Dict[str, Any]],
) -> Dict[str, Any]:
    """Return a platform-shape mirror of a synced cohort, recording back-refs."""
    mirror_devices: List[Dict[str, Any]] = []
    for synced_dev in synced_cohort.get("devices", []) or []:
        mirror_dev = {
            "_id": synced_dev.get("device_id"),
            "name": synced_dev.get("device_name") or synced_dev.get("device_id"),
            "isActive": bool(synced_dev.get("is_active")),
        }
        mirror_devices.append(mirror_dev)
        device_back_refs[id(mirror_dev)] = synced_dev

    return {
        "_id": synced_cohort.get("cohort_id"),
        "name": synced_cohort.get("name"),
        "devices": mirror_devices,
    }


def _copy_cohort_perf_back(
    synced_cohort: Dict[str, Any], mirror_cohort: Dict[str, Any]
) -> None:
    """Copy cohort-level performance fields from mirror back to synced dict."""
    synced_cohort["uptime"] = mirror_cohort.get("uptime", 0.0)
    synced_cohort["data_completeness"] = mirror_cohort.get("data_completeness", 0.0)
    synced_cohort["averages"] = mirror_cohort.get("averages", {}) or {}
    synced_cohort["data"] = mirror_cohort.get("data", []) or []


def _copy_devices_perf_back(
    mirror_cohort: Dict[str, Any],
    device_back_refs: Dict[int, Dict[str, Any]],
) -> None:
    """Copy per-device performance fields from mirror devices back to synced devices."""
    for mirror_dev in mirror_cohort.get("devices", []):
        synced_dev = device_back_refs.get(id(mirror_dev))
        if synced_dev is None:
            continue
        synced_dev["data"] = mirror_dev.get("data", []) or []
        for key in _PER_DEVICE_PERF_KEYS:
            if key in mirror_dev:
                synced_dev[key] = mirror_dev.get(key)


def apply_local_performance_synced(
    cohorts: List[Dict[str, Any]],
    db: Session,
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
) -> None:
    """
    Enrich synced-shape cohorts in place with locally-computed performance.

    Synced shape uses ``device_name`` / ``is_active`` (vs. the platform shape's
    ``name`` / ``isActive``). We build a temporary platform-shape mirror, hand
    it to ``cohort_service.apply_local_performance``, then copy the resulting
    ``data`` / ``uptime`` / ``data_completeness`` / ``averages`` fields back
    onto the original synced dicts.
    """
    # Local import to avoid a circular import at module load time.
    from app.services import cohort_service  # noqa: WPS433

    if not cohorts:
        return

    device_back_refs: Dict[int, Dict[str, Any]] = {}  # id(mirror_dev) -> synced_dev
    mirror_cohorts = [
        _build_mirror_cohort(synced_cohort, device_back_refs)
        for synced_cohort in cohorts
    ]

    cohort_service.apply_local_performance(
        mirror_cohorts, db, start_date_time, end_date_time, frequency=frequency
    )

    for synced_cohort, mirror_cohort in zip(cohorts, mirror_cohorts):
        _copy_cohort_perf_back(synced_cohort, mirror_cohort)
        _copy_devices_perf_back(mirror_cohort, device_back_refs)
