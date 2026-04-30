"""
ThingSpeak Data Sync Service
─────────────────────────────
Fetches raw sensor data from ThingSpeak for all registered devices,
stores it in sync_raw_device_data, and computes hourly/daily aggregations.

This is the main scheduled data pipeline — runs daily via cron and can
also be triggered manually via the /data-sync/sync-thingspeak endpoint.
"""
import logging
import math
from collections import defaultdict
from datetime import datetime, date, timedelta, timezone
from typing import Dict, Any, List, Optional

import httpx

from app.db.session import SessionLocal
from app.models.sync import SyncDevice
from app.crud import crud_device_data

logger = logging.getLogger(__name__)

# ThingSpeak returns max 8000 records per request
_TS_PAGE_SIZE = 8000

# field8 CSV can have up to 13 sub-values → field8 through field20
_FIELD8_MAX_SUBFIELDS = 13


# ── ThingSpeak Bulk Fetch ─────────────────────────────────────────────────────

async def fetch_thingspeak_data_bulk(
    devices: List[Dict[str, str]],
    start_date: str,
    end_date: str,
    start_time: str = "00:00:00",
    end_time: str = "23:59:59",
) -> List[Dict[str, Any]]:
    """
    Fetches all records from multiple ThingSpeak channels between
    start_date/time and end_date/time, handling pagination (8000 records
    per request). Returns raw data as JSON without dropping, deduplicating,
    or modifying anything.

    Args:
        devices: list of dicts with 'channel_id' and 'api_key'
        start_date: 'YYYY-MM-DD'
        end_date: 'YYYY-MM-DD'
        start_time: 'HH:MM:SS' (default "00:00:00")
        end_time: 'HH:MM:SS' (default "23:59:59")

    Returns:
        list of dicts with 'channel_id' and 'feeds' (raw ThingSpeak records)
    """
    results = []
    start_datetime_str = f"{start_date}T{start_time}Z"
    end_datetime_str = f"{end_date}T{end_time}Z"
    start_dt = datetime.strptime(start_datetime_str, "%Y-%m-%dT%H:%M:%SZ")

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for device in devices:
            channel_id = str(device["channel_id"])
            api_key = device["api_key"]
            current_end = end_datetime_str
            all_feeds = []

            while True:
                url = (
                    f"https://thingspeak.com/channels/{channel_id}/feeds.json?"
                    f"start={start_datetime_str}&end={current_end}"
                    f"&api_key={api_key}&results={_TS_PAGE_SIZE}"
                )

                try:
                    response = await client.get(url)
                    response.raise_for_status()
                    data = response.json()
                except httpx.HTTPStatusError as e:
                    logger.error(
                        "[ThingSpeak] Failed to fetch channel %s: HTTP %s",
                        channel_id,
                        e.response.status_code,
                    )
                    break
                except httpx.RequestError as e:
                    logger.error(
                        "[ThingSpeak] Failed to fetch channel %s: %s",
                        channel_id,
                        e.__class__.__name__,
                    )
                    break
                    break

                feeds = data.get("feeds", [])
                if not feeds:
                    break

                all_feeds.extend(feeds)

                if len(feeds) < _TS_PAGE_SIZE:
                    break

                # Paginate backwards: move end cursor to the first record's timestamp
                first_timestamp = feeds[0].get("created_at", "")
                try:
                    first_datetime = datetime.strptime(
                        first_timestamp, "%Y-%m-%dT%H:%M:%SZ"
                    )
                except ValueError:
                    break

                if first_datetime <= start_dt:
                    break

                current_end = first_datetime.strftime("%Y-%m-%dT%H:%M:%SZ")

            results.append({"channel_id": channel_id, "feeds": all_feeds})
            logger.info(
                f"[ThingSpeak] Channel {channel_id}: fetched {len(all_feeds)} feeds"
            )

    return results


# ── Field Parsing ─────────────────────────────────────────────────────────────

def _safe_float(value) -> Optional[float]:
    """Parse a value to float, returning None for unparseable / NaN / Inf."""
    if value is None:
        return None
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def _parse_feed_record(feed: Dict[str, Any], channel_id: str, device_id: Optional[str]) -> Dict[str, Any]:
    """
    Parse a single ThingSpeak feed record into our internal format.
    field1–field7 direct, field8 CSV split into field8–field20.
    """
    record = {
        "channel_id": channel_id,
        "device_id": device_id,
        "entry_id": feed.get("entry_id"),
        "created_at_ts": feed.get("created_at"),
    }

    # Direct fields 1–7
    for i in range(1, 8):
        record[f"field{i}"] = _safe_float(feed.get(f"field{i}"))

    # Parse field8 CSV → field8–field20
    field8_raw = feed.get("field8")
    if field8_raw and isinstance(field8_raw, str):
        parts = field8_raw.split(",")
        for j in range(min(len(parts), _FIELD8_MAX_SUBFIELDS)):
            record[f"field{8 + j}"] = _safe_float(parts[j])
    else:
        for j in range(_FIELD8_MAX_SUBFIELDS):
            record[f"field{8 + j}"] = None

    return record


