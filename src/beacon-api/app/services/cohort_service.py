import httpx
import json
import logging
import asyncio
from typing import Dict, Any, List, Tuple, Set, Optional
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.config import settings
from app.models.sync import SyncCohort, SyncCohortDevice, SyncDevice
from app.utils.performance import PerformanceAnalysis
from app.utils.field_mappings import map_record, get_category_mapping
from app.crud.crud_sync_device_data import get_device_data_for_devices

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Local DB-backed cohort fetchers (no Platform API calls)
# ---------------------------------------------------------------------------

def _platform_shape_device(sync_dev: Optional[SyncDevice], device_id: str, is_active: bool) -> Dict[str, Any]:
    """Map a SyncDevice row to the platform-style CohortDevice shape."""
    return {
        "_id": device_id,
        "name": sync_dev.device_name if sync_dev else device_id,
        "device_number": sync_dev.device_number if sync_dev else None,
        "network": sync_dev.network_id if sync_dev else None,
        "category": (sync_dev.category if sync_dev else None) or "lowcost",
        "isActive": bool(is_active),
        "data": [],
    }


def _platform_shape_cohort(
    cohort: SyncCohort,
    devices: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Map a SyncCohort row + its devices to the platform-style Cohort shape."""
    try:
        tags = json.loads(cohort.cohort_tags) if cohort.cohort_tags else []
    except (TypeError, ValueError):
        tags = []
    try:
        codes = json.loads(cohort.cohort_codes) if cohort.cohort_codes else []
    except (TypeError, ValueError):
        codes = []

    created_at = None
    if cohort.platform_created_at is not None:
        try:
            created_at = cohort.platform_created_at.isoformat()
        except Exception:
            created_at = None

    return {
        "_id": cohort.cohort_id,
        "name": cohort.name,
        "network": cohort.network,
        "createdAt": created_at,
        "numberOfDevices": cohort.number_of_devices or len(devices),
        "visibility": bool(cohort.visibility) if cohort.visibility is not None else False,
        "cohort_tags": tags,
        "cohort_codes": codes,
        "groups": [],
        "devices": devices,
        "data": [],
    }


def _hydrate_cohort_devices(db: Session, cohort_ids: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """
    Bulk-load junction rows + sync_device rows for a set of cohort IDs.
    Returns ``{cohort_id: [device_dict, ...]}`` in platform shape.
    """
    if not cohort_ids:
        return {}

    junctions = (
        db.query(SyncCohortDevice)
        .filter(SyncCohortDevice.cohort_id.in_(cohort_ids))
        .all()
    )
    device_ids = {j.device_id for j in junctions}
    sync_devices: Dict[str, SyncDevice] = {}
    if device_ids:
        for d in db.query(SyncDevice).filter(SyncDevice.device_id.in_(device_ids)).all():
            sync_devices[d.device_id] = d

    by_cohort: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for j in junctions:
        by_cohort[j.cohort_id].append(
            _platform_shape_device(
                sync_devices.get(j.device_id), j.device_id, bool(j.is_active)
            )
        )
    return by_cohort


def get_cohorts_from_local(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    tags: Optional[str] = None,
) -> Dict[str, Any]:
    """
    List cohorts from the local sync tables in the platform-compatible shape
    expected by ``CohortResponse``. Source of truth: ``sync_cohort`` /
    ``sync_cohort_device`` / ``sync_device``.
    """
    query = db.query(SyncCohort)

    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(SyncCohort.name.ilike(like), SyncCohort.cohort_id.ilike(like))
        )

    if tags:
        # tags can be a CSV; cohort_tags is stored as a JSON-serialized list,
        # so a substring match against the JSON text is sufficient.
        tag_list = [t.strip() for t in tags.split(",") if t.strip()]
        for t in tag_list:
            query = query.filter(SyncCohort.cohort_tags.ilike(f'%"{t}"%'))

    total = query.count()
    cohorts = (
        query.order_by(SyncCohort.name).offset(skip or 0).limit(limit or 100).all()
    )

    devices_by_cohort = _hydrate_cohort_devices(db, [c.cohort_id for c in cohorts])

    result_cohorts = [
        _platform_shape_cohort(c, devices_by_cohort.get(c.cohort_id, []))
        for c in cohorts
    ]

    return {
        "success": True,
        "message": "Cohorts fetched successfully",
        "meta": {
            "total": total,
            "skip": skip,
            "limit": limit,
        },
        "cohorts": result_cohorts,
    }


def get_cohorts_by_ids_from_local(
    db: Session, cohort_ids_str: str
) -> Dict[str, Any]:
    """
    Look up cohorts by a comma-separated list of cohort IDs from the local
    sync tables, returning the platform-compatible shape.
    """
    ids = [cid.strip() for cid in (cohort_ids_str or "").split(",") if cid.strip()]
    if not ids:
        return {
            "success": True,
            "message": "No cohort IDs provided",
            "cohorts": [],
        }

    cohorts = db.query(SyncCohort).filter(SyncCohort.cohort_id.in_(ids)).all()
    if not cohorts:
        return {
            "success": False,
            "message": "Cohort(s) not found in local sync table",
            "status_code": 404,
            "cohorts": [],
        }

    devices_by_cohort = _hydrate_cohort_devices(db, [c.cohort_id for c in cohorts])
    result_cohorts = [
        _platform_shape_cohort(c, devices_by_cohort.get(c.cohort_id, []))
        for c in cohorts
    ]

    return {
        "success": True,
        "message": "Cohorts fetched successfully",
        "cohorts": result_cohorts,
        "cohort": result_cohorts[0] if len(result_cohorts) == 1 else None,
    }


async def get_cohorts(token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}
        
    start_date_time = params.pop("startDateTime", None)
    end_date_time = params.pop("endDateTime", None)
    include_performance = params.pop("includePerformance", False)
    frequency = params.get("frequency", "hourly")
    
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts"
        response = await client.get(
            url,
            headers=headers,
            params=params
        )

        if response.status_code != 200:
            logger.error(f"Platform API returned error status for cohorts: {response.status_code}")
            return {
                "success": False,
                "message": f"Platform API error: {response.status_code}",
                "status_code": response.status_code,
                "cohorts": []
            }

        try:
            platform_response = response.json()
            cohorts = platform_response.get("cohorts", [])
        except Exception as e:
            logger.error(f"Failed to parse platform API response for cohorts: {e}")
            return {
                "success": False,
                "message": "Failed to parse platform API response",
                "status_code": 502,
                "cohorts": []
            }

    if include_performance and start_date_time and end_date_time:
        await _process_performance_data(cohorts, start_date_time, end_date_time, frequency, include_device_data=False)

    # Put it back inside the platform response structure
    platform_response["cohorts"] = cohorts
    
    return platform_response


async def get_all_cohorts_paginated(token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Fetch ALL cohorts across all pages from the Platform API.
    Fetches page 1 to learn totalPages, then fetches all remaining pages in parallel.
    Returns a dict with 'success', 'cohorts', and optionally 'message'/'status_code'.
    """
    if params is None:
        params = {}

    limit = params.get("limit", 30)
    params["skip"] = params.get("skip", 0)
    params["limit"] = limit

    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts"

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        # Page 1 — learn totalPages
        response = await client.get(url, headers=headers, params=params)
        if response.status_code != 200:
            logger.error(f"Platform API returned error for paginated cohorts: {response.status_code}")
            return {
                "success": False,
                "message": f"Platform API error: {response.status_code}",
                "status_code": response.status_code,
                "cohorts": []
            }

        try:
            resp_json = response.json()
        except Exception as e:
            logger.error(f"Failed to parse paginated cohorts response: {e}")
            return {
                "success": False,
                "message": "Failed to parse platform API response",
                "status_code": 502,
                "cohorts": []
            }

        all_cohorts: List[Dict[str, Any]] = resp_json.get("cohorts", [])
        meta = resp_json.get("meta", {})
        total_pages = meta.get("totalPages", 1)
        actual_limit = meta.get("limit", limit)

        if total_pages <= 1:
            logger.info(f"Fetched {len(all_cohorts)} cohorts (single page)")
            return {"success": True, "cohorts": all_cohorts}

        # Fetch remaining pages in parallel
        async def _fetch_page(page_num: int) -> List[Dict[str, Any]]:
            page_params = {**params, "skip": (page_num - 1) * actual_limit, "limit": actual_limit}
            try:
                page_response = await client.get(url, headers=headers, params=page_params)
                if page_response.status_code != 200:
                    logger.warning(f"Failed to fetch cohorts page {page_num}: {page_response.status_code}")
                    return []
                return page_response.json().get("cohorts", [])
            except Exception as e:
                logger.warning(f"Failed to parse cohorts page {page_num}: {e}")
                return []

        remaining_pages = await asyncio.gather(
            *[_fetch_page(p) for p in range(2, total_pages + 1)]
        )
        for page_cohorts in remaining_pages:
            all_cohorts.extend(page_cohorts)

    logger.info(f"Fetched {len(all_cohorts)} cohorts across {total_pages} pages (parallel)")
    return {"success": True, "cohorts": all_cohorts}


def _split_date_range(start_date_time: str, end_date_time: str, segment_days: int) -> List[Tuple[str, str]]:
    """
    Split a date range into segments of `segment_days` days each.
    Returns a list of (start, end) ISO-format string pairs.
    """
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    start = datetime.fromisoformat(start_date_time.replace("Z", "+00:00"))
    end = datetime.fromisoformat(end_date_time.replace("Z", "+00:00"))
    delta = timedelta(days=segment_days)

    segments = []
    seg_start = start
    while seg_start < end:
        seg_end = min(seg_start + delta, end)
        segments.append((
            seg_start.strftime(fmt),
            seg_end.strftime(fmt)
        ))
        seg_start = seg_end

    return segments if segments else [(start_date_time, end_date_time)]


_TRANSIENT_HTTP_ERRORS = (
    httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError,
)


def _build_raw_data_payload(
    device_names: List[str],
    start_date_time: str,
    end_date_time: str,
    frequency: str,
    device_category: str,
) -> Dict[str, Any]:
    """Construct the analytics raw-data payload for a single category."""
    base = {
        "network": "airqo",
        "device_category": device_category,
        "device_names": device_names,
        "startDateTime": start_date_time,
        "endDateTime": end_date_time,
        "frequency": frequency,
    }
    if device_category == "bam":
        base["pollutants"] = ["pm2_5"]
    else:
        base["pollutants"] = ["pm2_5", "pm10"]
        base["metaDataFields"] = ["latitude", "longitude", "battery"]
        base["weatherFields"] = ["temperature", "humidity"]
    return base


def _consume_raw_data_response(
    resp_json: Dict[str, Any],
    payload: Dict[str, Any],
    raw_data: List[Dict[str, Any]],
) -> bool:
    """
    Append records and update payload's cursor in place.
    Returns True if more pages remain, False otherwise.
    """
    raw_data.extend(resp_json.get("data", []))
    metadata = resp_json.get("metadata", {}) or {}
    cursor = metadata.get("next")
    if metadata.get("has_more") and cursor:
        payload["cursor"] = cursor
        return True
    return False


async def _post_raw_data_with_retries(
    client: httpx.AsyncClient,
    url: str,
    payload: Dict[str, Any],
    raw_data: List[Dict[str, Any]],
    max_retries: int,
    n_devices: int,
) -> Tuple[bool, bool]:
    """
    POST a single page (with retries on transient errors).
    Returns (succeeded, has_more).
    """
    for attempt in range(1, max_retries + 1):
        try:
            data_response = await client.post(url, json=payload)
        except _TRANSIENT_HTTP_ERRORS as e:
            if attempt < max_retries:
                delay = 2 ** attempt
                logger.warning(
                    f"Transient error fetching raw data for {n_devices} devices "
                    f"(attempt {attempt}/{max_retries}): {e}. Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)
                continue
            logger.error(
                f"Failed to fetch raw data for {n_devices} devices "
                f"after {max_retries} attempts: {e}"
            )
            return False, False

        if data_response.status_code != 200:
            logger.error(
                f"Failed to fetch raw data for {n_devices} devices: "
                f"{data_response.status_code} (attempt {attempt}/{max_retries})"
            )
            return False, False

        try:
            has_more = _consume_raw_data_response(data_response.json(), payload, raw_data)
        except Exception as e:
            logger.error(f"Failed to parse raw-data response: {e}")
            return False, False
        return True, has_more

    return False, False


async def _fetch_all_pages(
    payload: Dict[str, Any],
    raw_data: List[Dict[str, Any]],
    max_retries: int,
    n_devices: int,
) -> None:
    """Iterate cursor-paginated raw-data calls until exhausted."""
    try:
        platform_token = settings.PLATFORM_API_TOKEN
    except AttributeError:
        platform_token = ""
    url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={platform_token}"

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as data_client:
        has_more = True
        while has_more:
            ok, has_more = await _post_raw_data_with_retries(
                data_client, url, payload, raw_data, max_retries, n_devices,
            )
            if not ok:
                return


async def _fetch_raw_data_for_devices(
    device_names: List[str], start_date_time: str, end_date_time: str, frequency: str,
    device_category: str = "lowcost",
    semaphore: asyncio.Semaphore = None, max_retries: int = 3
) -> List[Dict[str, Any]]:
    """
    Fetch raw data for a chunk of devices, handling cursor-based pagination.
    Uses a semaphore to limit concurrent requests and avoid 504 timeouts.
    Retries on transient errors (RemoteProtocolError, timeouts) with exponential backoff.
    """
    payload = _build_raw_data_payload(
        device_names, start_date_time, end_date_time, frequency, device_category,
    )
    raw_data: List[Dict[str, Any]] = []

    if semaphore:
        async with semaphore:
            await _fetch_all_pages(payload, raw_data, max_retries, len(device_names))
    else:
        await _fetch_all_pages(payload, raw_data, max_retries, len(device_names))

    return raw_data


async def _process_performance_data(cohorts: List[Dict[str, Any]], start_date_time: str, end_date_time: str, frequency: str, include_device_data: bool = True) -> None:
    # Group devices by category to fetch raw data correctly
    devices_by_category: Dict[str, Set[str]] = {}
    device_to_category: Dict[str, str] = {}
    
    for cohort in cohorts:
        for device in cohort.get("devices", []):
            if device.get("isActive") is True:
                name = device.get("name")
                # Default to lowcost if category is missing
                cat = device.get("category", "lowcost")
                devices_by_category.setdefault(cat, set()).add(name)
                device_to_category[name] = cat

    if not devices_by_category:
        return

    # Split date range into segments
    DATE_SEGMENT_DAYS = 7
    date_segments = _split_date_range(start_date_time, end_date_time, DATE_SEGMENT_DAYS)
    CHUNK_SIZE = 50

    semaphore = asyncio.Semaphore(2)
    tasks = []
    
    for cat, names in devices_by_category.items():
        name_list = list(names)
        for i in range(0, len(name_list), CHUNK_SIZE):
            chunk = name_list[i : i + CHUNK_SIZE]
            for seg_start, seg_end in date_segments:
                tasks.append(_fetch_raw_data_for_devices(
                    chunk, seg_start, seg_end, frequency, 
                    device_category=cat, semaphore=semaphore
                ))

    logger.info(
        f"Fetching raw data for {len(device_to_category)} devices across {len(devices_by_category)} categories: "
        f"{len(tasks)} parallel tasks"
    )

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge all raw data, skipping any failed chunks
    raw_data = []
    for i, chunk_data in enumerate(all_results):
        if isinstance(chunk_data, Exception):
            logger.error(f"Chunk {i} failed with exception: {chunk_data}")
        elif isinstance(chunk_data, list):
            raw_data.extend(chunk_data)

    logger.info(f"Raw data fetched: {len(raw_data)} total records for {len(device_to_category)} devices")

    analysis = PerformanceAnalysis(raw_data)
    # Adjust expected frequency based on requested frequency
    freq_map = {
        "raw": 2,
        "hourly": 60,
        "daily": 1440
    }
    analysis.expected_frequency_minutes = freq_map.get(frequency, 2)
    
    # We need to compute metrics per category because the metrics themselves differ
    metrics_map = {}
    for cat, names in devices_by_category.items():
        # Filter raw data for this category
        cat_raw_data = [r for r in raw_data if r.get("device_name") in names]
        cat_analysis = PerformanceAnalysis(cat_raw_data)
        cat_analysis.expected_frequency_minutes = analysis.expected_frequency_minutes
        cat_metrics = cat_analysis.compute_device_metrics(start_date_time, end_date_time, device_category=cat)
        metrics_map.update(cat_metrics)
    
    # Group raw data by device for the "data" field
    device_raw_data = {}
    for record in raw_data:
        d_name = record.get("device_name")
        if d_name:
            if d_name not in device_raw_data:
                device_raw_data[d_name] = []
            device_raw_data[d_name].append(record)

    # Map the performance data back to the relevant cohorts
    for cohort in cohorts:
        cohort_device_metrics = {}
        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if dev.get("isActive") is True:
                dev_raw = device_raw_data.get(d_name, [])
                if include_device_data:
                    # Add raw data to device level
                    dev["data"] = dev_raw
                
                if d_name in metrics_map:
                    dev_metrics = metrics_map[d_name]
                    cohort_device_metrics[d_name] = dev_metrics
                    if include_device_data:
                        # Add metrics to device level
                        cat = device_to_category.get(d_name, "lowcost")
                        dev["uptime"] = dev_metrics.get("uptime", 0.0)
                        dev["data_completeness"] = dev_metrics.get("data_completeness", 0.0)
                        if cat == "bam":
                            dev["realtime_conc_average"] = dev_metrics.get("realtime_conc_average")
                            dev["short_time_conc_average"] = dev_metrics.get("short_time_conc_average")
                            dev["hourly_conc_average"] = dev_metrics.get("hourly_conc_average")
                        else:
                            dev["sensor_error_margin"] = dev_metrics.get("sensor_error_margin", 0.0)
        
        # Calculate cohort average metrics (this might be tricky if mixed)
        # For now, we'll just use the existing compute_cohort_metrics which averages whatever is in the dict
        cohort_metrics = analysis.compute_cohort_metrics(cohort_device_metrics)
        cohort["uptime"] = cohort_metrics.get("uptime", 0.0)
        cohort["data_completeness"] = cohort_metrics.get("data_completeness", 0.0)
        cohort["sensor_error_margin"] = cohort_metrics.get("sensor_error_margin", 0.0)
        # BAM metrics are not usually averaged at cohort level in the same way, but we could add them if needed

        # Aggregate data from all devices in the cohort to get "cohort data"
        cohort_data_map = {}
        numeric_fields = ["pm2_5", "pm10", "s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10", "temperature", "humidity", "battery"]
        
        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if dev.get("isActive") is True:
                dev_raw = device_raw_data.get(d_name, [])
                for record in dev_raw:
                    dt = record.get("datetime")
                    if not dt:
                        continue
                    if dt not in cohort_data_map:
                        cohort_data_map[dt] = {f: [] for f in numeric_fields}
                        cohort_data_map[dt]["_devices_with_data"] = set()
                    
                    has_numeric_data = False
                    for field in numeric_fields:
                        val = record.get(field)
                        if val is not None:
                            try:
                                cohort_data_map[dt][field].append(float(val))
                                has_numeric_data = True
                            except (ValueError, TypeError):
                                pass
                    
                    if has_numeric_data and d_name:
                        cohort_data_map[dt]["_devices_with_data"].add(d_name)
        
        # Average the aggregated data
        aggregated_data = []
        sorted_times = sorted(cohort_data_map.keys())
        for dt in sorted_times:
            avg_record = {
                "datetime": dt, 
                "device_name": cohort.get("name"), 
                "frequency": frequency,
                "devices_with_data": len(cohort_data_map[dt].get("_devices_with_data", set()))
            }
            for field in numeric_fields:
                values = cohort_data_map[dt].get(field, [])
                if values:
                    avg_record[field] = sum(values) / len(values)
                else:
                    avg_record[field] = None
            aggregated_data.append(avg_record)
        
        cohort["data"] = aggregated_data

def _extract_cohort_from_payload(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Pull the cohort dict out of various platform response shapes."""
    cohort = payload.get("cohort")
    if cohort:
        return cohort
    if "name" in payload:
        return payload
    cohorts = payload.get("cohorts") or []
    return cohorts[0] if cohorts else None


async def _try_list_fallback(
    client: httpx.AsyncClient, headers: Dict[str, str],
    params: Dict[str, Any], cohort_id: str,
) -> Optional[Dict[str, Any]]:
    """Last-resort fallback: pull from the generic cohorts list and filter."""
    list_url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts"
    list_response = await client.get(list_url, headers=headers, params=params.copy())
    if list_response.status_code != 200:
        return None
    cohorts = list_response.json().get("cohorts", [])
    return next((c for c in cohorts if c.get("_id") == cohort_id), None)


async def _fetch_cohort_from_platform(
    client: httpx.AsyncClient, headers: Dict[str, str],
    params: Dict[str, Any], cohort_id: str,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """
    Fetch a cohort from the platform with two URL fallbacks + a list fallback.
    Returns (cohort, error_dict). Exactly one of those is non-None on success/failure.
    """
    primary_url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts/{cohort_id}"
    logger.debug(f"Fetching cohort from platform: {primary_url}")
    response = await client.get(primary_url, headers=headers, params=params)

    if response.status_code == 404:
        alt_url = f"{settings.PLATFORM_BASE_URL}/cohorts/{cohort_id}"
        logger.info(f"Primary URL {primary_url} failed with 404. Trying fallback URL: {alt_url}")
        response = await client.get(alt_url, headers=headers, params=params)

    if response.status_code == 404:
        logger.warning(f"Platform API returned 404 for {cohort_id}. Attempting to fallback to filtered list.")
        cohort = await _try_list_fallback(client, headers, params, cohort_id)
        if cohort:
            return cohort, None

    if response.status_code != 200:
        logger.error(
            f"Platform API returned error status for cohort {cohort_id}: {response.status_code}"
        )
        logger.error(f"Platform Response: {response.text}")
        return None, {
            "success": False,
            "message": f"Platform API error: {response.status_code}",
            "status_code": response.status_code,
        }

    try:
        cohort = _extract_cohort_from_payload(response.json())
    except Exception as e:
        logger.error(f"Failed to parse platform API response for cohort {cohort_id}: {e}")
        return None, {
            "success": False,
            "message": "Failed to parse platform API response",
            "status_code": 502,
        }

    if not cohort:
        logger.error(f"Cohort not found in platform response for {cohort_id}.")
        return None, {
            "success": False,
            "message": "Cohort not found in platform response",
            "status_code": 404,
        }
    return cohort, None


async def get_cohort(token: str, cohort_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}

    start_date_time = params.pop("startDateTime", None)
    end_date_time = params.pop("endDateTime", None)
    include_performance = params.pop("includePerformance", False)
    frequency = params.get("frequency", "daily")

    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        cohort, error = await _fetch_cohort_from_platform(client, headers, params, cohort_id)
        if error is not None:
            return error

    if include_performance and start_date_time and end_date_time:
        await _process_performance_data([cohort], start_date_time, end_date_time, frequency)

    return {
        "success": True,
        "message": "Cohort fetched successfully",
        "cohort": cohort,
    }

async def get_cohorts_by_ids(token: str, cohort_ids_str: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    ids = [cid.strip() for cid in cohort_ids_str.split(",") if cid.strip()]
    if not ids:
        return {"success": True, "cohorts": [], "message": "No cohort IDs provided"}

    if params is None:
        params = {}
        
    start_date_time = params.pop("startDateTime", None)
    end_date_time = params.pop("endDateTime", None)
    include_performance = params.pop("includePerformance", False)
    frequency = params.get("frequency", "daily")
    
    # Temporarily remove performance fetching from the individual get_cohort calls
    # so we can batch them and call _process_performance_data once
    sub_params = params.copy()
    sub_params.pop("includePerformance", None)
    sub_params.pop("startDateTime", None)
    sub_params.pop("endDateTime", None)
    
    tasks = [get_cohort(token, cid, sub_params.copy()) for cid in ids]
    results = await asyncio.gather(*tasks)
    
    cohorts = []
    has_error = False
    last_error_code = 400
    last_error_message = "Error fetching data from platform"
    
    for res in results:
        if res.get("success") and res.get("cohort"):
            cohorts.append(res.get("cohort"))
        else:
            has_error = True
            if not res.get("success"):
                last_error_code = res.get("status_code", 400)
                last_error_message = res.get("message", last_error_message)

    if not cohorts and has_error:
        # If no cohorts succeeded and there are errors
        return {
            "success": False,
            "message": last_error_message,
            "status_code": last_error_code
        }
        
    # Process performance data in bulk for all returned cohorts concurrently
    if include_performance and start_date_time and end_date_time and cohorts:
        await _process_performance_data(cohorts, start_date_time, end_date_time, frequency, include_device_data=True)
    
    return {
        "success": True,
        "message": "Cohorts fetched successfully",
        "cohorts": cohorts,
        "cohort": cohorts[0] if len(cohorts) == 1 else None
    }


def _parse_iso(value: str) -> datetime:
    """Parse an ISO 8601 string into an aware datetime (UTC if naive)."""
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _bucket_key(dt_str: str, use_days: bool) -> Optional[str]:
    """Map a record timestamp to its uptime bucket key, or None on failure."""
    try:
        if use_days:
            if "T" in dt_str:
                return _parse_iso(dt_str).date().isoformat()
            return dt_str[:10]
        return _parse_iso(dt_str).strftime("%Y-%m-%dT%H")
    except (ValueError, TypeError):
        return None


def _total_buckets(start_dt: datetime, end_dt: datetime, use_days: bool) -> int:
    if use_days:
        return max(1, int((end_dt.date() - start_dt.date()).days) + 1)
    return max(1, int((end_dt - start_dt).total_seconds() // 3600))


def _compute_uptime(
    records: List[Dict[str, Any]],
    start: str,
    end: str,
    frequency: str,
) -> float:
    """
    Uptime = percentage of buckets in [start, end] that contain ≥1 datapoint.

    Bucket size:
        - ``raw`` / ``hourly``  → 1 hour
        - ``daily``             → 1 day
    """
    if not records:
        return 0.0
    try:
        start_dt = _parse_iso(start)
        end_dt = _parse_iso(end)
    except (ValueError, TypeError):
        return 0.0
    if end_dt <= start_dt:
        return 0.0

    use_days = frequency == "daily"
    total = _total_buckets(start_dt, end_dt, use_days)

    seen: set = set()
    for rec in records:
        dt_str = rec.get("datetime")
        if not dt_str:
            continue
        bucket = _bucket_key(dt_str, use_days)
        if bucket is not None:
            seen.add(bucket)

    if not seen:
        return 0.0
    return round(min(len(seen) / total, 1.0) * 100.0, 2)


def _mean(values: List[float]) -> Optional[float]:
    vals = [v for v in values if isinstance(v, (int, float))]
    if not vals:
        return None
    return round(sum(vals) / len(vals), 4)


def _compute_device_averages(
    mapped_records: List[Dict[str, Any]], category: str
) -> Dict[str, Any]:
    """
    Mean of every mapped numeric label present in ``mapped_records``.

    For ``lowcost`` we additionally surface a derived ``pm2.5`` value: the
    mean of the two per-sensor averages (``pm2.5 sensor1`` / ``pm2.5 sensor2``).
    """
    mapping = get_category_mapping(category)
    labels = list(mapping.values())

    averages: Dict[str, Any] = {}
    for label in labels:
        values = [r.get(label) for r in mapped_records if r.get(label) is not None]
        avg = _mean(values)
        if avg is not None:
            averages[label] = avg

    if category == "lowcost":
        s1 = averages.get("pm2.5 sensor1")
        s2 = averages.get("pm2.5 sensor2")
        components = [v for v in (s1, s2) if v is not None]
        if components:
            averages["pm2.5"] = round(sum(components) / len(components), 4)

    return averages


def compute_device_performance(
    db: Session,
    device_names: List[str],
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
) -> Dict[str, Dict[str, Any]]:
    """
    Read locally-synced ThingSpeak data and return per-device performance.

    Returns a dict keyed by ``device_name`` with::

        {
            "category":          "lowcost" | "bam" | ...,
            "uptime":            <pct of buckets with >=1 datapoint>,
            "data_completeness": <same as uptime>,
            "averages":          {<mapped_label>: <mean>, ...},
            "data":              [<mapped record>, ...],
            "device_id":         <SyncDevice.device_id or "">,
            "device_number":     <SyncDevice.device_number or None>,
        }

    ``frequency`` selects the source table:
        - ``raw``    → sync_raw_device_data
        - ``hourly`` → sync_hourly_device_data
        - ``daily``  → sync_daily_device_data
    """
    frequency = (frequency or "hourly").lower()
    names = [n for n in (device_names or []) if n]
    if not names:
        return {}

    records_by_device, info_by_name = get_device_data_for_devices(
        db, names, start_date_time, end_date_time, frequency=frequency,
    )

    out: Dict[str, Dict[str, Any]] = {}
    for name in names:
        info = info_by_name.get(name) or {}
        category = info.get("category") or "lowcost"
        raw_records = records_by_device.get(name, [])
        mapped = [map_record(r, category) for r in raw_records]
        uptime = _compute_uptime(raw_records, start_date_time, end_date_time, frequency)
        averages = _compute_device_averages(mapped, category)
        out[name] = {
            "category": category,
            "uptime": uptime,
            "data_completeness": uptime,
            "averages": averages,
            "data": mapped,
            "device_id": info.get("device_id", ""),
            "device_number": info.get("device_number"),
        }
    return out


_TIME_SERIES_EXCLUDED_KEYS = frozenset({
    "datetime", "frequency", "device_name",
    "device_id", "channel_id", "entry_id",
    "complete",
})


def _collect_active_device_names(cohorts: List[Dict[str, Any]]) -> Set[str]:
    """Return the set of names of all active devices across cohorts."""
    names: Set[str] = set()
    for cohort in cohorts:
        for dev in cohort.get("devices", []):
            if dev.get("isActive") is True and dev.get("name"):
                names.add(dev["name"])
    return names


def _zero_out_cohorts(cohorts: List[Dict[str, Any]]) -> None:
    for cohort in cohorts:
        cohort["uptime"] = 0.0
        cohort["data_completeness"] = 0.0
        cohort["averages"] = {}
        cohort["data"] = []


def _build_per_device_metrics(
    device_names: Set[str],
    records_by_device: Dict[str, List[Dict[str, Any]]],
    info_by_name: Dict[str, Dict[str, Any]],
    start_date_time: str,
    end_date_time: str,
    frequency: str,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, List[Dict[str, Any]]]]:
    """Compute per-device mapped records + metrics dicts."""
    per_device_metrics: Dict[str, Dict[str, Any]] = {}
    mapped_by_device: Dict[str, List[Dict[str, Any]]] = {}

    for name in device_names:
        info = info_by_name.get(name) or {}
        category = info.get("category") or "lowcost"
        raw_records = records_by_device.get(name, [])
        mapped = [map_record(r, category) for r in raw_records]
        mapped_by_device[name] = mapped

        uptime = _compute_uptime(raw_records, start_date_time, end_date_time, frequency)
        averages = _compute_device_averages(mapped, category)
        per_device_metrics[name] = {
            "uptime": uptime,
            "data_completeness": uptime,
            "averages": averages,
            "category": category,
        }
    return per_device_metrics, mapped_by_device


def _enrich_cohort_devices(
    cohort: Dict[str, Any],
    per_device_metrics: Dict[str, Dict[str, Any]],
    mapped_by_device: Dict[str, List[Dict[str, Any]]],
) -> Tuple[List[float], Dict[str, List[float]]]:
    """
    Mutate each active device with data/metrics and return per-device uptimes
    and an averages accumulator for cohort-level aggregation.
    """
    device_uptimes: List[float] = []
    averages_accumulator: Dict[str, List[float]] = defaultdict(list)

    for dev in cohort.get("devices", []):
        d_name = dev.get("name")
        if dev.get("isActive") is not True or not d_name:
            continue

        dev["data"] = mapped_by_device.get(d_name, [])
        metrics = per_device_metrics.get(d_name)
        if not metrics:
            dev["uptime"] = 0.0
            dev["data_completeness"] = 0.0
            dev["averages"] = {}
            continue

        dev["uptime"] = metrics["uptime"]
        dev["data_completeness"] = metrics["data_completeness"]
        dev["averages"] = metrics["averages"]
        device_uptimes.append(metrics["uptime"])
        for label, value in metrics["averages"].items():
            averages_accumulator[label].append(value)

    return device_uptimes, averages_accumulator


def _accumulate_record_into_series(
    rec: Dict[str, Any],
    series_map: Dict[str, Dict[str, List[float]]],
) -> None:
    dt = rec.get("datetime")
    if not dt:
        return
    bucket = series_map[dt]
    for key, value in rec.items():
        if key in _TIME_SERIES_EXCLUDED_KEYS:
            continue
        if isinstance(value, (int, float)):
            bucket[key].append(value)


def _build_series_map(
    cohort: Dict[str, Any],
) -> Dict[str, Dict[str, List[float]]]:
    series_map: Dict[str, Dict[str, List[float]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for dev in cohort.get("devices", []):
        if dev.get("isActive") is not True:
            continue
        for rec in dev.get("data", []) or []:
            _accumulate_record_into_series(rec, series_map)
    return series_map


def _series_map_to_rows(
    series_map: Dict[str, Dict[str, List[float]]], frequency: str,
) -> List[Dict[str, Any]]:
    aggregated: List[Dict[str, Any]] = []
    for dt in sorted(series_map.keys()):
        row: Dict[str, Any] = {"datetime": dt, "frequency": frequency}
        for key, vals in series_map[dt].items():
            avg = _mean(vals)
            if avg is not None:
                row[key] = avg
        aggregated.append(row)
    return aggregated


def _aggregate_cohort_time_series(
    cohort: Dict[str, Any], frequency: str,
) -> List[Dict[str, Any]]:
    """Build a time series averaged across active devices per timestamp."""
    return _series_map_to_rows(_build_series_map(cohort), frequency)


def apply_local_performance(
    cohorts: List[Dict[str, Any]],
    db: Session,
    start_date_time: str,
    end_date_time: str,
    frequency: str = "hourly",
) -> None:
    """
    Enrich ``cohorts`` in place using locally-synced ThingSpeak data.

    For each active device in each cohort we attach:
        - ``data``: mapped records (field1..20 → readable labels per category)
        - ``uptime`` (% of time-buckets with ≥1 datapoint)
        - ``data_completeness`` (same as uptime, kept for backwards compatibility)
        - ``averages`` (mean of each mapped numeric field)

    Each cohort also receives ``uptime`` / ``data_completeness`` /
    ``averages`` (averaged across its active devices) plus a ``data``
    time-series aggregated across devices at each timestamp.

    ``frequency`` selects the source table:
        - ``raw``    → sync_raw_device_data
        - ``hourly`` → sync_hourly_device_data
        - ``daily``  → sync_daily_device_data
    """
    frequency = (frequency or "hourly").lower()

    all_device_names = _collect_active_device_names(cohorts)
    if not all_device_names:
        _zero_out_cohorts(cohorts)
        return

    records_by_device, info_by_name = get_device_data_for_devices(
        db, list(all_device_names), start_date_time, end_date_time, frequency=frequency,
    )

    per_device_metrics, mapped_by_device = _build_per_device_metrics(
        all_device_names, records_by_device, info_by_name,
        start_date_time, end_date_time, frequency,
    )

    for cohort in cohorts:
        device_uptimes, averages_accumulator = _enrich_cohort_devices(
            cohort, per_device_metrics, mapped_by_device,
        )
        cohort_uptime = _mean(device_uptimes) or 0.0
        cohort["uptime"] = cohort_uptime
        cohort["data_completeness"] = cohort_uptime
        cohort["averages"] = {
            label: _mean(vals) for label, vals in averages_accumulator.items()
        }
        cohort["data"] = _aggregate_cohort_time_series(cohort, frequency)


def get_cohorts_summary(cohorts: list, db) -> dict:
    """
    Deprecated compatibility shim — prefer :func:`apply_local_performance`.

    Kept so older callers don't break. It now enriches cohorts in place
    using the daily local-sync tables and returns the same shape.
    """
    logger.warning(
        "get_cohorts_summary is deprecated; use apply_local_performance with "
        "an explicit date range + frequency instead."
    )
    end_dt = datetime.now(tz=timezone.utc)
    start_dt = end_dt - timedelta(days=7)
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    apply_local_performance(
        cohorts,
        db,
        start_dt.strftime(fmt),
        end_dt.strftime(fmt),
        frequency="daily",
    )
    return {
        "success": True,
        "message": "Summary performance fetched successfully (default 7d window)",
        "cohorts": cohorts,
    }


