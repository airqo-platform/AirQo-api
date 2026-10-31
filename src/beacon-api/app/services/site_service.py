import httpx
import json
import logging
import math
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud.crud_sync_device_data import iter_hourly_records_by_channel
from app.models.sync import SyncSite, SyncSiteDevice, SyncDevice
from app.services import cohort_sync_service
from app.services.device_service import AIRQO_NETWORK, upsert_device_to_sync
from app.utils.field_mappings import get_category_mapping
from app.utils.networks import device_source_key

logger = logging.getLogger(__name__)


# Scalar fields to diff (attr_name -> payload_key)
_SITE_SCALAR_FIELDS = [
    ("name", "name"),
    ("latitude", "latitude"),
    ("longitude", "longitude"),
    ("network", "network"),
    ("country", "country"),
    ("city", "city"),
    ("county", "county"),
    ("district", "district"),
    ("region", "region"),
    ("data_provider", "data_provider"),
    ("description", "description"),
    ("generated_name", "generated_name"),
]


def _normalize_list(value) -> str:
    """Stable JSON serialization so string compare == semantic compare."""
    try:
        return json.dumps(value or [], sort_keys=True)
    except TypeError:
        return json.dumps([], sort_keys=True)


def _safe_parse_json_list(raw_value: Optional[str]) -> List[Any]:
    """Parse stored JSON list safely, returning [] for malformed/non-list values."""
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
        return parsed if isinstance(parsed, list) else []
    except (ValueError, TypeError):
        return []


