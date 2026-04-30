import httpx
import logging
import asyncio
from typing import Dict, Any, List, Tuple, Optional
from app.core.config import settings
from collections import defaultdict
from sqlalchemy.orm import Session
from app.models.sync import SyncDevice
from app.services import cohort_service

logger = logging.getLogger(__name__)

def _ensure_timezone(dt_str: Optional[str]) -> Optional[str]:
    """Ensures that the date string is timezone-aware as required by Platform API."""
    if not dt_str:
        return dt_str
    if "Z" not in dt_str and "+" not in dt_str:
        # If it's just a date or date-time without timezone
        if "T" not in dt_str:
            return f"{dt_str}T00:00:00Z"
        return f"{dt_str}Z"
    return dt_str

async def get_collocation_sites(token: str, db: Session, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    List collocation sites entirely from local tables.

    A "collocation site" is any site that hosts at least one BAM device.
    For each such site we return every device at that site (BAM + lowcost),
    pulled from `sync_site` joined with `sync_site_device` and `sync_device`.

    The ``token`` argument is kept for signature compatibility with previous
    callers; it is no longer used.
    """
    _ = token  # local-only path; token unused
    if params is None:
        params = {}

    skip = int(params.get("skip", 0) or 0)
    limit = int(params.get("limit", 100) or 100)
    from app.models.sync import SyncSite, SyncSiteDevice

    # 1. Find every site_id that has at least one ACTIVE BAM device.
    bam_site_ids_q = (
        db.query(SyncSiteDevice.site_id)
        .join(SyncDevice, SyncDevice.device_id == SyncSiteDevice.device_id)
        .filter(
            SyncDevice.category == "bam",
            SyncSiteDevice.is_active.is_(True),
        )
        .distinct()
    )
    bam_site_ids = [row[0] for row in bam_site_ids_q.all() if row[0]]

    if not bam_site_ids:
        return {
            "success": True,
            "message": "No collocation sites found",
            "sites": [],
            "meta": {"skip": skip, "limit": limit, "total": 0},
        }

    # 2. Pull site metadata (paginated, alphabetical for stable ordering).
    sites_q = (
        db.query(SyncSite)
        .filter(SyncSite.site_id.in_(bam_site_ids))
        .order_by(SyncSite.name.asc(), SyncSite.site_id.asc())
    )
    total = sites_q.count()
    page_sites = sites_q.offset(skip).limit(limit).all()
    page_site_ids = [s.site_id for s in page_sites]

    # 3. Pull every device at those sites in one query.
    devices_rows = []
    if page_site_ids:
        devices_rows = (
            db.query(SyncSiteDevice, SyncDevice)
            .join(SyncDevice, SyncDevice.device_id == SyncSiteDevice.device_id)
            .filter(SyncSiteDevice.site_id.in_(page_site_ids))
            .all()
        )

    devices_by_site: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for link, dev in devices_rows:
        devices_by_site[link.site_id].append({
            "device_id": dev.device_id,
            "device_name": dev.device_name,
            "category": dev.category or "lowcost",
            "isActive": bool(link.is_active),
        })

    # 4. Build response shape (matches the previous platform-derived layout).
    sites_list: List[Dict[str, Any]] = []
    for s in page_sites:
        infos = devices_by_site.get(s.site_id, [])
        sites_list.append({
            "_id": s.site_id,
            "name": s.name or "",
            "formatted_name": s.generated_name,
            "parish": None,
            "city": s.city,
            "district": s.district,
            "country": s.country,
            "approximate_latitude": s.latitude,
            "approximate_longitude": s.longitude,
            "network": s.network,
            "numberOfDevices": len(infos),
            "devices_info": infos,
            "uptime": 0.0,
            "error_margin": 0.0,
            "devices": [],
            "data": [],
        })

    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    current_page = (skip // limit) + 1 if limit > 0 else 1
    return {
        "success": True,
        "message": "Sites fetched successfully",
        "sites": sites_list,
        "meta": {
            "skip": skip,
            "limit": limit,
            "total": total,
            "totalResults": total,
            "page": current_page,
            "totalPages": total_pages,
        },
    }



def _default_window(start_date_time: Optional[str], end_date_time: Optional[str], default_days: int = 7):
    """Return ISO start/end strings, defaulting to the last `default_days`."""
    from datetime import datetime as _dt, timedelta, timezone as _tz
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    if start_date_time and end_date_time:
        return start_date_time, end_date_time
    end_dt = _dt.now(tz=_tz.utc)
    start_dt = end_dt - timedelta(days=default_days)
    return start_date_time or start_dt.strftime(fmt), end_date_time or end_dt.strftime(fmt)


def _lowcost_error_margin(mapped_records: List[Dict[str, Any]]) -> float:
    """Mean |pm2.5 sensor1 - pm2.5 sensor2| across mapped records (lowcost only)."""
    diffs = []
    for r in mapped_records:
        s1 = r.get("pm2.5 sensor1")
        s2 = r.get("pm2.5 sensor2")
        if isinstance(s1, (int, float)) and isinstance(s2, (int, float)):
            diffs.append(abs(s1 - s2))
    if not diffs:
        return 0.0
    return round(sum(diffs) / len(diffs), 4)


def _bucket_daily(mapped_records: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Group mapped records by their YYYY-MM-DD date string."""
    out: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for r in mapped_records:
        dt = r.get("datetime")
        if not dt:
            continue
        out[str(dt)[:10]].append(r)
    return out


def _per_day_uptime(records_for_day: List[Dict[str, Any]], frequency: str) -> float:
    """Single-day uptime percentage for one device given the day's records."""
    if not records_for_day:
        return 0.0
    if frequency == "daily":
        return 100.0
    # raw / hourly: distinct hour buckets / 24
    hours: set = set()
    for r in records_for_day:
        dt = r.get("datetime")
        if not dt or "T" not in str(dt):
            continue
        try:
            hours.add(str(dt)[:13])  # YYYY-MM-DDTHH
        except Exception:
            continue
    return round(min(len(hours) / 24.0, 1.0) * 100.0, 2)


def _collect_site_device_names(sites: List[Dict[str, Any]]) -> List[str]:
    """Unique device names referenced across all `sites[].devices_info`."""
    names: set = set()
    for site in sites:
        for dev in site.get("devices_info", []):
            n = dev.get("device_name")
            if n:
                names.add(n)
    return list(names)


def _build_site_device_entry(
    dev_inf: Dict[str, Any],
    metrics: Dict[str, Any],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], str]:
    """Build the per-device output dict; return (entry, mapped_records, category)."""
    d_name = dev_inf.get("device_name")
    d_id = dev_inf.get("device_id") or ""
    category = metrics.get("category") or dev_inf.get("category") or "lowcost"
    mapped = metrics.get("data", []) or []
    uptime = float(metrics.get("uptime") or 0.0)
    err = _lowcost_error_margin(mapped) if category != "bam" else 0.0
    entry = {
        "device_name": d_name,
        "device_id": d_id or metrics.get("device_id"),
        "category": category,
        "latitude": dev_inf.get("latitude"),
        "longitude": dev_inf.get("longitude"),
        "last_active": dev_inf.get("last_active"),
        "uptime": round(uptime, 4),
        "error_margin": err,
    }
    return entry, mapped, category


