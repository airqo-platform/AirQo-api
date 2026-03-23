import math
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone

from app.services import cohort_service
from app.utils.performance import PerformanceAnalysis
from app.core.config import settings

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


def _compute_date_range(days: int):
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    return start.strftime("%Y-%m-%dT%H:%M:%S.000Z"), end.strftime("%Y-%m-%dT%H:%M:%S.000Z")


async def _fetch_cohorts_with_performance(
    token: str, days: int, tags: List[str] = None,
    paginate_all: bool = False, include_device_data: bool = False
) -> List[Dict[str, Any]]:
    """
    Fetch cohorts from the Platform API with performance data attached.
    Optionally filter by tags.
    When paginate_all=True, fetches ALL pages of cohorts.
    When include_device_data=True, per-device metrics are injected into the cohort device entries.
    """
    start_dt, end_dt = _compute_date_range(days)

    if paginate_all:
        # Fetch all pages of cohorts
        fetch_params = {}
        if tags:
            fetch_params["tags"] = ",".join(tags)
        result = await cohort_service.get_all_cohorts_paginated(token, fetch_params)

        if not result.get("success", True):
            status_code = result.get("status_code", 400)
            message = result.get("message", "Error fetching cohorts from platform")
            logger.error(f"Failed to fetch paginated cohorts: {message}")
            from fastapi import HTTPException
            raise HTTPException(status_code=status_code, detail=message)

        cohorts = result.get("cohorts", [])
        if cohorts:
            frequency = "hourly"
            await cohort_service._process_performance_data(
                cohorts, start_dt, end_dt, frequency,
                include_device_data=include_device_data
            )
        return cohorts
    else:
        params = {
            "includePerformance": True,
            "startDateTime": start_dt,
            "endDateTime": end_dt,
            "frequency": "hourly",
        }
        if tags:
            params["tags"] = ",".join(tags)

        result = await cohort_service.get_cohorts(token, params)

        if not result.get("success", True):
            logger.error(f"Failed to fetch cohorts for maintenance: {result.get('message')}")
            return []

        return result.get("cohorts", [])


# --- Public API ---

async def get_overview(token: str, days: int = 14, tags: List[str] = None) -> Dict[str, Any]:
    """
    Average uptime/error per cohort, grouped by country.
    Mirrors beacon-api1 get_maintenance_overview_data.
    """
    cohorts = await _fetch_cohorts_with_performance(token, days, tags=tags)

    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for cohort in cohorts:
        country = "Unknown"
        # Try to extract country from cohort tags or name
        for tag in cohort.get("cohort_tags", []):
            if isinstance(tag, str) and len(tag) > 1:
                # Tags sometimes contain country info
                pass
        # Fallback: use network as rough country proxy
        network = cohort.get("network", "Unknown")
        country = network  # Simple mapping; can be refined

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
            "average_error_margin": sanitize_metric(cohort.get("sensor_error_margin")),
        }

        grouped.setdefault(country, []).append(entry)

    return {"success": True, "data": grouped}


