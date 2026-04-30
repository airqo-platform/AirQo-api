import math
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone

from app.services import cohort_service
from app.utils.performance import PerformanceAnalysis
from app.core.config import settings
from app.crud.crud_sync_device_data import get_latest_raw_timestamps
from app.db.session import SessionLocal

logger = logging.getLogger(__name__)


# --- Helpers ---

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great circle distance between two points in km."""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (math.sin(d_lat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(d_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def sanitize_metric(value: Optional[float], ndigits: int = 4) -> float:
    if value is None:
        return 0.0
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(value, ndigits)


def _error_margin_from_averages(averages: Dict[str, Any]) -> float:
    """Lowcost error margin = |pm2.5 sensor1 - pm2.5 sensor2| from averages."""
    if not isinstance(averages, dict):
        return 0.0
    s1 = averages.get("pm2.5 sensor1")
    s2 = averages.get("pm2.5 sensor2")
    if isinstance(s1, (int, float)) and isinstance(s2, (int, float)):
        return abs(s1 - s2)
    return 0.0


def _compute_date_range(days: int):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return start.strftime("%Y-%m-%dT%H:%M:%S.000Z"), end.strftime("%Y-%m-%dT%H:%M:%S.000Z")


async def _fetch_cohorts_with_performance(
    token: str, days: int, tags: List[str] = None,
    paginate_all: bool = False, include_device_data: bool = False,
    frequency: str = "hourly",
) -> List[Dict[str, Any]]:
    """
    Fetch cohorts from the Platform API and enrich them with performance
    metrics from the **local** sync_*_device_data tables.

    ``include_device_data`` is accepted for backwards compatibility — the
    local enrichment always populates per-device fields.
    """
    _ = include_device_data  # always populated by apply_local_performance
    start_dt, end_dt = _compute_date_range(days)

    fetch_params: Dict[str, Any] = {}
    if tags:
        fetch_params["tags"] = ",".join(tags)

    if paginate_all:
        result = await cohort_service.get_all_cohorts_paginated(token, fetch_params)
        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching cohorts from platform")
            logger.error(f"Failed to fetch paginated cohorts: {message}")
            from fastapi import HTTPException
            raise HTTPException(status_code=status_code, detail=message)
        cohorts = result.get("cohorts", [])
    else:
        result = await cohort_service.get_cohorts(token, fetch_params)
        if not result.get("success", True):
            logger.error(f"Failed to fetch cohorts for maintenance: {result.get('message')}")
            return []
        cohorts = result.get("cohorts", [])

    if cohorts:
        from app.db.session import SessionLocal
        db = SessionLocal()
        try:
            cohort_service.apply_local_performance(
                cohorts, db, start_dt, end_dt, frequency=frequency,
            )
        finally:
            db.close()
    return cohorts


# --- Public API ---

async def get_overview(token: str, days: int = 14, tags: List[str] = None) -> Dict[str, Any]:
    """
    Average uptime/error per cohort, grouped by country.
    Mirrors beacon-api1 get_maintenance_overview_data.
    """
    cohorts = await _fetch_cohorts_with_performance(token, days, tags=tags)

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for cohort in cohorts:
        # Use network as a rough country proxy (can be refined later).
        network = cohort.get("network", "Unknown")
        country = network

        active_count = sum(
            1 for d in cohort.get("devices", []) if d.get("isActive")
        )

        entry = {
            "cohort_id": cohort.get("_id"),
            "cohort_name": cohort.get("name"),
            "network": network,
            "device_count": active_count,
            "average_uptime": sanitize_metric(cohort.get("uptime")),
            "average_data_completeness": sanitize_metric(cohort.get("data_completeness")),
            "average_error_margin": sanitize_metric(
                _error_margin_from_averages(cohort.get("averages") or {})
            ),
        }

        grouped.setdefault(country, []).append(entry)

    return {"success": True, "data": grouped}


async def get_map_view(
    token: str,
    days: int = 14,
    tags: List[str] = None,
    live: bool = False,
    frequency: str = "hourly",
) -> Dict[str, Any]:
    """
    Device coordinates + performance metrics for map display.

    Now always reads from the local sync_*_device_data tables. The ``live``
    flag is accepted for backwards compatibility and has no effect; the
    local sync tables are the single source of truth.
    """
    _ = live  # kept for signature compatibility
    cohorts = await _fetch_cohorts_with_performance(
        token, days, tags=tags, paginate_all=True, include_device_data=True,
        frequency=frequency,
    )

    device_map, name_to_channel = _build_map_view_devices(cohorts)
    _override_last_active_from_local(device_map, name_to_channel)

    output = []
    for d in device_map.values():
        d["cohorts"] = list(d["cohorts"])
        output.append(d)

    return {"success": True, "data": output}


def _build_map_view_devices(
    cohorts: List[Dict[str, Any]],
) -> tuple:
    """Build the device_map + name->channel index from a list of cohorts."""
    device_map: Dict[str, Dict[str, Any]] = {}
    name_to_channel: Dict[str, str] = {}

    for cohort in cohorts:
        cohort_name = cohort.get("name", "")
        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if not dev.get("isActive") or not d_name:
                continue

            if d_name not in device_map:
                device_map[d_name] = _make_map_view_entry(dev)
                dn = dev.get("device_number")
                if dn is not None:
                    name_to_channel[d_name] = str(dn)
            device_map[d_name]["cohorts"].add(cohort_name)

    return device_map, name_to_channel


def _make_map_view_entry(dev: Dict[str, Any]) -> Dict[str, Any]:
    """Build a single map-view device entry from a platform device doc."""
    err = _error_margin_from_averages(dev.get("averages") or {})
    return {
        "device_id": dev.get("_id", ""),
        "device_name": dev.get("name"),
        "latitude": dev.get("latitude"),
        "longitude": dev.get("longitude"),
        "last_active": dev.get("lastActive"),
        "uptime": sanitize_metric(dev.get("uptime")),
        "data_completeness": sanitize_metric(dev.get("data_completeness")),
        "error_margin": sanitize_metric(err),
        "cohorts": set(),
    }


def _override_last_active_from_local(
    device_map: Dict[str, Dict[str, Any]],
    name_to_channel: Dict[str, str],
) -> None:
    """Replace last_active timestamps with the latest local raw record per channel."""
    if not name_to_channel:
        return

    db = SessionLocal()
    try:
        latest_by_channel = get_latest_raw_timestamps(db, name_to_channel.values())
    finally:
        db.close()

    for d_name, ch_id in name_to_channel.items():
        ts = latest_by_channel.get(ch_id)
        if ts is not None and d_name in device_map:
            device_map[d_name]["last_active"] = ts.isoformat()


async def stream_map_view(token: str, days: int = 14, tags: List[str] = None):
    """
    Async generator that yields device map entries progressively.
    Processes one cohort at a time so the SSE layer can push results
    to the client as soon as each cohort's performance data is ready.

    Yields dicts with an "event" key:
      - "device"        : a new device entry (first time seen)
      - "cohort_update" : additional cohort name for an already-sent device
      - "done"          : stream complete
    """
    start_dt, end_dt = _compute_date_range(days)
    frequency = "hourly"

    fetch_params = {"tags": ",".join(tags)} if tags else {}
    result = await cohort_service.get_all_cohorts_paginated(token, fetch_params)

    if not result.get("success", True):
        logger.error(f"Failed to fetch cohorts for SSE map view: {result.get('message')}")
        yield {"event": "done", "data": {"success": False, "message": result.get("message", "Failed to fetch cohorts")}}
        return

    cohorts = result.get("cohorts", [])
    if not cohorts:
        yield {"event": "done", "data": {"success": True, "total": 0}}
        return

    logger.info(f"SSE map-view: streaming {len(cohorts)} cohorts one-by-one")

    seen_devices: Dict[str, bool] = {}

    for i, cohort in enumerate(cohorts):
        cohort_name = cohort.get("name", "")
        if not _enrich_single_cohort(cohort, start_dt, end_dt, frequency):
            continue

        for event in _iter_cohort_stream_events(cohort, cohort_name, seen_devices):
            yield event

        logger.debug(f"SSE map-view: finished cohort {i + 1}/{len(cohorts)} '{cohort_name}'")

    yield {"event": "done", "data": {"success": True, "total": len(seen_devices)}}


def _enrich_single_cohort(
    cohort: Dict[str, Any], start_dt: str, end_dt: str, frequency: str,
) -> bool:
    """Apply local performance to a single cohort. Returns False on failure."""
    cohort_name = cohort.get("name", "")
    try:
        db = SessionLocal()
        try:
            cohort_service.apply_local_performance(
                [cohort], db, start_dt, end_dt, frequency=frequency,
            )
        finally:
            db.close()
        return True
    except Exception as e:  # noqa: BLE001
        logger.warning(f"SSE map-view: failed to process cohort '{cohort_name}': {e}")
        return False


def _resolve_stream_last_active(dev: Dict[str, Any]) -> Optional[str]:
    """Return the latest raw timestamp for a device, falling back to lastActive."""
    last_active = dev.get("lastActive")
    dn = dev.get("device_number")
    if dn is None:
        return last_active

    db = SessionLocal()
    try:
        latest = get_latest_raw_timestamps(db, [str(dn)])
    finally:
        db.close()
    ts = latest.get(str(dn))
    return ts.isoformat() if ts is not None else last_active


def _build_stream_device_event(dev: Dict[str, Any], cohort_name: str) -> Dict[str, Any]:
    """Build an SSE 'device' event payload for a freshly-seen device."""
    err = _error_margin_from_averages(dev.get("averages") or {})
    return {
        "event": "device",
        "data": {
            "device_id": dev.get("_id", ""),
            "device_name": dev.get("name"),
            "latitude": dev.get("latitude"),
            "longitude": dev.get("longitude"),
            "last_active": _resolve_stream_last_active(dev),
            "uptime": sanitize_metric(dev.get("uptime")),
            "data_completeness": sanitize_metric(dev.get("data_completeness")),
            "error_margin": sanitize_metric(err),
            "cohorts": [cohort_name],
        },
    }


def _iter_cohort_stream_events(
    cohort: Dict[str, Any],
    cohort_name: str,
    seen_devices: Dict[str, bool],
):
    """Yield SSE events for the active devices in a single cohort."""
    for dev in cohort.get("devices", []):
        d_name = dev.get("name")
        if not dev.get("isActive") or not d_name:
            continue

        if d_name not in seen_devices:
            seen_devices[d_name] = True
            yield _build_stream_device_event(dev, cohort_name)
        else:
            yield {
                "event": "cohort_update",
                "data": {"device_name": d_name, "cohort": cohort_name},
            }


async def calculate_routes(
    token: str,
    device_names: List[str],
    start_lat: float,
    start_lon: float,
    tags: List[str] = None,
    days: int = 7,
) -> Dict[str, Any]:
    """
    Optimized maintenance route using nearest-neighbor weighted by criticality.
    Mirrors beacon-api1 calculate_maintenance_routes.
    """
    if not device_names:
        return {"success": True, "route": [], "total_distance_km": 0.0}

    cohorts = await _fetch_cohorts_with_performance(token, days, tags=tags)
    all_devices = _build_route_device_lookup(cohorts, device_names)

    route, total_distance = _nearest_neighbor_route(all_devices, start_lat, start_lon)

    return {
        "success": True,
        "route": route,
        "total_distance_km": round(total_distance, 2),
    }


def _criticality_score(uptime: float, error_margin: float) -> float:
    """Maintenance-priority score from uptime and sensor error margin."""
    score = 1.0
    if uptime < 0.8:
        score += (0.8 - uptime) * 5.0  # 0 uptime -> +4
    if error_margin > 20:
        score += (error_margin - 20) / 20.0
    return score


def _build_route_device_lookup(
    cohorts: List[Dict[str, Any]], device_names: List[str],
) -> Dict[str, Dict[str, Any]]:
    """Pick out the requested devices (deduped) with location + criticality."""
    wanted = set(device_names)
    all_devices: Dict[str, Dict[str, Any]] = {}

    for cohort in cohorts:
        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if not d_name or d_name not in wanted or d_name in all_devices:
                continue
            lat = dev.get("latitude")
            lon = dev.get("longitude")
            if lat is None or lon is None:
                continue

            uptime = dev.get("uptime", 0.0) or 0.0
            error_margin = _error_margin_from_averages(dev.get("averages") or {})
            all_devices[d_name] = {
                "name": d_name,
                "lat": lat,
                "lon": lon,
                "criticality": _criticality_score(uptime, error_margin),
                "uptime": uptime,
                "error_margin": error_margin,
            }

    return all_devices


def _pick_next_device(
    unvisited: List[Dict[str, Any]], cur_lat: float, cur_lon: float,
) -> tuple:
    """Pick the next device using a criticality-weighted nearest-neighbor cost."""
    best_next = None
    min_cost = float("inf")
    best_dist = 0.0

    for candidate in unvisited:
        dist = haversine_distance(cur_lat, cur_lon, candidate["lat"], candidate["lon"])
        criticality = max(candidate["criticality"], 0.1)
        effective_cost = dist / (criticality ** 2)
        if effective_cost < min_cost:
            min_cost = effective_cost
            best_next = candidate
            best_dist = dist

    return best_next, best_dist


def _nearest_neighbor_route(
    all_devices: Dict[str, Dict[str, Any]],
    start_lat: float,
    start_lon: float,
) -> tuple:
    """Greedy nearest-neighbor TSP heuristic. Returns (route, total_distance)."""
    unvisited = list(all_devices.values())
    cur_lat, cur_lon = start_lat, start_lon
    route: List[Dict[str, Any]] = []
    total_distance = 0.0

    while unvisited:
        best_next, best_dist = _pick_next_device(unvisited, cur_lat, cur_lon)
        if not best_next:
            break

        route.append({
            "device_name": best_next["name"],
            "latitude": best_next["lat"],
            "longitude": best_next["lon"],
            "distance_from_last_km": round(best_dist, 2),
            "criticality_score": round(best_next["criticality"], 2),
            "uptime": sanitize_metric(best_next["uptime"]),
        })
        total_distance += best_dist
        cur_lat, cur_lon = best_next["lat"], best_next["lon"]
        unvisited.remove(best_next)

    return route, total_distance


async def get_stats(token: str, request) -> Dict[str, Any]:
    """
    Unified paginated stats endpoint.
    Dispatches to cohort-level or device-level aggregation based on entity_type.
    """
    from app.schemas.maintenance import MaintenanceStatsRequest
    req: MaintenanceStatsRequest = request

    cohorts = await _fetch_cohorts_with_performance(token, req.period_days, tags=req.tags)

    if req.entity_type == "device":
        items = _build_device_items(cohorts)
    else:
        items = _build_cohort_items(cohorts)

    # Apply filters
    items = _apply_filters(items, req)

    # Apply sorting
    items = _apply_sorting(items, req)

    total = len(items)

    # Paginate
    offset = (req.page - 1) * req.page_size
    page_items = items[offset: offset + req.page_size]

    return {
        "success": True,
        "entity_type": req.entity_type,
        "total": total,
        "page": req.page,
        "page_size": req.page_size,
        "items": page_items,
    }


# --- Internal helpers for get_stats ---

def _build_cohort_items(cohorts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    items = []
    for cohort in cohorts:
        active_count = sum(1 for d in cohort.get("devices", []) if d.get("isActive"))
        items.append({
            "id": cohort.get("_id", ""),
            "name": cohort.get("name", ""),
            "country": cohort.get("network"),
            "device_count": active_count,
            "avg_uptime": sanitize_metric(cohort.get("uptime")),
            "avg_data_completeness": sanitize_metric(cohort.get("data_completeness")),
            "avg_error_margin": sanitize_metric(
                _error_margin_from_averages(cohort.get("averages") or {})
            ),
        })
    return items


def _build_device_items(cohorts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    device_map: Dict[str, Dict[str, Any]] = {}
    for cohort in cohorts:
        cohort_name = cohort.get("name", "")
        for dev in cohort.get("devices", []):
            if not dev.get("isActive"):
                continue
            d_name = dev.get("name")
            if not d_name:
                continue
            if d_name not in device_map:
                device_map[d_name] = {
                    "device_name": d_name,
                    "cohorts": set(),
                    "uptime": sanitize_metric(dev.get("uptime")),
                    "data_completeness": sanitize_metric(dev.get("data_completeness")),
                    "sensor_error_margin": sanitize_metric(
                        _error_margin_from_averages(dev.get("averages") or {})
                    ),
                }
            device_map[d_name]["cohorts"].add(cohort_name)

    items = []
    for d in device_map.values():
        d["cohorts"] = list(d["cohorts"])
        items.append(d)
    return items


def _resolve_item_keys(items: List[Dict[str, Any]]) -> Dict[str, str]:
    """Resolve the (name/uptime/error) key names based on the items' shape."""
    sample = items[0] if items else {}
    return {
        "name": "name" if "name" in sample else "device_name",
        "uptime": "avg_uptime" if "avg_uptime" in sample else "uptime",
        "error": "avg_error_margin" if "avg_error_margin" in sample else "sensor_error_margin",
    }