def _accumulate_site_daily(
    mapped: List[Dict[str, Any]],
    category: str,
    frequency: str,
    site_daily: Dict[str, Dict[str, List[float]]],
) -> None:
    """Fold per-device daily contributions into the per-site daily map."""
    for day_str, day_recs in _bucket_daily(mapped).items():
        site_daily[day_str]["uptimes"].append(_per_day_uptime(day_recs, frequency))
        if category != "bam":
            site_daily[day_str]["errors"].append(_lowcost_error_margin(day_recs))


def _avg(values: List[float]) -> float:
    return round(sum(values) / len(values), 4) if values else 0.0


def _build_site_daily_data(site_daily: Dict[str, Dict[str, List[float]]]) -> List[Dict[str, Any]]:
    """Convert the per-day accumulator into a sorted list of {date, uptime, error_margin}."""
    out: List[Dict[str, Any]] = []
    for day_str in sorted(site_daily.keys()):
        vals = site_daily[day_str]
        out.append({
            "date": day_str,
            "uptime": _avg(vals["uptimes"]),
            "error_margin": _avg(vals["errors"]),
        })
    return out


def _process_site_for_local_perf(
    site: Dict[str, Any],
    metrics_by_device: Dict[str, Any],
    frequency: str,
) -> Dict[str, Any]:
    """Enrich a single site dict with computed per-device + per-day performance."""
    site_devices: List[Dict[str, Any]] = []
    site_daily: Dict[str, Dict[str, List[float]]] = defaultdict(
        lambda: {"uptimes": [], "errors": []}
    )
    seen_ids: set = set()

    for dev_inf in site.get("devices_info", []):
        d_name = dev_inf.get("device_name")
        d_id = dev_inf.get("device_id") or ""
        if not d_name or (d_id and d_id in seen_ids):
            continue
        if d_id:
            seen_ids.add(d_id)

        metrics = metrics_by_device.get(d_name) or {}
        entry, mapped, category = _build_site_device_entry(dev_inf, metrics)
        site_devices.append(entry)
        _accumulate_site_daily(mapped, category, frequency, site_daily)

    all_uptimes = [d["uptime"] for d in site_devices]
    lc_errors = [d["error_margin"] for d in site_devices if d.get("category") != "bam"]

    out_site = site.copy()
    out_site.pop("devices_info", None)
    out_site["uptime"] = _avg(all_uptimes)
    out_site["error_margin"] = _avg(lc_errors)
    out_site["devices"] = site_devices
    out_site["data"] = _build_site_daily_data(site_daily)
    return out_site


