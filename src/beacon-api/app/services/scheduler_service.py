import logging
import asyncio
import json
import math
from collections import defaultdict
import httpx
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Tuple

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import cohort_service, device_service
from app.services.device_service import extract_device_category, fetch_feeds_for_device
from app.utils.performance import PerformanceAnalysis
from app.crud import crud_device_performance

logger = logging.getLogger(__name__)

# Constants used by performance computation
_FREQUENCY_BY_CAT = {"bam": "raw", "lowcost": "hourly"}
_EXPECTED_FREQ_BY_CAT = {"bam": 2, "lowcost": 60}
_CHUNK_SIZE = 50
_DATE_SEGMENT_DAYS = 7
_ANALYTICS_CONCURRENCY = 2
_THINGSPEAK_CONCURRENCY = 5
_DT_FMT = "%Y-%m-%dT%H:%M:%S.000Z"

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
    if value is None:
        return 0.0
    try:
        if math.isnan(value) or math.isinf(value):
            return 0.0
    except TypeError:
        # Handle complex numbers by taking the real part
        if isinstance(value, complex):
            return _sanitize_metric(value.real, ndigits)
        return 0.0
    return round(value, ndigits)


# ---------------------------------------------------------------------------
# Helpers for compute_and_store_performance
# ---------------------------------------------------------------------------

def _resolve_date_range(
    days: int,
    start_date: Optional[date],
    end_date: Optional[date],
) -> Tuple[datetime, datetime]:
    """Resolve the (start, end) UTC datetime range for performance computation."""
    if start_date and end_date:
        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
        end_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
    elif start_date:
        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
        end_dt = datetime.now(timezone.utc)
    else:
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=days)
    return start_dt, end_dt


def _resolve_days_to_compute(
    start_dt: datetime,
    end_dt: datetime,
    *,
    force: bool,
    is_manual: bool,
) -> List[date]:
    """Walk the date range and collect days that still need computation."""
    db_check = SessionLocal()
    try:
        days_to_compute: List[date] = []
        current = start_dt.date()
        target_end = end_dt.date()
        while current <= target_end:
            already_complete = crud_device_performance.has_complete_records_for_date(db_check, current)
            if force or is_manual or not already_complete:
                days_to_compute.append(current)
            current += timedelta(days=1)
        return days_to_compute
    finally:
        db_check.close()


async def _decrypt_cohort_read_keys(cohorts: List[Dict[str, Any]], token: str) -> Dict[Any, str]:
    """Pre-decrypt all readKeys for active devices across all cohorts."""
    decryption_items = []
    for cohort in cohorts:
        for dev in cohort.get("devices", []):
            if not dev.get("isActive"):
                continue
            rk = dev.get("readKey")
            dn = dev.get("device_number")
            if rk and dn:
                decryption_items.append({"encrypted_key": rk, "device_number": dn})

    if not decryption_items:
        return {}

    from app.services.device_service import decrypt_read_keys
    return await decrypt_read_keys(token, decryption_items)


def _resolve_device_category(db_read, dev: Dict[str, Any]) -> str:
    """Prefer the locally-synced category; fall back to extracting from the platform doc."""
    from app.models.sync import SyncDevice

    device_id = dev.get("_id", "")
    db_device = db_read.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    if db_device:
        return db_device.category or "lowcost"
    return extract_device_category(dev)


def _make_device_info_entry(
    db_read,
    dev: Dict[str, Any],
    decrypted_keys_map: Dict[Any, str],
) -> Dict[str, Any]:
    """Build a single device_info entry from a platform device doc."""
    dn = dev.get("device_number")
    raw_read_key = dev.get("readKey")
    read_key = decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key
    return {
        "device_id": dev.get("_id", ""),
        "device_number": dn,
        "latitude": dev.get("latitude"),
        "longitude": dev.get("longitude"),
        "last_active": dev.get("lastActive"),
        "category": _resolve_device_category(db_read, dev),
        "read_key": read_key,
        "cohorts": set(),
    }