async def get_map_view(token: str, days: int = 14, tags: List[str] = None, live: bool = False) -> Dict[str, Any]:
    """
    Device coordinates + performance metrics for map display.
    
    When live=False (default), reads from the pre-computed sync_device_performance table.
    Falls back to real-time computation if no pre-computed data exists or live=True.
    """
    if not live:
        try:
            from app.db.session import SessionLocal
            from app.crud import crud_device_performance

            db = SessionLocal()
            try:
                records = crud_device_performance.get_averaged_performance(db, days=days)
                if records:
                    logger.info(f"Map view served from pre-computed data (avg over {days} days): {len(records)} devices")
                    return {"success": True, "data": records}
                else:
                    logger.info("No pre-computed data found, falling back to real-time computation")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"Failed to read pre-computed data, falling back to real-time: {e}")

    # Real-time fallback (original logic)
    cohorts = await _fetch_cohorts_with_performance(
        token, days, tags=tags, paginate_all=True, include_device_data=True
    )

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
                    "device_id": dev.get("_id", ""),
                    "device_name": d_name,
                    "latitude": dev.get("latitude"),
                    "longitude": dev.get("longitude"),
                    "last_active": dev.get("lastActive"),
                    "uptime": sanitize_metric(dev.get("uptime")),
                    "data_completeness": sanitize_metric(dev.get("data_completeness")),
                    "error_margin": sanitize_metric(dev.get("sensor_error_margin")),
                    "cohorts": set(),
                }
            device_map[d_name]["cohorts"].add(cohort_name)

    # Convert sets to lists
    output = []
    for d in device_map.values():
        d["cohorts"] = list(d["cohorts"])
        output.append(d)

    return {"success": True, "data": output}


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

    # Step 1: Fetch all cohort metadata (paginated) — no performance data yet
    fetch_params = {}
    if tags:
        fetch_params["tags"] = ",".join(tags)

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

    # Step 2: Process each cohort individually and yield devices
    for i, cohort in enumerate(cohorts):
        cohort_name = cohort.get("name", "")
        try:
            await cohort_service._process_performance_data(
                [cohort], start_dt, end_dt, frequency, include_device_data=True
            )
        except Exception as e:
            logger.warning(f"SSE map-view: failed to process cohort '{cohort_name}': {e}")
            continue

        for dev in cohort.get("devices", []):
            if not dev.get("isActive"):
                continue

            d_name = dev.get("name")
            if not d_name:
                continue

            if d_name not in seen_devices:
                seen_devices[d_name] = True
                yield {
                    "event": "device",
                    "data": {
                        "device_id": dev.get("_id", ""),
                        "device_name": d_name,
                        "latitude": dev.get("latitude"),
                        "longitude": dev.get("longitude"),
                        "last_active": dev.get("lastActive"),
                        "uptime": sanitize_metric(dev.get("uptime")),
                        "data_completeness": sanitize_metric(dev.get("data_completeness")),
                        "error_margin": sanitize_metric(dev.get("sensor_error_margin")),
                        "cohorts": [cohort_name],
                    },
                }
            else:
                # Device already sent — notify the client of the extra cohort
                yield {
                    "event": "cohort_update",
                    "data": {
                        "device_name": d_name,
                        "cohort": cohort_name,
                    },
                }

        logger.debug(f"SSE map-view: finished cohort {i + 1}/{len(cohorts)} '{cohort_name}'")

    yield {"event": "done", "data": {"success": True, "total": len(seen_devices)}}


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

    # Get device data from a recent performance fetch
    cohorts = await _fetch_cohorts_with_performance(token, days, tags=tags)

    # Build device info lookup
    all_devices: Dict[str, Dict[str, Any]] = {}
    for cohort in cohorts:
        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if d_name and d_name in device_names and d_name not in all_devices:
                lat = dev.get("latitude")
                lon = dev.get("longitude")
                if lat is not None and lon is not None:
                    uptime = dev.get("uptime", 0.0) or 0.0
                    error_margin = dev.get("sensor_error_margin", 0.0) or 0.0

                    # Criticality score
                    score = 1.0
                    if uptime < 0.8:
                        score += (0.8 - uptime) * 5.0  # 0 uptime -> +4
                    if error_margin > 20:
                        score += (error_margin - 20) / 20.0

                    all_devices[d_name] = {
                        "name": d_name,
                        "lat": lat,
                        "lon": lon,
                        "criticality": score,
                        "uptime": uptime,
                        "error_margin": error_margin,
                    }

    # Nearest-neighbor TSP heuristic weighted by criticality
    current_pos = {"lat": start_lat, "lon": start_lon}
    unvisited = list(all_devices.values())
    route = []
    total_distance = 0.0

    while unvisited:
        best_next = None
        min_cost = float("inf")
        best_dist = 0.0

        for candidate in unvisited:
            dist = haversine_distance(
                current_pos["lat"], current_pos["lon"],
                candidate["lat"], candidate["lon"],
            )
            criticality = max(candidate["criticality"], 0.1)
            effective_cost = dist / (criticality ** 2)

            if effective_cost < min_cost:
                min_cost = effective_cost
                best_next = candidate
                best_dist = dist

        if best_next:
            route.append({
                "device_name": best_next["name"],
                "latitude": best_next["lat"],
                "longitude": best_next["lon"],
                "distance_from_last_km": round(best_dist, 2),
                "criticality_score": round(best_next["criticality"], 2),
                "uptime": sanitize_metric(best_next["uptime"]),
            })
            total_distance += best_dist
            current_pos = {"lat": best_next["lat"], "lon": best_next["lon"]}
            unvisited.remove(best_next)

    return {
        "success": True,
        "route": route,
        "total_distance_km": round(total_distance, 2),
    }


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
            "avg_error_margin": sanitize_metric(cohort.get("sensor_error_margin")),
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
                    "sensor_error_margin": sanitize_metric(dev.get("sensor_error_margin")),
                }
            device_map[d_name]["cohorts"].add(cohort_name)

    items = []
    for d in device_map.values():
        d["cohorts"] = list(d["cohorts"])
        items.append(d)
    return items


def _apply_filters(items: List[Dict[str, Any]], req) -> List[Dict[str, Any]]:
    if not req.filters:
        return items

    if req.filters.search:
        pattern = req.filters.search.lower()
        items = [
            i for i in items
            if pattern in (i.get("name") or i.get("device_name") or "").lower()
            or pattern in (i.get("id") or "").lower()
            or pattern in (i.get("country") or "").lower()
        ]
    if req.filters.country:
        items = [i for i in items if i.get("country") == req.filters.country]

    # Uptime filter — key varies by entity type
    uptime_key = "avg_uptime" if "avg_uptime" in (items[0] if items else {}) else "uptime"
    error_key = "avg_error_margin" if "avg_error_margin" in (items[0] if items else {}) else "sensor_error_margin"

    if req.filters.uptime:
        if req.filters.uptime.min is not None:
            items = [i for i in items if i.get(uptime_key, 0) >= req.filters.uptime.min]
        if req.filters.uptime.max is not None:
            items = [i for i in items if i.get(uptime_key, 0) <= req.filters.uptime.max]
    if req.filters.error_margin:
        if req.filters.error_margin.min is not None:
            items = [i for i in items if i.get(error_key, 0) >= req.filters.error_margin.min]
        if req.filters.error_margin.max is not None:
            items = [i for i in items if i.get(error_key, 0) <= req.filters.error_margin.max]

    return items


def _apply_sorting(items: List[Dict[str, Any]], req) -> List[Dict[str, Any]]:
    name_key = "name" if "name" in (items[0] if items else {}) else "device_name"
    uptime_key = "avg_uptime" if "avg_uptime" in (items[0] if items else {}) else "uptime"
    error_key = "avg_error_margin" if "avg_error_margin" in (items[0] if items else {}) else "sensor_error_margin"

    if req.sort:
        sort_key_map = {
            "uptime": uptime_key,
            "error_margin": error_key,
            "name": name_key,
        }
        key = sort_key_map.get(req.sort.field, name_key)
        reverse = req.sort.order == "desc"
        items.sort(key=lambda x: x.get(key, 0) or 0, reverse=reverse)
    else:
        items.sort(key=lambda x: x.get(name_key, ""))

    return items