def apply_local_performance_to_sites(
    sites: List[Dict[str, Any]],
    db: Session,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "hourly",
) -> Dict[str, Any]:
    """
    Enrich sites with performance metrics computed from the local
    sync_raw/hourly/daily_device_data tables.

    Per device: uptime + error_margin (lowcost only, from sensor1 vs sensor2).
    Per site:   averaged across its devices, plus a daily breakdown in `data`.
    """
    start, end = _default_window(start_date_time, end_date_time)
    device_names = _collect_site_device_names(sites)

    metrics_by_device = cohort_service.compute_device_performance(
        db, device_names, start, end, frequency=frequency,
    ) if device_names else {}

    out_sites = [_process_site_for_local_perf(site, metrics_by_device, frequency) for site in sites]

    return {
        "success": True,
        "message": "Site performance fetched successfully",
        "sites": out_sites,
    }


def get_sites_summary(
    sites: list,
    db: Session,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
) -> dict:
    """
    Deprecated — kept for backward-compat. Now reads from local sync tables
    via :func:`apply_local_performance_to_sites` (frequency=daily).
    """
    logger.warning(
        "get_sites_summary is deprecated; use apply_local_performance_to_sites "
        "with an explicit frequency instead."
    )
    return apply_local_performance_to_sites(
        sites, db, start_date_time=start_date_time, end_date_time=end_date_time, frequency="daily"
    )


async def get_sites_performance(
    sites: List[Dict[str, Any]],
    token: str,
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
    db: Session = None,
) -> Dict[str, Any]:
    """
    Site performance from local sync_raw/hourly/daily_device_data tables.
    BAM devices are read at the same frequency (no special-case raw fallback).
    The legacy ``token`` argument is retained for backwards compatibility.
    """
    _ = token  # token no longer needed; kept for signature compat
    if db is None:
        from app.db.session import SessionLocal
        db = SessionLocal()
        try:
            return apply_local_performance_to_sites(
                sites, db, start_date_time=start_date_time, end_date_time=end_date_time, frequency=frequency,
            )
        finally:
            db.close()
    return apply_local_performance_to_sites(
        sites, db, start_date_time=start_date_time, end_date_time=end_date_time, frequency=frequency,
    )