# ── Aggregation ───────────────────────────────────────────────────────────────

def _compute_avg(values: List[Optional[float]]) -> Optional[float]:
    """Compute the mean of non-None values. Returns None if all are None."""
    valid = [v for v in values if v is not None]
    if not valid:
        return None
    return sum(valid) / len(valid)


def _aggregate_to_hourly(
    parsed_records: List[Dict[str, Any]],
    channel_id: str,
    device_id: Optional[str],
    now_utc: datetime,
) -> List[Dict[str, Any]]:
    """
    Group parsed records by hour bucket and compute mean of each field.
    Sets complete=True for hour buckets that have fully elapsed.
    """
    buckets: Dict[datetime, List[Dict[str, Any]]] = defaultdict(list)

    for rec in parsed_records:
        ts = rec.get("created_at_ts")
        if not ts:
            continue
        if isinstance(ts, str):
            try:
                ts = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        hour_start = ts.replace(minute=0, second=0, microsecond=0)
        buckets[hour_start].append(rec)

    results = []
    for hour_start, records in buckets.items():
        row = {
            "channel_id": channel_id,
            "device_id": device_id,
            "hour_start": hour_start,
            "record_count": len(records),
            "complete": (hour_start + timedelta(hours=1)) <= now_utc,
        }
        for i in range(1, 21):
            col = f"field{i}"
            row[f"{col}_avg"] = _compute_avg([r.get(col) for r in records])
        results.append(row)

    return results


def _aggregate_to_daily(
    parsed_records: List[Dict[str, Any]],
    channel_id: str,
    device_id: Optional[str],
    now_utc: datetime,
) -> List[Dict[str, Any]]:
    """
    Group parsed records by calendar date and compute mean of each field.
    Sets complete=True for dates that have fully elapsed.
    """
    buckets: Dict[date, List[Dict[str, Any]]] = defaultdict(list)

    for rec in parsed_records:
        ts = rec.get("created_at_ts")
        if not ts:
            continue
        if isinstance(ts, str):
            try:
                ts = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
            except ValueError:
                continue
        buckets[ts.date()].append(rec)

    today_utc = now_utc.date()
    results = []
    for data_date, records in buckets.items():
        row = {
            "channel_id": channel_id,
            "device_id": device_id,
            "data_date": data_date,
            "record_count": len(records),
            "complete": data_date < today_utc,
        }
        for i in range(1, 21):
            col = f"field{i}"
            row[f"{col}_avg"] = _compute_avg([r.get(col) for r in records])
        results.append(row)

    return results


# ── Main Sync Orchestrator ────────────────────────────────────────────────────

