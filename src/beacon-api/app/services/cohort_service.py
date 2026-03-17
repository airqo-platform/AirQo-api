import httpx
import logging
import asyncio
from typing import Dict, Any, List, Tuple
from datetime import datetime, timedelta
from app.core.config import settings
from app.utils.performance import PerformanceAnalysis

logger = logging.getLogger(__name__)

async def get_cohorts(token: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}
        
    startDateTime = params.pop("startDateTime", None)
    endDateTime = params.pop("endDateTime", None)
    includePerformance = params.pop("includePerformance", False)
    frequency = params.get("frequency", "hourly")
    
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
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

    if includePerformance and startDateTime and endDateTime:
        await _process_performance_data(cohorts, startDateTime, endDateTime, frequency, include_device_data=False)

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

    async with httpx.AsyncClient(timeout=30.0) as client:
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

        if total_pages <= 1:
            logger.info(f"Fetched {len(all_cohorts)} cohorts (single page)")
            return {"success": True, "cohorts": all_cohorts}

        # Fetch remaining pages in parallel
        async def _fetch_page(page_num: int) -> List[Dict[str, Any]]:
            page_params = {**params, "skip": (page_num - 1) * limit}
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


def _split_date_range(startDateTime: str, endDateTime: str, segment_days: int) -> List[Tuple[str, str]]:
    """
    Split a date range into segments of `segment_days` days each.
    Returns a list of (start, end) ISO-format string pairs.
    """
    fmt = "%Y-%m-%dT%H:%M:%S.000Z"
    start = datetime.fromisoformat(startDateTime.replace("Z", "+00:00"))
    end = datetime.fromisoformat(endDateTime.replace("Z", "+00:00"))
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

    return segments if segments else [(startDateTime, endDateTime)]


async def _fetch_raw_data_for_devices(
    device_names: List[str], startDateTime: str, endDateTime: str, frequency: str,
    semaphore: asyncio.Semaphore = None, max_retries: int = 3
) -> List[Dict[str, Any]]:
    """
    Fetch raw data for a chunk of devices, handling cursor-based pagination.
    Uses a semaphore to limit concurrent requests and avoid 504 timeouts.
    Retries on transient errors (RemoteProtocolError, timeouts) with exponential backoff.
    """
    try:
        platform_token = settings.PLATFORM_API_TOKEN
    except AttributeError:
        platform_token = ""

    base_payload = {
        "network": "airqo",
        "device_category": "lowcost",
        "device_names": device_names,
        "pollutants": ["pm2_5", "pm10"],
        "metaDataFields": ["latitude", "longitude", "battery"],
        "weatherFields": ["temperature", "humidity"],
        "startDateTime": startDateTime,
        "endDateTime": endDateTime,
        "frequency": frequency
    }

    raw_data = []

    async def _do_fetch():
        nonlocal raw_data
        payload = base_payload.copy()
        async with httpx.AsyncClient(timeout=120.0) as data_client:
            data_url = f"{settings.PLATFORM_BASE_URL}/analytics/raw-data?token={platform_token}"

            has_more = True
            while has_more:
                last_error = None
                for attempt in range(1, max_retries + 1):
                    try:
                        data_response = await data_client.post(data_url, json=payload)

                        if data_response.status_code == 200:
                            try:
                                resp_json = data_response.json()
                                raw_data.extend(resp_json.get("data", []))
                                metadata = resp_json.get("metadata", {})
                                has_more = metadata.get("has_more", False)
                                cursor = metadata.get("next")
                                if has_more and cursor:
                                    payload["cursor"] = cursor
                                else:
                                    has_more = False
                            except Exception as e:
                                logger.error(f"Failed to parse raw-data response: {e}")
                                has_more = False
                            break  # success — exit retry loop
                        else:
                            logger.error(
                                f"Failed to fetch raw data for {len(device_names)} devices: "
                                f"{data_response.status_code} (attempt {attempt}/{max_retries})"
                            )
                            has_more = False
                            break  # non-retryable HTTP error

                    except (httpx.RemoteProtocolError, httpx.ReadError, httpx.ConnectError) as e:
                        last_error = e
                        if attempt < max_retries:
                            delay = 2 ** attempt  # 2s, 4s, 8s
                            logger.warning(
                                f"Transient error fetching raw data for {len(device_names)} devices "
                                f"(attempt {attempt}/{max_retries}): {e}. Retrying in {delay}s..."
                            )
                            await asyncio.sleep(delay)
                        else:
                            logger.error(
                                f"Failed to fetch raw data for {len(device_names)} devices "
                                f"after {max_retries} attempts: {e}"
                            )
                            has_more = False

    if semaphore:
        async with semaphore:
            await _do_fetch()
    else:
        await _do_fetch()

    return raw_data