def upsert_site_to_sync(
    db: Session,
    site_data: Dict[str, Any],
    is_authoritative: bool = False,
) -> Tuple[Optional[SyncSite], bool, bool]:
    """
    Centralized logic to upsert/update a SyncSite record from Platform-shaped data.
    Returns (db_site, is_new, is_updated).

    - is_authoritative=True: Trust all fields from the input (used by /sites/sync).
    - is_authoritative=False: Only set missing fields; never overwrite an existing
      value with one from a "thin" payload (e.g. embedded sites under a grid).
    """
    site_id = site_data.get("_id")
    if not site_id:
        return None, False, False

    db_site = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
    is_new = db_site is None
    if is_new:
        db_site = SyncSite(site_id=site_id)
        db.add(db_site)

    changed = False

    for attr, key in _SITE_SCALAR_FIELDS:
        new_val = site_data.get(key)
        current_val = getattr(db_site, attr, None)
        if is_authoritative:
            if current_val != new_val:
                setattr(db_site, attr, new_val)
                changed = True
        else:
            # Non-authoritative: only fill if currently empty and new is provided.
            if current_val in (None, "") and new_val not in (None, ""):
                setattr(db_site, attr, new_val)
                changed = True

    raw_tags = site_data.get("site_tags")
    raw_codes = site_data.get("site_codes")

    if is_authoritative:
        new_tags = _normalize_list(raw_tags or [])
        new_codes = _normalize_list(raw_codes or [])
        existing_tags = _normalize_list(_safe_parse_json_list(db_site.site_tags))
        existing_codes = _normalize_list(_safe_parse_json_list(db_site.site_codes))
        if existing_tags != new_tags:
            db_site.site_tags = new_tags
            changed = True
        if existing_codes != new_codes:
            db_site.site_codes = new_codes
            changed = True
    else:
        if not db_site.site_tags and raw_tags:
            db_site.site_tags = _normalize_list(raw_tags)
            changed = True
        if not db_site.site_codes and raw_codes:
            db_site.site_codes = _normalize_list(raw_codes)
            changed = True

    raw_created = site_data.get("createdAt")
    if raw_created:
        try:
            platform_created = datetime.fromisoformat(raw_created.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            platform_created = None
        if platform_created and db_site.platform_created_at != platform_created:
            if is_authoritative or db_site.platform_created_at is None:
                db_site.platform_created_at = platform_created
                changed = True

    return db_site, is_new, (changed and not is_new)


# ---------------------------------------------------------------------------
# Sync: Platform → Local DB
# ---------------------------------------------------------------------------

async def sync_sites(db: Session, token: str) -> Dict[str, Any]:
    """
    Fetch all sites from the platform API sequentially (page by page),
    upsert into sync_site, and rebuild the sync_site_device junction.

    Embedded devices are backfilled into sync_device non-authoritatively.
    """
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/sites"

    all_sites: List[Dict[str, Any]] = []
    page = 1
    limit = 100

    # --- 1. Fetch all pages sequentially ---
    actual_limit = limit  # Will be overridden by platform's actual limit after first response
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        while True:
            params = {"limit": limit, "skip": (page - 1) * actual_limit}
            logger.info(f"[Site Sync] Fetching page {page} (skip={params['skip']})...")

            try:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code != 200:
                    error_body = ""
                    try:
                        error_body = response.text
                    except Exception:
                        error_body = "<unavailable>"
                    logger.error(
                        f"[Site Sync] Platform API error on page {page}: "
                        f"{response.status_code} - {error_body}"
                    )
                    return {
                        "success": False,
                        "message": (
                            f"Platform API returned HTTP {response.status_code} "
                            f"on page {page}"
                        ),
                        "status_code": response.status_code,
                        "page": page,
                        "error": error_body,
                        "sites_synced": 0,
                        "devices_backfilled": 0,
                    }

                data = response.json()
                sites_page = data.get("sites", [])
                all_sites.extend(sites_page)

                meta = data.get("meta", {})
                total_pages = meta.get("totalPages", 1)
                # Use the platform's actual limit for skip calculations
                actual_limit = meta.get("limit", limit)

                logger.info(
                    f"[Site Sync] Page {page}/{total_pages}: "
                    f"got {len(sites_page)} sites (total so far: {len(all_sites)}, "
                    f"platform limit: {actual_limit})"
                )

                if page >= total_pages:
                    break
                page += 1

            except Exception as e:
                logger.error(f"[Site Sync] Error fetching page {page}: {e}")
                return {
                    "success": False,
                    "message": f"Platform API request failed on page {page}",
                    "page": page,
                    "error": str(e),
                    "sites_synced": 0,
                    "devices_backfilled": 0,
                }

    if not all_sites:
        return {
            "success": True,
            "message": "No sites found on platform",
            "sites_synced": 0,
            "devices_backfilled": 0,
        }

    # --- 2. Upsert sites and rebuild junction table ---
    sites_new = 0
    sites_updated = 0
    sites_unchanged = 0
    devices_backfilled = 0

    def _normalize_list(value) -> str:
        """Stable JSON serialization so string compare == semantic compare."""
        try:
            return json.dumps(value or [], sort_keys=True)
        except TypeError:
            return json.dumps([], sort_keys=True)

    # Scalar fields to diff (attr_name -> payload_key)
    scalar_fields = [
        ("name", "name"),
        ("latitude", "latitude"),
        ("longitude", "longitude"),
        ("network", "network"),
        ("country", "country"),
        ("city", "city"),
        ("county", "county"),
        ("district", "district"),
        ("region", "region"),
        ("data_provider", "data_provider"),
        ("description", "description"),
        ("generated_name", "generated_name"),
    ]

    for site_data in all_sites:
        site_id = site_data.get("_id")
        if not site_id:
            continue

        try:
            # Parse platform createdAt
            platform_created = None
            raw_created = site_data.get("createdAt")
            if raw_created:
                try:
                    platform_created = datetime.fromisoformat(raw_created.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

            # Upsert the site record
            db_site = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
            is_new = db_site is None
            if is_new:
                db_site = SyncSite(site_id=site_id)
                db.add(db_site)

            # Diff scalar fields
            site_field_changed = False
            for attr, key in scalar_fields:
                new_val = site_data.get(key)
                if getattr(db_site, attr) != new_val:
                    setattr(db_site, attr, new_val)
                    site_field_changed = True

            new_tags = _normalize_list(site_data.get("site_tags", []))
            new_codes = _normalize_list(site_data.get("site_codes", []))
            existing_tags = _normalize_list(json.loads(db_site.site_tags)) if db_site.site_tags else _normalize_list([])
            existing_codes = _normalize_list(json.loads(db_site.site_codes)) if db_site.site_codes else _normalize_list([])
            if existing_tags != new_tags:
                db_site.site_tags = new_tags
                site_field_changed = True
            if existing_codes != new_codes:
                db_site.site_codes = new_codes
                site_field_changed = True
            if platform_created and db_site.platform_created_at != platform_created:
                db_site.platform_created_at = platform_created
                site_field_changed = True

            # --- Junction diff ---
            desired: Dict[str, bool] = {}
            for dev in site_data.get("devices", []):
                device_id = dev.get("_id")
                if not device_id:
                    continue
                desired[device_id] = bool(dev.get("isActive", False))

                # Non-authoritative backfill into sync_device
                _, dev_is_new, _ = upsert_device_to_sync(db, dev, is_authoritative=False)
                if dev_is_new:
                    devices_backfilled += 1

            db.flush()

            existing_rows = (
                db.query(SyncSiteDevice)
                .filter(SyncSiteDevice.site_id == site_id)
                .all()
            )
            existing: Dict[str, SyncSiteDevice] = {r.device_id: r for r in existing_rows}

            junction_changed = False

            for dev_id, row in existing.items():
                if dev_id not in desired:
                    db.delete(row)
                    junction_changed = True

            for dev_id, is_active in desired.items():
                row = existing.get(dev_id)
                if row is None:
                    db.add(SyncSiteDevice(
                        site_id=site_id,
                        device_id=dev_id,
                        is_active=is_active,
                    ))
                    junction_changed = True
                elif bool(row.is_active) != is_active:
                    row.is_active = is_active
                    junction_changed = True

            if is_new:
                sites_new += 1
            elif site_field_changed or junction_changed:
                sites_updated += 1
            else:
                sites_unchanged += 1

            # Commit in batches
            if (sites_new + sites_updated) % 20 == 0:
                db.commit()

        except Exception as e:
            logger.error(f"[Site Sync] Error syncing site {site_id}: {e}")
            db.rollback()

    db.commit()

    total_synced = sites_new + sites_updated + sites_unchanged
    logger.info(
        f"[Site Sync] Done — {total_synced} sites processed "
        f"({sites_new} new, {sites_updated} updated, {sites_unchanged} unchanged), "
        f"{devices_backfilled} devices backfilled"
    )

    return {
        "success": True,
        "message": (
            f"Processed {total_synced} sites: {sites_new} new, "
            f"{sites_updated} updated, {sites_unchanged} unchanged. "
            f"{devices_backfilled} new devices backfilled."
        ),
        "sites_synced": sites_new + sites_updated,
        "sites_new": sites_new,
        "sites_updated": sites_updated,
        "sites_unchanged": sites_unchanged,
        "devices_backfilled": devices_backfilled,
    }


# ---------------------------------------------------------------------------
# Read: Local DB (source of truth)
# ---------------------------------------------------------------------------

def _site_device_junction_query(
    db: Session,
    group_device_ids: Optional[List[str]] = None,
    airqo_only: bool = False,
):
    """Return a SyncSiteDevice query scoped to the group's devices and, optionally, airqo devices."""
    query = db.query(SyncSiteDevice)
    if group_device_ids is not None:
        query = query.filter(SyncSiteDevice.device_id.in_(group_device_ids))
    if airqo_only:
        query = (
            query.join(SyncDevice, SyncDevice.device_id == SyncSiteDevice.device_id)
            .filter(func.lower(SyncDevice.network_id) == AIRQO_NETWORK)
        )
    return query


def _build_site_devices(
    db: Session,
    site_ids: List[str],
    group_device_ids: Optional[List[str]] = None,
    airqo_only: bool = False,
) -> Dict[str, List[Dict[str, Any]]]:
    """Return junction-derived device dicts keyed by site_id."""
    devices_by_site: Dict[str, List[Dict[str, Any]]] = {sid: [] for sid in site_ids}
    if not site_ids:
        return devices_by_site

    junctions = (
        _site_device_junction_query(db, group_device_ids, airqo_only)
        .filter(SyncSiteDevice.site_id.in_(site_ids))
        .all()
    )

    # Batch-fetch all SyncDevice rows referenced by these junctions to
    # avoid an N+1 query (one SyncDevice lookup per junction).
    device_ids = {j.device_id for j in junctions if j.device_id}
    device_name_by_id: Dict[str, Optional[str]] = {}
    if device_ids:
        sync_devs = (
            db.query(SyncDevice)
            .filter(SyncDevice.device_id.in_(device_ids))
            .all()
        )
        device_name_by_id = {sd.device_id: sd.device_name for sd in sync_devs}

    for j in junctions:
        devices_by_site[j.site_id].append({
            "device_id": j.device_id,
            # Falls back to None if the referenced SyncDevice row is missing.
            "device_name": device_name_by_id.get(j.device_id),
            "is_active": j.is_active or False,
        })
    return devices_by_site


def _serialize_site(s: SyncSite, devices: List[Dict[str, Any]]) -> Dict[str, Any]:
    return {
        "site_id": s.site_id,
        "name": s.name,
        "latitude": s.latitude,
        "longitude": s.longitude,
        "network": s.network,
        "country": s.country,
        "city": s.city,
        "county": s.county,
        "district": s.district,
        "region": s.region,
        "data_provider": s.data_provider,
        "description": s.description,
        "generated_name": s.generated_name,
        "site_tags": json.loads(s.site_tags) if s.site_tags else [],
        "site_codes": json.loads(s.site_codes) if s.site_codes else [],
        "number_of_devices": len(devices),
        "devices": devices,
    }


def get_sites(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    group_device_ids: Optional[List[str]] = None,
    airqo_only: bool = False,
) -> Dict[str, Any]:
    """Read sites from the local sync_site table.

    When ``group_device_ids`` is provided, only sites containing at least one
    of those devices are returned, and each site lists only those devices.
    ``airqo_only`` applies the same narrowing to devices on the airqo network.
    """
    query = db.query(SyncSite)

    if search:
        query = query.filter(SyncSite.name.ilike(f"%{search}%"))

    if group_device_ids is not None or airqo_only:
        matching_site_ids = (
            _site_device_junction_query(db, group_device_ids, airqo_only)
            .with_entities(SyncSiteDevice.site_id)
            .distinct()
        )
        query = query.filter(SyncSite.site_id.in_(matching_site_ids))

    total = query.count()
    sites = query.order_by(SyncSite.name).offset(skip).limit(limit).all()

    devices_by_site = _build_site_devices(
        db, [s.site_id for s in sites], group_device_ids, airqo_only
    )

    return {
        "success": True,
        "message": "Synced sites fetched successfully",
        "meta": {"total": total, "skip": skip, "limit": limit},
        "sites": [_serialize_site(s, devices_by_site[s.site_id]) for s in sites],
    }


def get_site(
    db: Session,
    site_id: str,
    group_device_ids: Optional[List[str]] = None,
    airqo_only: bool = False,
) -> Dict[str, Any]:
    """Read a single site from the local sync_site table."""
    s = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
    if not s:
        return {
            "success": False,
            "message": f"Site {site_id} not found in local sync table",
            "status_code": 404,
        }

    devices = _build_site_devices(db, [s.site_id], group_device_ids, airqo_only)[s.site_id]

    if group_device_ids is not None and not devices:
        return {
            "success": False,
            "message": "Site not found in group scope",
            "status_code": 404,
        }
    if airqo_only and not devices:
        return {
            "success": False,
            "message": (
                f"Site {site_id} has no devices with network_id '{AIRQO_NETWORK}' "
                "for includePerformance"
            ),
            "status_code": 404,
        }

    return {
        "success": True,
        "message": "Synced site fetched successfully",
        "site": _serialize_site(s, devices),
    }


# ---------------------------------------------------------------------------
# Performance enrichment for synced-shape sites
# ---------------------------------------------------------------------------

def apply_local_performance_synced_sites(
    sites: List[Dict[str, Any]],
    db: Session,
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
) -> None:
    """
    Enrich synced-shape sites in place with locally-computed performance.

    A site carries the same ``devices`` shape as a synced cohort
    (``device_id`` / ``device_name`` / ``is_active``), so the cohort pipeline
    is reused unchanged: each device gets ``data`` / ``uptime`` /
    ``data_completeness`` / ``averages``, and each site gets the same fields
    averaged across its devices.
    """
    cohort_sync_service.apply_local_performance_synced(
        sites, db, start_date_time, end_date_time, frequency=frequency
    )


# ---------------------------------------------------------------------------
# Performance summary across all of a group's sites
# ---------------------------------------------------------------------------

# The data pipeline treats PM2.5 outside this range as invalid (airqo_etl_utils config)
PM2_5_VALID_RANGE = (0.0, 1000.0)


def _is_reading(value: Any) -> bool:
    """A PM2.5 value inside the valid range; a corrupt reading such as -1.3e24 would swamp any average."""
    if not isinstance(value, (int, float)) or isinstance(value, bool) or math.isnan(value):
        return False
    low, high = PM2_5_VALID_RANGE
    return low <= value <= high


def _mean_or_none(values: List[float]) -> Optional[float]:
    return sum(values) / len(values) if values else None


def _round_or_none(value: Optional[float], digits: int = 4) -> Optional[float]:
    return None if value is None else round(value, digits)


def _pearson(xs: List[float], ys: List[float]) -> Optional[float]:
    """Pearson correlation of two equal-length series; None without two points or any variance."""
    n = len(xs)
    if n < 2:
        return None
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = den_x = den_y = 0.0
    for x, y in zip(xs, ys):
        dx, dy = x - mean_x, y - mean_y
        num += dx * dy
        den_x += dx * dx
        den_y += dy * dy
    if den_x == 0 or den_y == 0:
        return None
    return num / math.sqrt(den_x * den_y)


def _sensor_agreement(records: List[Dict[str, Any]]) -> Tuple[Optional[float], Optional[float]]:
    """
    One device's PM2.5 sensor 1 vs sensor 2 agreement as ``(error_margin, correlation)``.

    Readings are grouped by UTC day; the error margin is the mean of each day's mean
    ``|sensor1 - sensor2|`` and the correlation the mean of each day's Pearson correlation,
    which is how the Performance Analysis table summarises a device. Both are None for a
    device without readings from both sensors.
    """
    pairs_by_day: Dict[str, Tuple[List[float], List[float]]] = {}
    for record in records:
        s1 = record.get("pm2.5 sensor1")
        s2 = record.get("pm2.5 sensor2")
        dt_str = record.get("datetime")
        if not dt_str or not _is_reading(s1) or not _is_reading(s2):
            continue
        try:
            dt = datetime.fromisoformat(str(dt_str).replace("Z", "+00:00"))
        except ValueError:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        day = dt.astimezone(timezone.utc).date().isoformat()
        s1_values, s2_values = pairs_by_day.setdefault(day, ([], []))
        s1_values.append(float(s1))
        s2_values.append(float(s2))

    daily_margins: List[float] = []
    daily_correlations: List[float] = []
    for s1_values, s2_values in pairs_by_day.values():
        daily_margins.append(sum(abs(a - b) for a, b in zip(s1_values, s2_values)) / len(s1_values))
        correlation = _pearson(s1_values, s2_values)
        if correlation is not None:
            daily_correlations.append(correlation)
    return _mean_or_none(daily_margins), _mean_or_none(daily_correlations)


def _pm25_sensor_fields(category: Optional[str]) -> Optional[Tuple[str, str]]:
    """The fields an airqo device of ``category`` reports PM2.5 sensor 1 and 2 in, if it has both."""
    field_by_label = {label: field for field, label in get_category_mapping(category).items()}
    sensor1, sensor2 = field_by_label.get("pm2.5 sensor1"), field_by_label.get("pm2.5 sensor2")
    return (sensor1, sensor2) if sensor1 and sensor2 else None


def get_sites_performance_summary(
    db: Session,
    start_date_time: str,
    end_date_time: str,
    group_device_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Roll up the hourly performance of every device at the sites to single values.

    Covers the sites and devices ``GET /sites/?includePerformance=true`` lists (airqo
    devices, scoped to the group when ``group_device_ids`` is given) across all its pages,
    counting each device once even when it has moved between sites. Uptime is the mean of
    the devices' uptime; error margin and correlation are means over the devices that have
    readings from both PM2.5 sensors.

    Devices are told apart by id, not name: names are not unique, so a lookup by name could
    take in the readings of a same-named device outside the group. Readings are rolled up a
    channel at a time, so only one device's hourly rows are held at once.
    """
    # Local import, as in cohort_sync_service, to avoid a circular import at load time
    from app.services import cohort_service

    junctions = _site_device_junction_query(db, group_device_ids, airqo_only=True).all()
    site_ids = {j.site_id for j in junctions}
    device_ids = {j.device_id for j in junctions if j.device_id}

    # Readings are stored by channel: the ThingSpeak channel number for airqo devices
    device_ids_by_channel: Dict[str, List[str]] = {}
    sensor_fields: Dict[str, Optional[Tuple[str, str]]] = {}
    if device_ids:
        devices = db.query(
            SyncDevice.device_id, SyncDevice.device_number, SyncDevice.network_id, SyncDevice.category,
        ).filter(SyncDevice.device_id.in_(device_ids))
        for device in devices:
            sensor_fields[device.device_id] = _pm25_sensor_fields(device.category)
            channel = device_source_key(device.network_id, device.device_id, device.device_number)
            if channel:
                device_ids_by_channel.setdefault(channel, []).append(device.device_id)

    uptime_by_device: Dict[str, float] = {}
    error_margins: List[float] = []
    correlations: List[float] = []
    fields = {field for pair in sensor_fields.values() if pair for field in pair}
    channel_records = iter_hourly_records_by_channel(
        db, device_ids_by_channel, start_date_time, end_date_time, fields,
    )
    for channel, records in channel_records:
        # Counted as compute_device_performance counts it, so the summary matches the sites list
        uptime = cohort_service._compute_uptime(records, start_date_time, end_date_time, "hourly")
        for device_id in device_ids_by_channel.get(channel, []):
            uptime_by_device[device_id] = uptime
            pair = sensor_fields.get(device_id)
            if pair is None:
                continue
            sensor1, sensor2 = pair
            error_margin, correlation = _sensor_agreement([
                {"datetime": r["datetime"], "pm2.5 sensor1": r.get(sensor1), "pm2.5 sensor2": r.get(sensor2)}
                for r in records
            ])
            if error_margin is not None:
                error_margins.append(error_margin)
            if correlation is not None:
                correlations.append(correlation)

    uptimes = [uptime_by_device.get(device_id, 0.0) for device_id in device_ids]

    return {
        "total_sites": len(site_ids),
        "total_devices": len(device_ids),
        "uptime": _round_or_none(_mean_or_none(uptimes), 2),
        "error_margin": _round_or_none(_mean_or_none(error_margins)),
        "error_margin_devices": len(error_margins),
        "correlation": _round_or_none(_mean_or_none(correlations)),
        "correlation_devices": len(correlations),
        "start_date_time": start_date_time,
        "end_date_time": end_date_time,
    }