def _build_device_info(
    cohorts: List[Dict[str, Any]],
    decrypted_keys_map: Dict[Any, str],
) -> Dict[str, Dict[str, Any]]:
    """Build a per-device metadata dict keyed by device name, including cohort memberships."""
    device_info: Dict[str, Dict[str, Any]] = {}

    db_read = SessionLocal()
    try:
        for cohort in cohorts:
            cohort_name = cohort.get("name", "")
            for dev in cohort.get("devices", []):
                d_name = dev.get("name")
                if not dev.get("isActive") or not d_name:
                    continue

                if d_name not in device_info:
                    device_info[d_name] = _make_device_info_entry(db_read, dev, decrypted_keys_map)
                device_info[d_name]["cohorts"].add(cohort_name)
    finally:
        db_read.close()

    return device_info


async def compute_and_store_performance(
    days: int = 14,
    force: bool = False,
    complete: bool = False,
    tags: Optional[List[str]] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    use_platform: bool = False,
    cohort_batch_size: int = 2,
) -> Dict[str, Any]:
    """
    Fetch all cohorts, retrieve raw data for the last `days` days (or from start_date to end_date),
    then compute and store **per-device, per-day** performance records.

    Processing is done in cohort batches (default 2 cohorts ≈ 30 devices at a time)
    to avoid holding a single long-lived DB connection that can time out.

    For devices that return NO data from the analytics API, we fall back
    to the ThingSpeak feeds endpoint using their device_number.
    Even if NO data is found for a device on a given day, it will get a 0 record.

    If use_platform is True, we only use the Platform Analytics data and
    skip ThingSpeak fetching.
    """
    today = date.today()

    try:
        token = _extract_jwt_token()

        # --- 1. Fetch cohorts (paginated) ---
        logger.info(f"[Performance Sync] Fetching cohorts (tags={tags})...")
        cohort_params = {"tags": ",".join(tags)} if tags else {}
        result = await cohort_service.get_all_cohorts_paginated(token, cohort_params)

        if not result.get("success", True):
            msg = result.get("message", "Failed to fetch cohorts")
            logger.error(f"[Performance Sync] {msg}")
            return {"success": False, "message": msg}

        cohorts = result.get("cohorts", [])
        if not cohorts:
            logger.warning("[Performance Sync] No cohorts found.")
            return {"success": True, "message": "No cohorts found", "devices_synced": 0}

        # --- 2. Resolve date range and days needing computation ---
        start_of_range_dt, end_of_range_dt = _resolve_date_range(days, start_date, end_date)
        is_manual = bool(tags or start_date or end_date)
        days_to_compute = _resolve_days_to_compute(
            start_of_range_dt, end_of_range_dt, force=force, is_manual=is_manual,
        )

        if not days_to_compute:
            logger.info("[Performance Sync] All days already have complete data. Nothing to do.")
            return {
                "success": True,
                "skipped": True,
                "message": "All requested days already have complete data",
            }

        # --- 3. Pre-decrypt read keys + build device_info ---
        decrypted_keys_map = await _decrypt_cohort_read_keys(cohorts, token)
        device_info = _build_device_info(cohorts, decrypted_keys_map)

        all_device_names = list(device_info.keys())
        if not all_device_names:
            logger.warning("[Performance Sync] No active devices found.")
            return {"success": True, "message": "No active devices", "devices_synced": 0}

        # --- 4. Process devices in batches ---
        device_batch_size = max(cohort_batch_size * 15, 30)
        device_batches = [
            all_device_names[i:i + device_batch_size]
            for i in range(0, len(all_device_names), device_batch_size)
        ]

        total_lowcost = 0
        total_bam = 0

        logger.info(
            f"[Performance Sync] Processing {len(all_device_names)} unique devices in "
            f"{len(device_batches)} batches of up to {device_batch_size}"
        )

        for batch_idx, device_name_batch in enumerate(device_batches):
            logger.info(
                f"[Performance Sync] Batch {batch_idx + 1}/{len(device_batches)}: "
                f"{len(device_name_batch)} devices"
            )

            batch_device_info = {d: device_info[d] for d in device_name_batch}
            batch_result = await _process_device_batch(
                device_info=batch_device_info,
                token=token,
                days_to_compute=days_to_compute,
                start_of_range_dt=start_of_range_dt,
                end_of_range_dt=end_of_range_dt,
                today=today,
                complete=complete,
                use_platform=use_platform,
            )

            total_lowcost += batch_result["lowcost_synced"]
            total_bam += batch_result["bam_synced"]

        logger.info(
            f"[Performance Sync] Finished all batches — "
            f"{total_lowcost} lowcost, {total_bam} BAM records across "
            f"{len(days_to_compute)} days for {len(all_device_names)} devices"
        )

        return {
            "success": True,
            "skipped": False,
            "message": f"Synced {total_lowcost} lowcost and {total_bam} BAM records",
            "lowcost_synced": total_lowcost,
            "bam_synced": total_bam,
            "devices_synced": len(all_device_names),
            "days_computed": len(days_to_compute),
        }

    except Exception as e:
        logger.exception(f"[Performance Sync] Failed: {e}")
        return {"success": False, "message": str(e)}