def _filter_by_search(items: List[Dict[str, Any]], pattern: str) -> List[Dict[str, Any]]:
    pattern = pattern.lower()
    return [
        i for i in items
        if pattern in (i.get("name") or i.get("device_name") or "").lower()
        or pattern in (i.get("id") or "").lower()
        or pattern in (i.get("country") or "").lower()
    ]


def _filter_by_range(
    items: List[Dict[str, Any]], key: str, range_filter,
) -> List[Dict[str, Any]]:
    """Filter items by a numeric min/max range, ignoring None bounds."""
    if range_filter is None:
        return items
    if range_filter.min is not None:
        items = [i for i in items if i.get(key, 0) >= range_filter.min]
    if range_filter.max is not None:
        items = [i for i in items if i.get(key, 0) <= range_filter.max]
    return items


def _apply_filters(items: List[Dict[str, Any]], req) -> List[Dict[str, Any]]:
    if not req.filters:
        return items

    if req.filters.search:
        items = _filter_by_search(items, req.filters.search)
    if req.filters.country:
        items = [i for i in items if i.get("country") == req.filters.country]

    keys = _resolve_item_keys(items)
    items = _filter_by_range(items, keys["uptime"], req.filters.uptime)
    items = _filter_by_range(items, keys["error"], req.filters.error_margin)
    return items


def _apply_sorting(items: List[Dict[str, Any]], req) -> List[Dict[str, Any]]:
    keys = _resolve_item_keys(items)
    name_key = keys["name"]

    if req.sort:
        sort_key_map = {
            "uptime": keys["uptime"],
            "error_margin": keys["error"],
            "name": name_key,
        }
        key = sort_key_map.get(req.sort.field, name_key)
        reverse = req.sort.order == "desc"
        items.sort(key=lambda x: x.get(key, 0) or 0, reverse=reverse)
    else:
        items.sort(key=lambda x: x.get(name_key, ""))

    return items
