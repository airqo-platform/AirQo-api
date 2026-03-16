import logging
import asyncio
import json
import httpx
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import cohort_service
from app.utils.performance import PerformanceAnalysis
from app.crud import crud_device_performance

logger = logging.getLogger(__name__)

# Module-level scheduler reference
_scheduler = None


def _extract_jwt_token() -> str:
    """
    Extract the raw JWT token from settings.TOKEN.
    settings.TOKEN is stored as 'JWT eyJ...' so we strip the prefix.
    """
    raw = settings.TOKEN
    if raw.startswith("JWT "):
        return raw[4:]
    return raw


def _sanitize_metric(value, ndigits=4) -> float:
    import math
    if value is None:
        return 0.0
    if math.isnan(value) or math.isinf(value):
        return 0.0
    return round(value, ndigits)


def _parse_thingspeak_field(value) -> "float | None":
    """Safely parse a ThingSpeak field value to float."""
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


async def _fetch_feeds_for_device(
    device_number: int, device_name: str, token: str
) -> List[Dict[str, Any]]:
    """
    Fetch recent feeds from ThingSpeak for a single device and convert
    each entry into the format PerformanceAnalysis expects:
      {device_name, datetime, pm2_5, s1_pm2_5, s2_pm2_5}

    ThingSpeak field mapping (AirQo convention):
      field1 → s1_pm2_5  (sensor 1 PM2.5)
      field3 → s2_pm2_5  (sensor 2 PM2.5)
      pm2_5  → average of s1 and s2
    """
    url = f"{settings.PLATFORM_BASE_URL}/devices/feeds/recent/{device_number}"
    headers = {"Authorization": f"JWT {token}"}

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            body = resp.json()
    except Exception as exc:
        logger.warning(
            f"[Feeds Fallback] Failed to fetch feeds for {device_name} "
            f"(device_number={device_number}): {exc}"
        )
        return []

    # The response can be a single object or a list of feed entries
    entries = body if isinstance(body, list) else [body]

    records: List[Dict[str, Any]] = []
    for entry in entries:
        created_at = entry.get("created_at")
        if not created_at:
            continue

        s1_pm2_5 = _parse_thingspeak_field(entry.get("field1"))
        s2_pm2_5 = _parse_thingspeak_field(entry.get("field3"))

        # Compute average pm2_5 from the two sensors
        pm2_5 = None
        if s1_pm2_5 is not None and s2_pm2_5 is not None:
            pm2_5 = (s1_pm2_5 + s2_pm2_5) / 2.0
        elif s1_pm2_5 is not None:
            pm2_5 = s1_pm2_5
        elif s2_pm2_5 is not None:
            pm2_5 = s2_pm2_5

        records.append({
            "device_name": device_name,
            "datetime": created_at,
            "pm2_5": pm2_5,
            "s1_pm2_5": s1_pm2_5,
            "s2_pm2_5": s2_pm2_5,
        })

    return records