async def _fetch_analytics_raw_data(
    devices_by_category: Dict[str, List[str]],
    start_dt_str: str,
    end_dt_str: str,
) -> List[Dict[str, Any]]:
    """Fetch raw analytics data for all devices, chunked by category and date segment."""
    date_segments = cohort_service._split_date_range(start_dt_str, end_dt_str, _DATE_SEGMENT_DAYS)
    semaphore = asyncio.Semaphore(_ANALYTICS_CONCURRENCY)

    tasks = []
    for cat, cat_device_names in devices_by_category.items():
        frequency = _FREQUENCY_BY_CAT.get(cat, "hourly")
        chunks = [
            cat_device_names[i:i + _CHUNK_SIZE]
            for i in range(0, len(cat_device_names), _CHUNK_SIZE)
        ]
        for chunk in chunks:
            for seg_start, seg_end in date_segments:
                tasks.append(
                    cohort_service._fetch_raw_data_for_devices(
                        chunk, seg_start, seg_end, frequency,
                        device_category=cat, semaphore=semaphore,
                    )
                )

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    analytics_raw_data: List[Dict[str, Any]] = []
    for i, chunk_data in enumerate(all_results):
        if isinstance(chunk_data, Exception):
            logger.error(f"[Performance Sync]   Chunk {i} failed: {chunk_data}")
        elif isinstance(chunk_data, list):
            analytics_raw_data.extend(chunk_data)

    return analytics_raw_data


async def _fetch_thingspeak_data(
    device_info: Dict[str, Dict[str, Any]],
    token: str,
    start_dt_str: str,
    end_dt_str: str,
) -> Dict[str, List[Dict[str, Any]]]:
    """Fetch ThingSpeak feeds in parallel for devices that have a device_number."""
    ts_devices = [d for d, info in device_info.items() if info.get("device_number") is not None]
    if not ts_devices:
        return {}

    ts_semaphore = asyncio.Semaphore(_THINGSPEAK_CONCURRENCY)

    async def _fetch_one(d_name: str) -> List[Dict[str, Any]]:
        info = device_info[d_name]
        async with ts_semaphore:
            return await fetch_feeds_for_device(
                info["device_number"], d_name, token,
                read_key=info.get("read_key"),
                category=info.get("category", "lowcost"),
                start_date=start_dt_str, end_date=end_dt_str,
            )

    ts_results = await asyncio.gather(
        *(_fetch_one(d) for d in ts_devices), return_exceptions=True,
    )

    ts_data_by_device: Dict[str, List[Dict[str, Any]]] = {}
    for d_name, res in zip(ts_devices, ts_results):
        if isinstance(res, Exception):
            logger.error(f"[Performance Sync]   ThingSpeak {d_name} failed: {res}")
        elif res:
            ts_data_by_device[d_name] = res
    return ts_data_by_device