async def sync_device_data(
    days: int = 14,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    start_time: str = "00:00:00",
    end_time: str = "23:59:59",
) -> Dict[str, Any]:
    """
    Main entry point for the ThingSpeak data sync pipeline.

    1. Reads all devices from sync_device with device_number + readKey
    2. Fetches raw feeds from ThingSpeak (last `days` days by default)
    3. Parses and upserts into sync_raw_device_data
    4. Aggregates to hourly → sync_hourly_device_data
    5. Aggregates to daily  → sync_daily_device_data
    6. Runs retention cleanup

    Args:
        days: Lookback period (default 14 days). Ignored if start_date/end_date set.
        start_date: Optional start date 'YYYY-MM-DD'.
        end_date: Optional end date 'YYYY-MM-DD'.
        start_time: Start time 'HH:MM:SS' (default "00:00:00").
        end_time: End time 'HH:MM:SS' (default "23:59:59").

    Returns a summary dict.

    Devices are processed sequentially (one channel per ThingSpeak request)
    so that per-device fetch windows can be narrowed to only the dates that
    are still missing/incomplete. This avoids re-downloading data that has
    already been marked complete in `sync_daily_device_data`.
    
    """
    now_utc = datetime.now(timezone.utc)

    # Resolve date range
    if not end_date:
        end_date = now_utc.strftime("%Y-%m-%d")
    if not start_date:
        start_dt = now_utc - timedelta(days=days)
        start_date = start_dt.strftime("%Y-%m-%d")

    logger.info(
        f"[ThingSpeak Sync] Starting sync: {start_date} {start_time} → {end_date} {end_time}"
    )

    # ── 1. Get devices from local DB ──────────────────────────────────────
    db = SessionLocal()
    try:
        devices_rows = (
            db.query(SyncDevice)
            .filter(
                SyncDevice.device_number.isnot(None),
                SyncDevice.readKey.isnot(None),
                SyncDevice.readKey != "",
            )
            .all()
        )
    finally:
        db.close()

    if not devices_rows:
        logger.warning("[ThingSpeak Sync] No devices with channel_id + readKey found")
        return {"success": True, "message": "No eligible devices", "devices": 0}

    # Build device list for ThingSpeak fetch
    # device_number is the ThingSpeak channel_id, readKey is the api_key
    device_map: Dict[str, str] = {}  # channel_id → device_id
    ts_devices = []
    for d in devices_rows:
        ch_id = str(d.device_number)
        device_map[ch_id] = d.device_id
        ts_devices.append({
            "channel_id": ch_id,
            "api_key": d.readKey,
        })

    logger.info(f"[ThingSpeak Sync] Found {len(ts_devices)} eligible devices")

    # ── 2. Fetch in batches ───────────────────────────────────────────────
    total_raw = 0
    total_hourly = 0
    total_daily = 0

    # Build the full set of expected dates for the requested range
    range_start = datetime.strptime(start_date, "%Y-%m-%d").date()
    range_end = datetime.strptime(end_date, "%Y-%m-%d").date()
    all_expected_dates = set()
    d = range_start
    while d <= range_end:
        all_expected_dates.add(d)
        d += timedelta(days=1)

    skipped_devices = 0

    for dev_idx, ts_device in enumerate(ts_devices):
        ch_id = ts_device["channel_id"]

        # ── Pre-check: skip if all days are already complete ──────────
        db_check = SessionLocal()
        try:
            complete_dates = crud_device_data.get_complete_daily_dates(
                db_check, ch_id, range_start, range_end
            )
        finally:
            db_check.close()

        missing_dates = all_expected_dates - complete_dates
        if not missing_dates:
            logger.debug(
                f"[ThingSpeak Sync] Device {dev_idx + 1}/{len(ts_devices)}: "
                f"channel {ch_id} — all {len(all_expected_dates)} days complete, skipping"
            )
            skipped_devices += 1
            continue

        # Narrow the fetch window to only the missing date range
        fetch_start = min(missing_dates).strftime("%Y-%m-%d")
        fetch_end = max(missing_dates).strftime("%Y-%m-%d")

        logger.info(
            f"[ThingSpeak Sync] Device {dev_idx + 1}/{len(ts_devices)}: "
            f"channel {ch_id} — {len(missing_dates)} days to fetch "
            f"({fetch_start} → {fetch_end})"
        )

        # Fetch one device at a time
        try:
            ts_results = await fetch_thingspeak_data_bulk(
                [ts_device], fetch_start, fetch_end, start_time, end_time
            )
        except Exception as e:
            logger.error(f"[ThingSpeak Sync] Fetch failed for channel {ch_id}: {e}")
            continue

        channel_result = ts_results[0] if ts_results else None
        if not channel_result:
            continue

        feeds = channel_result.get("feeds", [])
        if not feeds:
            continue

        dev_id = device_map.get(ch_id)

        # Parse feeds for this device
        parsed = [_parse_feed_record(f, ch_id, dev_id) for f in feeds]

        # ── Save raw immediately ──────────────────────────────────────
        db_write = SessionLocal()
        try:
            count = crud_device_data.upsert_raw_data(db_write, parsed)
            total_raw += count
        except Exception as e:
            logger.error(f"[ThingSpeak Sync] Raw upsert failed for {ch_id}: {e}")
        finally:
            db_write.close()

        # ── Aggregate + save hourly ───────────────────────────────────
        hourly = _aggregate_to_hourly(parsed, ch_id, dev_id, now_utc)
        db_write = SessionLocal()
        try:
            count = crud_device_data.upsert_hourly_data(db_write, hourly)
            total_hourly += count
        except Exception as e:
            logger.error(f"[ThingSpeak Sync] Hourly upsert failed for {ch_id}: {e}")
        finally:
            db_write.close()

        # ── Aggregate + save daily ────────────────────────────────────
        daily = _aggregate_to_daily(parsed, ch_id, dev_id, now_utc)
        db_write = SessionLocal()
        try:
            count = crud_device_data.upsert_daily_data(db_write, daily)
            total_daily += count
        except Exception as e:
            logger.error(f"[ThingSpeak Sync] Daily upsert failed for {ch_id}: {e}")
        finally:
            db_write.close()

    # ── 5. Retention cleanup ──────────────────────────────────────────────
    db_cleanup = SessionLocal()
    try:
        crud_device_data.cleanup_raw_data(db_cleanup, retention_days=14)
        crud_device_data.cleanup_hourly_data(db_cleanup, retention_days=30)
        crud_device_data.cleanup_daily_data(db_cleanup, retention_days=180)
    except Exception as e:
        logger.error(f"[ThingSpeak Sync] Retention cleanup failed: {e}")
    finally:
        db_cleanup.close()

    summary = {
        "success": True,
        "message": (
            f"Synced {total_raw} raw, {total_hourly} hourly, "
            f"{total_daily} daily records for {len(ts_devices)} devices "
            f"({skipped_devices} skipped — already complete)"
        ),
        "devices": len(ts_devices),
        "raw_records": total_raw,
        "hourly_records": total_hourly,
        "daily_records": total_daily,
        "date_range": f"{start_date} → {end_date}",
    }
    logger.info(f"[ThingSpeak Sync] Complete: {summary['message']}")
    return summary