async def _process_performance_data(cohorts: List[Dict[str, Any]], startDateTime: str, endDateTime: str, frequency: str, include_device_data: bool = True) -> None:
    active_devices = set()
    for cohort in cohorts:
        for device in cohort.get("devices", []):
            if device.get("isActive") is True:
                active_devices.add(device.get("name"))

    if not active_devices:
        return

    # Split devices into chunks (larger chunks = fewer requests = less API pressure)
    CHUNK_SIZE = 50
    device_list = list(active_devices)
    device_chunks = [device_list[i:i + CHUNK_SIZE] for i in range(0, len(device_list), CHUNK_SIZE)]

    # Split date range into segments
    DATE_SEGMENT_DAYS = 7
    date_segments = _split_date_range(startDateTime, endDateTime, DATE_SEGMENT_DAYS)

    # Create tasks for every (device_chunk × date_segment) combination
    # Semaphore created here (inside the running event loop) to avoid Python 3.9 loop binding issues
    semaphore = asyncio.Semaphore(2)
    tasks = []
    for chunk in device_chunks:
        for seg_start, seg_end in date_segments:
            tasks.append(_fetch_raw_data_for_devices(chunk, seg_start, seg_end, frequency, semaphore=semaphore))

    logger.info(
        f"Fetching raw data for {len(device_list)} devices: "
        f"{len(device_chunks)} device chunks × {len(date_segments)} date segments = {len(tasks)} parallel tasks"
    )

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Merge all raw data, skipping any failed chunks
    raw_data = []
    for i, chunk_data in enumerate(all_results):
        if isinstance(chunk_data, Exception):
            logger.error(f"Chunk {i} failed with exception: {chunk_data}")
        elif isinstance(chunk_data, list):
            raw_data.extend(chunk_data)

    logger.info(f"Raw data fetched: {len(raw_data)} total records for {len(device_list)} devices")

    analysis = PerformanceAnalysis(raw_data)
    # Adjust expected frequency based on requested frequency
    freq_map = {
        "raw": 2,
        "hourly": 60,
        "daily": 1440
    }
    analysis.expected_frequency_minutes = freq_map.get(frequency, 2)
    
    metrics_map = analysis.compute_device_metrics(startDateTime, endDateTime)
    
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
                        dev["uptime"] = dev_metrics.get("uptime", 0.0)
                        dev["data_completeness"] = dev_metrics.get("data_completeness", 0.0)
                        dev["sensor_error_margin"] = dev_metrics.get("sensor_error_margin", 0.0)
        
        # Calculate cohort average metrics
        cohort_metrics = analysis.compute_cohort_metrics(cohort_device_metrics)
        cohort["uptime"] = cohort_metrics.get("uptime", 0.0)
        cohort["data_completeness"] = cohort_metrics.get("data_completeness", 0.0)
        cohort["sensor_error_margin"] = cohort_metrics.get("sensor_error_margin", 0.0)

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