def _group_records_by_device_and_date(
    device_names: List[str],
    use_platform: bool,
    analytics_raw_data: List[Dict[str, Any]],
    ts_data_by_device: Dict[str, List[Dict[str, Any]]],
) -> Dict[str, Dict[date, List[Dict[str, Any]]]]:
    """Pick raw data per device (TS overrides Analytics if available) and bucket by date."""
    device_date_data: Dict[str, Dict[date, List[Dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))

    for d_name in device_names:
        if not use_platform and d_name in ts_data_by_device:
            final_dev_data = ts_data_by_device[d_name]
        else:
            final_dev_data = [r for r in analytics_raw_data if r.get("device_name") == d_name]

        for record in final_dev_data:
            dt_str = record.get("datetime")
            if not dt_str:
                continue
            try:
                record_date = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).date()
            except (ValueError, TypeError):
                continue
            device_date_data[d_name][record_date].append(record)

    return device_date_data


def _build_bam_record(
    d_name: str,
    info: Dict[str, Any],
    metrics: Optional[Dict[str, Any]],
    target_date: date,
) -> Dict[str, Any]:
    metrics = metrics or {
        "uptime": 0.0, "data_completeness": 0.0,
        "realtime_conc_average": None, "short_time_conc_average": None,
        "hourly_conc_average": None,
    }
    return {
        "device_id": info["device_id"],
        "device_name": d_name,
        "latitude": info["latitude"],
        "longitude": info["longitude"],
        "uptime": _sanitize_metric(metrics.get("uptime")),
        "data_completeness": _sanitize_metric(metrics.get("data_completeness")),
        "realtime_conc_average": metrics.get("realtime_conc_average"),
        "short_time_conc_average": metrics.get("short_time_conc_average"),
        "hourly_conc_average": metrics.get("hourly_conc_average"),
        "computed_for_date": target_date,
    }


def _build_lowcost_record(
    d_name: str,
    info: Dict[str, Any],
    metrics: Optional[Dict[str, Any]],
    target_date: date,
    day_is_complete: bool,
) -> Dict[str, Any]:
    metrics = metrics or {
        "uptime": 0.0, "data_completeness": 0.0, "sensor_error_margin": 0.0,
        "s1_pm2_5_average": 0.0, "s2_pm2_5_average": 0.0, "correlation": 0.0,
    }
    return {
        "device_id": info["device_id"],
        "device_name": d_name,
        "latitude": info["latitude"],
        "longitude": info["longitude"],
        "last_active": info["last_active"],
        "uptime": _sanitize_metric(metrics.get("uptime")),
        "data_completeness": _sanitize_metric(metrics.get("data_completeness")),
        "error_margin": _sanitize_metric(metrics.get("sensor_error_margin")),
        "s1_pm2_5_average": _sanitize_metric(metrics.get("s1_pm2_5_average")),
        "s2_pm2_5_average": _sanitize_metric(metrics.get("s2_pm2_5_average")),
        "correlation": _sanitize_metric(metrics.get("correlation")),
        "cohorts": list(info["cohorts"]),
        "complete_performance": day_is_complete,
        "computed_for_date": target_date,
    }