def _build_inlab_pagination(
    devices_meta: List[Any], skip: int, limit: int,
) -> Tuple[List[str], Dict[str, Any], Dict[str, Any]]:
    """Slice devices by skip/limit and build the response meta payload."""
    total_lowcost = len(devices_meta)
    paginated_meta = devices_meta[skip: skip + limit]
    meta_map = {d.device_name: d for d in paginated_meta}
    page_names = list(meta_map.keys())

    total_pages = (total_lowcost + limit - 1) // limit if limit > 0 else 1
    current_page = (skip // limit) + 1 if limit > 0 else 1
    meta = {
        "total": total_lowcost, "totalResults": total_lowcost,
        "limit": limit, "skip": skip,
        "page": current_page, "totalPages": total_pages,
        "detailLevel": None, "usedCache": None,
        "nextPage": None if current_page >= total_pages else f"skip={skip + limit}&limit={limit}",
    }
    return page_names, meta_map, meta


def _build_inlab_daily_breakdown(
    mapped: List[Dict[str, Any]], frequency: str,
) -> List[Dict[str, Any]]:
    """Per-day breakdown sorted newest-first."""
    daily_buckets = _bucket_daily(mapped)
    return [
        {
            "date": day_str,
            "uptime": _per_day_uptime(daily_buckets[day_str], frequency),
            "error_margin": _lowcost_error_margin(daily_buckets[day_str]),
            "correlation": None,
        }
        for day_str in sorted(daily_buckets.keys(), reverse=True)
    ]


def _build_inlab_device(
    name: str,
    d_meta: Optional[Any],
    metrics: Dict[str, Any],
    frequency: str,
) -> Dict[str, Any]:
    """Build a single inlab-device output entry."""
    mapped = metrics.get("data", []) or []
    overall_uptime = float(metrics.get("uptime") or 0.0)
    overall_error = _lowcost_error_margin(mapped)
    return {
        "name": name,
        "category": d_meta.category if d_meta else "lowcost",
        "network_id": d_meta.network_id if d_meta else None,
        "firmware": d_meta.current_firmware if d_meta else None,
        "uptime": round(overall_uptime, 4),
        "error_margin": overall_error,
        "correlation": None,
        "daily": _build_inlab_daily_breakdown(mapped, frequency),
    }


async def get_inlab_collocation(
    token: str,
    db: Session,
    skip: int = 0,
    limit: int = 100,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "daily",
) -> Dict[str, Any]:
    """
    Inlab lowcost devices with performance from local sync_*_device_data tables.

    Discovers candidate devices via the Platform 'inlab' cohort tag, filters
    to category=='lowcost' against the local SyncDevice table, paginates,
    then computes per-device + per-day uptime/error_margin from the local
    sync data tables.
    """
    from app.models.sync import SyncDevice

    # 1. Discover devices via Platform 'inlab' cohorts.
    cohort_result = await cohort_service.get_all_cohorts_paginated(token, {"tags": "inlab"})
    if not cohort_result.get("success"):
        return {
            "success": False,
            "message": cohort_result.get("message", "Error fetching cohorts from platform"),
            "status_code": cohort_result.get("status_code", 400),
            "devices": [],
        }

    candidate_names = {
        dev.get("name")
        for cohort in cohort_result.get("cohorts", [])
        for dev in cohort.get("devices", [])
        if dev.get("name")
    }
    empty_meta = {
        "total": 0, "totalResults": 0, "skip": skip, "limit": limit,
        "page": 1, "totalPages": 1,
    }
    if not candidate_names:
        return {"success": True, "message": "No inlab devices found", "meta": empty_meta, "devices": []}

    # 2. Filter to lowcost via local SyncDevice table & paginate.
    devices_meta = (
        db.query(SyncDevice)
        .filter(
            SyncDevice.device_name.in_(list(candidate_names)),
            SyncDevice.category == "lowcost",
        )
        .order_by(SyncDevice.device_name.asc())
        .all()
    )
    page_names, meta_map, meta = _build_inlab_pagination(devices_meta, skip, limit)
    if not page_names:
        return {"success": True, "message": "No inlab lowcost devices found in this page",
                "meta": meta, "devices": []}

    # 3. Compute performance from local tables & build output.
    start, end = _default_window(start_date_time, end_date_time)
    metrics_by_device = cohort_service.compute_device_performance(
        db, page_names, start, end, frequency=frequency,
    )

    result_devices = [
        _build_inlab_device(name, meta_map.get(name), metrics_by_device.get(name) or {}, frequency)
        for name in page_names
    ]

    return {
        "success": True,
        "message": "Inlab devices fetched successfully",
        "meta": meta,
        "devices": result_devices,
    }


_BAM_RECORD_EXCLUDED_KEYS = frozenset({
    "datetime", "device_name", "device_id",
    "channel_id", "frequency", "entry_id",
    "record_count", "complete",
})


def _load_collocation_site_info(db: Session, site_id: str) -> Optional[Dict[str, Any]]:
    """Load static site metadata as a dict, or None if site not found."""
    from app.models.sync import SyncSite  # local import to avoid cycles
    site_row = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
    if site_row is None:
        return None
    return {
        "site_id": site_row.site_id,
        "name": site_row.name,
        "generated_name": site_row.generated_name,
        "latitude": site_row.latitude,
        "longitude": site_row.longitude,
        "network": site_row.network,
        "country": site_row.country,
        "city": site_row.city,
        "county": site_row.county,
        "district": site_row.district,
        "region": site_row.region,
        "data_provider": site_row.data_provider,
        "description": site_row.description,
        "number_of_devices": 0,
    }


def _load_devices_for_site(db: Session, site_id: str) -> List[SyncDevice]:
    """Discover devices for a site via SyncSiteDevice + legacy SyncDevice.site_id."""
    from app.models.sync import SyncSiteDevice  # local import to avoid cycles
    rows = (
        db.query(SyncDevice)
        .join(SyncSiteDevice, SyncSiteDevice.device_id == SyncDevice.device_id)
        .filter(SyncSiteDevice.site_id == site_id)
        .all()
    )
    legacy_rows = db.query(SyncDevice).filter(SyncDevice.site_id == site_id).all()

    by_id: Dict[str, SyncDevice] = {}
    for d in list(rows) + list(legacy_rows):
        if d.device_id and d.device_id not in by_id:
            by_id[d.device_id] = d
    return list(by_id.values())


def _shape_lowcost_record(r: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "time": r.get("datetime"),
        "sensor1": r.get("pm2.5 sensor1"),
        "sensor2": r.get("pm2.5 sensor2"),
        "battery": r.get("battery"),
    }


def _shape_other_record(r: Dict[str, Any]) -> Dict[str, Any]:
    """BAM (or any other category): surface every mapped field, excluding bookkeeping keys."""
    rec: Dict[str, Any] = {"time": r.get("datetime")}
    for k, v in r.items():
        if k not in _BAM_RECORD_EXCLUDED_KEYS:
            rec[k] = v
    return rec


def _shape_device_records(category: str, mapped: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    shaper = _shape_lowcost_record if category == "lowcost" else _shape_other_record
    return [shaper(r) for r in mapped]


def get_collocation_site_details(
    site_id: str,
    db: Session,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "raw",
) -> Dict[str, Any]:
    """
    Fetch device data for all devices at a specific collocation site,
    sourced **entirely from the local sync_*_device_data tables**.

    For lowcost: returns sensor1 (field1) and sensor2 (field3) individually,
    plus battery (field7).
    For BAM: returns mapped concentration fields (ConcRT/ConcHR/ConcS).

    ``frequency`` selects the source table:
        - ``raw``    → sync_raw_device_data
        - ``hourly`` → sync_hourly_device_data
        - ``daily``  → sync_daily_device_data
    """
    freq = (frequency or "raw").lower()
    start_date_time = _ensure_timezone(start_date_time)
    end_date_time = _ensure_timezone(end_date_time)

    # 1. Static site metadata + device discovery from local DB.
    site_info = _load_collocation_site_info(db, site_id)
    local_devices = _load_devices_for_site(db, site_id)
    device_names = [d.device_name for d in local_devices if d.device_name]

    if not local_devices or not device_names:
        return {
            "success": True,
            "message": "No devices found for this site",
            "site": site_info,
            "data": [],
        }

    if site_info is not None:
        site_info["number_of_devices"] = len(local_devices)

    # 2. Pull mapped, time-bounded records from local sync tables.
    metrics_by_device = cohort_service.compute_device_performance(
        db, device_names, start_date_time, end_date_time, frequency=freq,
    )

    # 3. Shape per-device output.
    name_to_id = {d.device_name: d.device_id for d in local_devices if d.device_name}
    out: List[Dict[str, Any]] = []
    for name in device_names:
        metrics = metrics_by_device.get(name) or {}
        category = metrics.get("category") or "lowcost"
        mapped = metrics.get("data", []) or []
        out.append({
            "device_name": name,
            "device_id": name_to_id.get(name) or metrics.get("device_id"),
            "category": category,
            "data": _shape_device_records(category, mapped),
        })

    return {
        "success": True,
        "message": "Collocation site details fetched successfully",
        "site": site_info,
        "data": out,
    }