async def get_cohort(token: str, cohort_id: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    if params is None:
        params = {}
        
    startDateTime = params.pop("startDateTime", None)
    endDateTime = params.pop("endDateTime", None)
    includePerformance = params.pop("includePerformance", False)
    frequency = params.get("frequency", "daily")
    
    headers = {"Authorization": f"JWT {token}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        # First try the specific cohort ID path
        url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts/{cohort_id}"
        logger.debug(f"Fetching cohort from platform: {url}")
        response = await client.get(
            url,
            headers=headers,
            params=params
        )

        if response.status_code == 404:
             # Try fallback 1: remove /devices
             alt_url = f"{settings.PLATFORM_BASE_URL}/cohorts/{cohort_id}"
             logger.info(f"Primary URL {url} failed with 404. Trying fallback URL: {alt_url}")
             response = await client.get(alt_url, headers=headers, params=params)
             
        if response.status_code == 404:
             # Try fallback 2: generic cohorts list with a filter
             logger.warning(f"Platform API returned 404 for {cohort_id}. Attempting to fallback to filtered list.")
             list_url = f"{settings.PLATFORM_BASE_URL}/devices/cohorts"
             list_params = params.copy()
             # If the cohort ID works as a tag or some filter, we could use that, 
             # but here we're just checking if the list has it.
             list_response = await client.get(list_url, headers=headers, params=list_params)
             if list_response.status_code == 200:
                 list_data = list_response.json()
                 cohorts = list_data.get("cohorts", [])
                 cohort = next((c for c in cohorts if c.get("_id") == cohort_id), None)
                 if cohort:
                     platform_response = {"cohort": cohort, "success": True}
                     # We skip the common handling below and proceed
                     if includePerformance and startDateTime and endDateTime:
                        await _process_performance_data([cohort], startDateTime, endDateTime, frequency)
                     return {
                        "success": True,
                        "message": "Cohort fetched successfully (fallback)",
                        "cohort": cohort
                     }

        if response.status_code != 200:
            logger.error(f"Platform API returned error status for cohort {cohort_id}: {response.status_code}")
            logger.error(f"Platform Response: {response.text}")
            return {
                "success": False,
                "message": f"Platform API error: {response.status_code}",
                "status_code": response.status_code
            }

        try:
            platform_response = response.json()
            cohort = platform_response.get("cohort")
            if not cohort:
                # Some APIs return the object directly or under a different key
                # But description says it returns same details, so we expect "cohort" or similar
                # Let's check if "cohort" is in the response.
                if "name" in platform_response: # Probably returned the cohort object directly
                     cohort = platform_response
                elif "cohorts" in platform_response and len(platform_response["cohorts"]) > 0:
                     cohort = platform_response["cohorts"][0]
            
            if not cohort:
                 logger.error(f"Cohort not found in platform response for {cohort_id}. Full response: {platform_response}")
                 return {
                    "success": False,
                    "message": "Cohort not found in platform response",
                    "status_code": 404
                }
        except Exception as e:
            logger.error(f"Failed to parse platform API response for cohort {cohort_id}: {e}")
            return {
                "success": False,
                "message": "Failed to parse platform API response",
                "status_code": 502
            }

    if includePerformance and startDateTime and endDateTime:
        await _process_performance_data([cohort], startDateTime, endDateTime, frequency)

    # Ensure it's inside the structure expected by SingleCohortResponse
    return {
        "success": True,
        "message": "Cohort fetched successfully",
        "cohort": cohort
    }

async def get_cohorts_by_ids(token: str, cohort_ids_str: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    ids = [cid.strip() for cid in cohort_ids_str.split(",") if cid.strip()]
    if not ids:
        return {"success": True, "cohorts": [], "message": "No cohort IDs provided"}

    if params is None:
        params = {}
        
    startDateTime = params.pop("startDateTime", None)
    endDateTime = params.pop("endDateTime", None)
    includePerformance = params.pop("includePerformance", False)
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
    if includePerformance and startDateTime and endDateTime and cohorts:
        await _process_performance_data(cohorts, startDateTime, endDateTime, frequency, include_device_data=True)
    
    return {
        "success": True,
        "message": "Cohorts fetched successfully",
        "cohorts": cohorts,
        "cohort": cohorts[0] if len(cohorts) == 1 else None
    }


def get_cohorts_summary(cohorts: list, db) -> dict:
    """
    Build a summary performance response using pre-computed daily data
    from the sync_device_performance table instead of the raw data API.

    Returns a SummaryCohortResponse-compatible dict.
    """
    from app.crud.crud_device_performance import get_daily_performance_for_devices
    from collections import defaultdict

    # Collect all active device names across all cohorts
    active_devices = set()
    for cohort in cohorts:
        for device in cohort.get("devices", []):
            if device.get("isActive") is True:
                active_devices.add(device.get("name"))

    if not active_devices:
        # Return cohort shells with no data
        summary_cohorts = []
        for cohort in cohorts:
            summary_cohorts.append({
                "_id": cohort.get("_id", ""),
                "name": cohort.get("name", ""),
                "network": cohort.get("network"),
                "numberOfDevices": cohort.get("numberOfDevices"),
                "cohort_tags": cohort.get("cohort_tags", []),
                "uptime": 0.0,
                "error_margin": 0.0,
                "devices": [],
                "data": [],
            })
        return {
            "success": True,
            "message": "Summary performance fetched (no active devices)",
            "cohorts": summary_cohorts,
        }

    # Fetch daily performance records from local DB
    daily_records = get_daily_performance_for_devices(db, list(active_devices))

    # Group by device_name
    device_daily = defaultdict(list)
    device_meta = {}
    for rec in daily_records:
        dname = rec["device_name"]
        device_daily[dname].append(rec)
        # Keep latest metadata per device
        device_meta[dname] = {
            "device_id": rec.get("device_id", ""),
            "latitude": rec.get("latitude"),
            "longitude": rec.get("longitude"),
            "last_active": rec.get("last_active"),
        }

    summary_cohorts = []
    for cohort in cohorts:
        cohort_devices = []
        cohort_daily_map = defaultdict(lambda: {"uptimes": [], "error_margins": []})

        for dev in cohort.get("devices", []):
            d_name = dev.get("name")
            if dev.get("isActive") is not True or d_name not in device_daily:
                continue

            records = device_daily[d_name]
            meta = device_meta.get(d_name, {})

            # Compute per-device averages
            uptimes = [r["uptime"] for r in records]
            errors = [r["error_margin"] for r in records]
            avg_uptime = sum(uptimes) / len(uptimes) if uptimes else 0.0
            avg_error = sum(errors) / len(errors) if errors else 0.0

            cohort_devices.append({
                "device_name": d_name,
                "device_id": meta.get("device_id", ""),
                "latitude": meta.get("latitude"),
                "longitude": meta.get("longitude"),
                "last_active": meta.get("last_active"),
                "uptime": round(avg_uptime, 4),
                "error_margin": round(avg_error, 4),
            })

            # Accumulate daily values for cohort-level aggregation
            for rec in records:
                cohort_daily_map[rec["date"]]["uptimes"].append(rec["uptime"])
                cohort_daily_map[rec["date"]]["error_margins"].append(rec["error_margin"])

        # Build cohort-level daily data (averaged across devices)
        cohort_data = []
        for dt in sorted(cohort_daily_map.keys()):
            vals = cohort_daily_map[dt]
            cohort_data.append({
                "date": dt,
                "uptime": round(sum(vals["uptimes"]) / len(vals["uptimes"]), 4) if vals["uptimes"] else 0.0,
                "error_margin": round(sum(vals["error_margins"]) / len(vals["error_margins"]), 4) if vals["error_margins"] else 0.0,
            })

        # Cohort-level averages
        all_uptimes = [d["uptime"] for d in cohort_devices]
        all_errors = [d["error_margin"] for d in cohort_devices]

        summary_cohorts.append({
            "_id": cohort.get("_id", ""),
            "name": cohort.get("name", ""),
            "network": cohort.get("network"),
            "numberOfDevices": cohort.get("numberOfDevices"),
            "cohort_tags": cohort.get("cohort_tags", []),
            "uptime": round(sum(all_uptimes) / len(all_uptimes), 4) if all_uptimes else 0.0,
            "error_margin": round(sum(all_errors) / len(all_errors), 4) if all_errors else 0.0,
            "devices": cohort_devices,
            "data": cohort_data,
        })

    return {
        "success": True,
        "message": "Summary performance fetched successfully",
        "cohorts": summary_cohorts,
    }