def _compute_records_for_day(
    target_date: date,
    devices_by_category: Dict[str, List[str]],
    device_info: Dict[str, Dict[str, Any]],
    device_date_data: Dict[str, Dict[date, List[Dict[str, Any]]]],
    day_is_complete: bool,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Compute lowcost and BAM performance records for a single target date."""
    day_start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    day_start_str = day_start.strftime(_DT_FMT)
    day_end_str = day_end.strftime(_DT_FMT)

    lowcost: List[Dict[str, Any]] = []
    bam: List[Dict[str, Any]] = []

    for cat, cat_device_names in devices_by_category.items():
        day_cat_raw_data: List[Dict[str, Any]] = []
        for d_name in cat_device_names:
            day_cat_raw_data.extend(device_date_data[d_name].get(target_date, []))

        analysis = PerformanceAnalysis(day_cat_raw_data)
        analysis.expected_frequency_minutes = _EXPECTED_FREQ_BY_CAT.get(cat, 60)
        metrics_map = analysis.compute_device_metrics(day_start_str, day_end_str, device_category=cat)

        for d_name in cat_device_names:
            metrics = metrics_map.get(d_name)
            info = device_info[d_name]
            if cat == "bam":
                bam.append(_build_bam_record(d_name, info, metrics, target_date))
            else:
                lowcost.append(_build_lowcost_record(d_name, info, metrics, target_date, day_is_complete))

    return lowcost, bam


def _persist_performance_records(
    lowcost_records: List[Dict[str, Any]],
    bam_records: List[Dict[str, Any]],
) -> Tuple[int, int]:
    """Upsert performance records using a fresh short-lived DB session."""
    db_write = SessionLocal()
    try:
        lowcost_count = crud_device_performance.upsert_device_performance(db_write, lowcost_records)
        bam_count = crud_device_performance.upsert_bam_performance(db_write, bam_records)
        return lowcost_count, bam_count
    except Exception as e:
        logger.error(f"[Performance Sync]   DB write failed for batch: {e}")
        raise
    finally:
        db_write.close()


async def _process_device_batch(
    *,
    device_info: Dict[str, Dict[str, Any]],
    token: str,
    days_to_compute: List[date],
    start_of_range_dt: datetime,
    end_of_range_dt: datetime,
    today: date,
    complete: bool,
    use_platform: bool,
) -> Dict[str, Any]:
    """
    Process a batch of unique devices end-to-end:
      • fetch raw data from Analytics / ThingSpeak
      • compute per-day metrics
      • write results (short-lived DB write)

    Returns {"lowcost_synced": int, "bam_synced": int}.
    """
    device_names = list(device_info.keys())
    if not device_names:
        return {"lowcost_synced": 0, "bam_synced": 0}

    logger.info(f"[Performance Sync]   Batch has {len(device_names)} devices")

    start_dt_str = start_of_range_dt.strftime(_DT_FMT)
    end_dt_str = end_of_range_dt.strftime(_DT_FMT)

    devices_by_category: Dict[str, List[str]] = defaultdict(list)
    for d_name, info in device_info.items():
        devices_by_category[info["category"]].append(d_name)

    # -- Fetch raw data --
    analytics_raw_data = await _fetch_analytics_raw_data(
        devices_by_category, start_dt_str, end_dt_str,
    )
    logger.info(f"[Performance Sync]   Fetched {len(analytics_raw_data)} analytics records")

    ts_data_by_device: Dict[str, List[Dict[str, Any]]] = {}
    if not use_platform:
        ts_data_by_device = await _fetch_thingspeak_data(
            device_info, token, start_dt_str, end_dt_str,
        )

    # -- Group raw data and compute per-day metrics --
    device_date_data = _group_records_by_device_and_date(
        device_names, use_platform, analytics_raw_data, ts_data_by_device,
    )

    lowcost_records: List[Dict[str, Any]] = []
    bam_records: List[Dict[str, Any]] = []
    for target_date in days_to_compute:
        day_is_complete = True if target_date < today else complete
        day_lowcost, day_bam = _compute_records_for_day(
            target_date, devices_by_category, device_info,
            device_date_data, day_is_complete,
        )
        lowcost_records.extend(day_lowcost)
        bam_records.extend(day_bam)

    # -- Upsert --
    lowcost_count, bam_count = _persist_performance_records(lowcost_records, bam_records)
    logger.info(f"[Performance Sync]   Batch done — {lowcost_count} lowcost, {bam_count} BAM")
    return {"lowcost_synced": lowcost_count, "bam_synced": bam_count}


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


def _run_thingspeak_sync_job():
    """Synchronous wrapper for APScheduler to call the async ThingSpeak data sync."""
    logger.info("[ThingSpeak Sync] Daily cron job triggered")
    loop = asyncio.new_event_loop()
    try:
        from app.services.thingspeak_sync_service import sync_device_data
        result = loop.run_until_complete(sync_device_data(days=14))
        logger.info(f"[ThingSpeak Sync] Cron result: {result}")
    except Exception as e:
        logger.exception(f"[ThingSpeak Sync] Cron job failed: {e}")
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
    _scheduler.add_job(
        _run_thingspeak_sync_job,
        trigger=CronTrigger(hour=22, minute=0, timezone="UTC"),
        id="daily_thingspeak_data_sync",
        name="Daily ThingSpeak Data Sync",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("[Scheduler] Started — ThingSpeak data sync at 22:00 UTC, performance sync at 23:00 UTC")


def stop_scheduler():
    """Gracefully shut down the scheduler."""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        logger.info("[Scheduler] Shut down")
        _scheduler = None