async def compute_and_store_performance(
    days: int = 14,
    force: bool = False,
    complete: bool = False,
    tags: Optional[List[str]] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Dict[str, Any]:
    """
    Fetch all cohorts, retrieve raw data for the last `days` days (or from start_date to end_date),
    then compute and store **per-device, per-day** performance records.

    For devices that return NO data from the analytics API, we fall back
    to the ThingSpeak feeds endpoint using their device_number.
    Even if NO data is found for a device on a given day, it will get a 0 record.

    Args:
        days: Lookback period (each day gets its own row per device).
        force: If True, recompute even for days that already have complete data.
        complete: Completeness flag for *today's* record.
                  Past days are always marked complete (the day is over).
                  The daily cron passes complete=True; manual triggers pass False
                  so the cron will recompute tonight with full data.
        tags: Optional cohort tags to filter by.
        start_date: Optional custom start date for computation.
        end_date: Optional custom end date for computation.

    Returns a summary dict.
    """
    import asyncio
    from collections import defaultdict

    today = date.today()
    db = SessionLocal()

    try:
        token = _extract_jwt_token()

        # --- 1. Fetch cohorts (paginated) ---
        logger.info(f"[Performance Sync] Fetching cohorts (tags={tags})...")
        cohort_params = {}
        if tags:
            # cohort_service.get_all_cohorts_paginated handles tags in its params
            cohort_params["tags"] = ",".join(tags)

        result = await cohort_service.get_all_cohorts_paginated(token, cohort_params)

        if not result.get("success", True):
            msg = result.get("message", "Failed to fetch cohorts")
            logger.error(f"[Performance Sync] {msg}")
            return {"success": False, "message": msg}

        cohorts = result.get("cohorts", [])
        if not cohorts:
            logger.warning("[Performance Sync] No cohorts found.")
            return {"success": True, "message": "No cohorts found", "devices_synced": 0}

        # --- 2. Collect active device metadata (including device_number) ---
        device_info: Dict[str, Dict[str, Any]] = {}
        for cohort in cohorts:
            cohort_name = cohort.get("name", "")
            for dev in cohort.get("devices", []):
                if not dev.get("isActive"):
                    continue
                d_name = dev.get("name")
                if not d_name:
                    continue
                if d_name not in device_info:
                    device_info[d_name] = {
                        "device_id": dev.get("_id", ""),
                        "device_number": dev.get("device_number"),
                        "latitude": dev.get("latitude"),
                        "longitude": dev.get("longitude"),
                        "last_active": dev.get("lastActive"),
                        "cohorts": set(),
                    }
                device_info[d_name]["cohorts"].add(cohort_name)

        device_names = list(device_info.keys())
        if not device_names:
            logger.warning("[Performance Sync] No active devices found.")
            return {"success": True, "message": "No active devices", "devices_synced": 0}

        # --- 3. Determine which days need computation ---
        if start_date and end_date:
            # Custom date range
            start_of_range_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
            end_of_range_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
        elif start_date:
             # Custom start to today
            start_of_range_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
            end_of_range_dt = datetime.now(timezone.utc)
        else:
            # Default last X days
            end_of_range_dt = datetime.now(timezone.utc)
            start_of_range_dt = end_of_range_dt - timedelta(days=days)

        days_to_compute = []
        current = start_of_range_dt.date()
        target_end_date = end_of_range_dt.date()
        while current <= target_end_date:
            # We skip force check if we have tags or custom dates, as those are usually manual triggers
            is_manual = bool(tags or start_date or end_date)
            if force or is_manual or not crud_device_performance.has_complete_records_for_date(db, current):
                days_to_compute.append(current)
            current += timedelta(days=1)

        if not days_to_compute:
            logger.info("[Performance Sync] All days already have complete data. Nothing to do.")
            return {
                "success": True,
                "skipped": True,
                "message": "All requested days already have complete data",
            }

        logger.info(
            f"[Performance Sync] {len(days_to_compute)} days to compute for "
            f"{len(device_names)} devices"
        )

        # --- 4. Fetch raw data for the full window (one batch) ---
        start_dt_str = start_of_range_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        end_dt_str = end_of_range_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        frequency = "hourly"

        CHUNK_SIZE = 50
        chunks = [device_names[i:i + CHUNK_SIZE] for i in range(0, len(device_names), CHUNK_SIZE)]

        DATE_SEGMENT_DAYS = 7
        date_segments = cohort_service._split_date_range(start_dt_str, end_dt_str, DATE_SEGMENT_DAYS)

        semaphore = asyncio.Semaphore(2)
        tasks = []
        for chunk in chunks:
            for seg_start, seg_end in date_segments:
                tasks.append(
                    cohort_service._fetch_raw_data_for_devices(
                        chunk, seg_start, seg_end, frequency, semaphore=semaphore
                    )
                )

        logger.info(
            f"[Performance Sync] Fetching raw data: "
            f"{len(chunks)} device chunks × {len(date_segments)} date segments = {len(tasks)} tasks"
        )

        all_results = await asyncio.gather(*tasks, return_exceptions=True)

        raw_data = []
        for i, chunk_data in enumerate(all_results):
            if isinstance(chunk_data, Exception):
                logger.error(f"[Performance Sync] Chunk {i} failed: {chunk_data}")
            elif isinstance(chunk_data, list):
                raw_data.extend(chunk_data)

        logger.info(f"[Performance Sync] Fetched {len(raw_data)} total raw records")

        # --- 5. Group raw data by device_name + date ---
        device_date_data: Dict[str, Dict[date, List]] = defaultdict(lambda: defaultdict(list))
        for record in raw_data:
            d_name = record.get("device_name")
            dt_str = record.get("datetime")
            if d_name and dt_str:
                try:
                    record_date = datetime.fromisoformat(
                        dt_str.replace("Z", "+00:00")
                    ).date()
                    device_date_data[d_name][record_date].append(record)
                except (ValueError, TypeError):
                    pass

        # --- 5b. ThingSpeak Feeds Fallback ---
        # Identify devices that have ZERO raw data across all days to compute.
        # For these "missing" devices, fetch data from the feeds endpoint.
        devices_with_data = set(device_date_data.keys())
        missing_devices = [
            d_name for d_name in device_names
            if d_name not in devices_with_data
            and device_info[d_name].get("device_number") is not None
        ]

        if missing_devices:
            logger.info(
                f"[Feeds Fallback] {len(missing_devices)} devices have no analytics data. "
                f"Fetching from ThingSpeak feeds..."
            )

            feeds_semaphore = asyncio.Semaphore(5)

            async def _fetch_with_semaphore(d_name: str) -> List[Dict[str, Any]]:
                async with feeds_semaphore:
                    return await _fetch_feeds_for_device(
                        device_info[d_name]["device_number"], d_name, token
                    )

            feeds_tasks = [_fetch_with_semaphore(d_name) for d_name in missing_devices]
            feeds_results = await asyncio.gather(*feeds_tasks, return_exceptions=True)

            feeds_record_count = 0
            for d_name, feed_result in zip(missing_devices, feeds_results):
                if isinstance(feed_result, Exception):
                    logger.error(f"[Feeds Fallback] {d_name} failed: {feed_result}")
                    continue
                if not feed_result:
                    continue

                for record in feed_result:
                    dt_str = record.get("datetime")
                    if dt_str:
                        try:
                            record_date = datetime.fromisoformat(
                                dt_str.replace("Z", "+00:00")
                            ).date()
                            device_date_data[d_name][record_date].append(record)
                            feeds_record_count += 1
                        except (ValueError, TypeError):
                            pass

            logger.info(
                f"[Feeds Fallback] Added {feeds_record_count} records "
                f"from ThingSpeak for {len(missing_devices)} devices"
            )

        # --- 6. Compute per-day metrics and build records ---
        all_records = []
        for target_date in days_to_compute:
            # Past days are always complete; today depends on caller
            day_is_complete = True if target_date < today else complete

            day_start = datetime(
                target_date.year, target_date.month, target_date.day,
                tzinfo=timezone.utc,
            )
            day_end = day_start + timedelta(days=1)
            day_start_str = day_start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            day_end_str = day_end.strftime("%Y-%m-%dT%H:%M:%S.000Z")

            # Collect all raw records for this specific date
            day_raw_data = []
            for d_name in device_names:
                recs = device_date_data[d_name].get(target_date, [])
                day_raw_data.extend(recs)
                if recs:
                    logger.debug(f"Device {d_name} has {len(recs)} records for {target_date}")

            # Even if there is no data for the day, we still want to compute records for each device.
            # PerformanceAnalysis handles the logic, but we need to ensure every active device is processed.
            if not day_raw_data:
                logger.warning(f"No raw data found for ANY device on {target_date}")

            analysis = PerformanceAnalysis(day_raw_data)
            analysis.expected_frequency_minutes = 60  # hourly frequency
            metrics_map = analysis.compute_device_metrics(day_start_str, day_end_str)

            # Ensure every active device has a record for this day (with 0s if no data)
            for d_name in device_names:
                metrics = metrics_map.get(d_name)
                if metrics:
                    # logger.info(f"Metrics for {d_name}: {metrics}")
                    pass
                
                metrics = metrics or {
                    "uptime": 0.0,
                    "data_completeness": 0.0,
                    "sensor_error_margin": 0.0
                }
                
                info = device_info[d_name]
                all_records.append({
                    "device_id": info["device_id"],
                    "device_name": d_name,
                    "latitude": info["latitude"],
                    "longitude": info["longitude"],
                    "last_active": info["last_active"],
                    "uptime": _sanitize_metric(metrics.get("uptime")),
                    "data_completeness": _sanitize_metric(metrics.get("data_completeness")),
                    "error_margin": _sanitize_metric(metrics.get("sensor_error_margin")),
                    "cohorts": list(info["cohorts"]),
                    "complete_performance": day_is_complete,
                    "computed_for_date": target_date,
                })

        # --- 7. Upsert all records ---
        count = crud_device_performance.upsert_device_performance(db, all_records)
        logger.info(
            f"[Performance Sync] Synced {count} records across "
            f"{len(days_to_compute)} days for {len(device_names)} devices"
        )

        return {
            "success": True,
            "skipped": False,
            "message": f"Synced {count} records across {len(days_to_compute)} days",
            "records_synced": count,
            "days_computed": len(days_to_compute),
        }

    except Exception as e:
        logger.exception(f"[Performance Sync] Failed: {e}")
        return {"success": False, "message": str(e)}
    finally:
        db.close()


def _run_sync_job():
    """Synchronous wrapper for APScheduler to call the async sync routine."""
    logger.info("[Performance Sync] Daily cron job triggered")
    loop = asyncio.new_event_loop()
    try:
        result = loop.run_until_complete(compute_and_store_performance(days=14, force=True, complete=True))
        logger.info(f"[Performance Sync] Cron result: {result}")
    except Exception as e:
        logger.exception(f"[Performance Sync] Cron job failed: {e}")
    finally:
        loop.close()


def start_scheduler():
    """
    Start the APScheduler background scheduler with a daily cron job
    that runs at 23:00 UTC.
    """
    global _scheduler

    if not settings.SCHEDULER_ENABLED:
        logger.info("[Scheduler] Scheduler is disabled via SCHEDULER_ENABLED=False")
        return

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        logger.error(
            "[Scheduler] apscheduler is not installed. "
            "Install with: pip install apscheduler"
        )
        return

    _scheduler = BackgroundScheduler()
    _scheduler.add_job(
        _run_sync_job,
        trigger=CronTrigger(hour=23, minute=0, timezone="UTC"),
        id="daily_performance_sync",
        name="Daily Device Performance Sync",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Scheduler] Started — daily performance sync at 23:00 UTC")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Shut down")
        _scheduler = None
