import logging
import asyncio
import json
import httpx
from datetime import date, datetime, timedelta, timezone
from typing import Dict, Any, List, Optional

from app.core.config import settings
from app.db.session import SessionLocal
from app.services import cohort_service, device_service
from app.services.device_service import extract_device_category, fetch_feeds_for_device
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
    try:
        if math.isnan(value) or math.isinf(value):
            return 0.0
    except TypeError:
        # Handle complex numbers by taking the real part
        if isinstance(value, complex):
            return _sanitize_metric(value.real, ndigits)
        return 0.0
    return round(value, ndigits)



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
        use_platform: If True, only use Platform data and skip ThingSpeak.
        cohort_batch_size: Number of cohorts to process at a time (default 2).

    Returns a summary dict.
    """
    import asyncio
    from collections import defaultdict

    today = date.today()

    try:
        token = _extract_jwt_token()

        # --- 1. Fetch cohorts (paginated) ---
        logger.info(f"[Performance Sync] Fetching cohorts (tags={tags})...")
        cohort_params = {}
        if tags:
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

        # --- 2. Determine date range up front (no DB needed) ---
        if start_date and end_date:
            start_of_range_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
            end_of_range_dt = datetime(end_date.year, end_date.month, end_date.day, 23, 59, 59, tzinfo=timezone.utc)
        elif start_date:
            start_of_range_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
            end_of_range_dt = datetime.now(timezone.utc)
        else:
            end_of_range_dt = datetime.now(timezone.utc)
            start_of_range_dt = end_of_range_dt - timedelta(days=days)

        # Check which days need computation (short-lived DB session)
        db_check = SessionLocal()
        try:
            days_to_compute = []
            current = start_of_range_dt.date()
            target_end_date = end_of_range_dt.date()
            while current <= target_end_date:
                is_manual = bool(tags or start_date or end_date)
                if force or is_manual or not crud_device_performance.has_complete_records_for_date(db_check, current):
                    days_to_compute.append(current)
                current += timedelta(days=1)
        finally:
            db_check.close()

        if not days_to_compute:
            logger.info("[Performance Sync] All days already have complete data. Nothing to do.")
            return {
                "success": True,
                "skipped": True,
                "message": "All requested days already have complete data",
            }

        # --- 3. Pre-decrypt read keys in bulk (for ThingSpeak) ---
        all_cohort_devices = []
        for cohort in cohorts:
            for dev in cohort.get("devices", []):
                if dev.get("isActive"):
                    all_cohort_devices.append(dev)

        decryption_items = []
        for dev in all_cohort_devices:
            rk = dev.get("readKey")
            dn = dev.get("device_number")
            if rk and dn:
                decryption_items.append({"encrypted_key": rk, "device_number": dn})

        decrypted_keys_map = {}
        if decryption_items:
            from app.services.device_service import decrypt_read_keys
            decrypted_keys_map = await decrypt_read_keys(token, decryption_items)

        # --- 4. Process cohorts in batches ---
        total_lowcost = 0
        total_bam = 0
        total_devices = 0
        cohort_batches = [cohorts[i:i + cohort_batch_size] for i in range(0, len(cohorts), cohort_batch_size)]

        logger.info(
            f"[Performance Sync] Processing {len(cohorts)} cohorts in "
            f"{len(cohort_batches)} batches of up to {cohort_batch_size}"
        )

        for batch_idx, cohort_batch in enumerate(cohort_batches):
            batch_cohort_names = [c.get("name", "?") for c in cohort_batch]
            logger.info(
                f"[Performance Sync] Batch {batch_idx + 1}/{len(cohort_batches)}: "
                f"cohorts {batch_cohort_names}"
            )

            batch_result = await _process_cohort_batch(
                cohort_batch=cohort_batch,
                decrypted_keys_map=decrypted_keys_map,
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
            total_devices += batch_result["device_count"]

        logger.info(
            f"[Performance Sync] Finished all batches — "
            f"{total_lowcost} lowcost, {total_bam} BAM records across "
            f"{len(days_to_compute)} days for {total_devices} devices"
        )

        return {
            "success": True,
            "skipped": False,
            "message": f"Synced {total_lowcost} lowcost and {total_bam} BAM records",
            "lowcost_synced": total_lowcost,
            "bam_synced": total_bam,
            "days_computed": len(days_to_compute),
        }

    except Exception as e:
        logger.exception(f"[Performance Sync] Failed: {e}")
        return {"success": False, "message": str(e)}


async def _process_cohort_batch(
    *,
    cohort_batch: List[Dict[str, Any]],
    decrypted_keys_map: Dict,
    token: str,
    days_to_compute: List[date],
    start_of_range_dt: datetime,
    end_of_range_dt: datetime,
    today: date,
    complete: bool,
    use_platform: bool,
) -> Dict[str, Any]:
    """
    Process a small batch of cohorts end-to-end:
      • collect device metadata (short-lived DB read)
      • fetch raw data from Analytics / ThingSpeak
      • compute metrics
      • write results (short-lived DB write)

    Returns {"lowcost_synced": int, "bam_synced": int, "device_count": int}.
    """
    from collections import defaultdict

    # -- Collect device metadata for this batch (quick DB read) --
    device_info: Dict[str, Dict[str, Any]] = {}
    db_read = SessionLocal()
    try:
        for cohort in cohort_batch:
            cohort_name = cohort.get("name", "")
            for dev in cohort.get("devices", []):
                if not dev.get("isActive"):
                    continue
                d_name = dev.get("name")
                if not d_name:
                    continue

                dn = dev.get("device_number")
                raw_read_key = dev.get("readKey")
                read_key_to_store = decrypted_keys_map.get(dn, raw_read_key) if dn else raw_read_key

                if d_name not in device_info:
                    device_id = dev.get("_id", "")

                    from app.models.sync import SyncDevice
                    db_device = db_read.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()

                    if db_device:
                        category = db_device.category or "lowcost"
                    else:
                        category = extract_device_category(dev)

                    device_info[d_name] = {
                        "device_id": device_id,
                        "device_number": dev.get("device_number"),
                        "latitude": dev.get("latitude"),
                        "longitude": dev.get("longitude"),
                        "last_active": dev.get("lastActive"),
                        "category": category,
                        "read_key": read_key_to_store,
                        "cohorts": set(),
                    }
                device_info[d_name]["cohorts"].add(cohort_name)
    finally:
        db_read.close()

    device_names = list(device_info.keys())
    if not device_names:
        return {"lowcost_synced": 0, "bam_synced": 0, "device_count": 0}

    logger.info(
        f"[Performance Sync]   Batch has {len(device_names)} devices"
    )

    # -- Fetch raw data --
    start_dt_str = start_of_range_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_dt_str = end_of_range_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

    FREQUENCY_BY_CAT = {"bam": "raw", "lowcost": "hourly"}
    EXPECTED_FREQ_BY_CAT = {"bam": 2, "lowcost": 60}

    devices_by_category: Dict[str, List[str]] = defaultdict(list)
    for d_name, info in device_info.items():
        devices_by_category[info["category"]].append(d_name)

    CHUNK_SIZE = 50
    DATE_SEGMENT_DAYS = 7
    date_segments = cohort_service._split_date_range(start_dt_str, end_dt_str, DATE_SEGMENT_DAYS)

    semaphore = asyncio.Semaphore(2)
    tasks = []
    for cat, cat_device_names in devices_by_category.items():
        frequency = FREQUENCY_BY_CAT.get(cat, "hourly")
        chunks = [cat_device_names[i:i + CHUNK_SIZE] for i in range(0, len(cat_device_names), CHUNK_SIZE)]
        for chunk in chunks:
            for seg_start, seg_end in date_segments:
                tasks.append(
                    cohort_service._fetch_raw_data_for_devices(
                        chunk, seg_start, seg_end, frequency,
                        device_category=cat, semaphore=semaphore
                    )
                )

    all_results = await asyncio.gather(*tasks, return_exceptions=True)

    analytics_raw_data = []
    for i, chunk_data in enumerate(all_results):
        if isinstance(chunk_data, Exception):
            logger.error(f"[Performance Sync]   Chunk {i} failed: {chunk_data}")
        elif isinstance(chunk_data, list):
            analytics_raw_data.extend(chunk_data)

    logger.info(
        f"[Performance Sync]   Fetched {len(analytics_raw_data)} analytics records"
    )

    # -- ThingSpeak (optional) --
    ts_data_by_device: Dict[str, List[Dict[str, Any]]] = {}
    if not use_platform:
        ts_semaphore = asyncio.Semaphore(5)

        async def _fetch_ts(d_name: str) -> List[Dict[str, Any]]:
            info = device_info[d_name]
            async with ts_semaphore:
                return await fetch_feeds_for_device(
                    info["device_number"], d_name, token,
                    read_key=info.get("read_key"),
                    category=info.get("category", "lowcost"),
                    start_date=start_dt_str, end_date=end_dt_str,
                )

        ts_devices = [d for d in device_names if device_info[d].get("device_number") is not None]
        ts_tasks = [_fetch_ts(d) for d in ts_devices]
        ts_results = await asyncio.gather(*ts_tasks, return_exceptions=True)
        for d_name, res in zip(ts_devices, ts_results):
            if isinstance(res, Exception):
                logger.error(f"[Performance Sync]   ThingSpeak {d_name} failed: {res}")
            elif res:
                ts_data_by_device[d_name] = res

    # -- Group raw data by device + date --
    device_date_data: Dict[str, Dict[date, List]] = defaultdict(lambda: defaultdict(list))
    for d_name in device_names:
        final_dev_data = []
        if not use_platform and d_name in ts_data_by_device:
            final_dev_data = ts_data_by_device[d_name]
        else:
            final_dev_data = [r for r in analytics_raw_data if r.get("device_name") == d_name]

        for record in final_dev_data:
            dt_str = record.get("datetime")
            if dt_str:
                try:
                    record_date = datetime.fromisoformat(dt_str.replace("Z", "+00:00")).date()
                    device_date_data[d_name][record_date].append(record)
                except (ValueError, TypeError):
                    pass

    # -- Compute per-day metrics --
    lowcost_records = []
    bam_records = []

    for target_date in days_to_compute:
        day_is_complete = True if target_date < today else complete

        day_start = datetime(target_date.year, target_date.month, target_date.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        day_start_str = day_start.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        day_end_str = day_end.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        for cat, cat_device_names in devices_by_category.items():
            day_cat_raw_data = []
            for d_name in cat_device_names:
                day_cat_raw_data.extend(device_date_data[d_name].get(target_date, []))

            analysis = PerformanceAnalysis(day_cat_raw_data)
            analysis.expected_frequency_minutes = EXPECTED_FREQ_BY_CAT.get(cat, 60)
            metrics_map = analysis.compute_device_metrics(day_start_str, day_end_str, device_category=cat)

            for d_name in cat_device_names:
                metrics = metrics_map.get(d_name)
                info = device_info[d_name]

                if cat == "bam":
                    metrics = metrics or {
                        "uptime": 0.0,
                        "data_completeness": 0.0,
                        "realtime_conc_average": None,
                        "short_time_conc_average": None,
                        "hourly_conc_average": None,
                    }
                    bam_records.append({
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
                    })
                else:
                    metrics = metrics or {
                        "uptime": 0.0,
                        "data_completeness": 0.0,
                        "sensor_error_margin": 0.0,
                        "s1_pm2_5_average": 0.0,
                        "s2_pm2_5_average": 0.0,
                        "correlation": 0.0,
                    }
                    lowcost_records.append({
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
                    })

    # -- Upsert with a FRESH short-lived DB session --
    lowcost_count = 0
    bam_count = 0
    db_write = SessionLocal()
    try:
        lowcost_count = crud_device_performance.upsert_device_performance(db_write, lowcost_records)
        bam_count = crud_device_performance.upsert_bam_performance(db_write, bam_records)
    except Exception as e:
        logger.error(f"[Performance Sync]   DB write failed for batch: {e}")
        raise
    finally:
        db_write.close()

    logger.info(
        f"[Performance Sync]   Batch done — {lowcost_count} lowcost, {bam_count} BAM"
    )
    return {"lowcost_synced": lowcost_count, "bam_synced": bam_count, "device_count": len(device_names)}


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
