"""
Per-device readings on demand
─────────────────────────────
The nightly ThingSpeak sync and the external live-feed poll keep the local
``sync_*_device_data`` tables filled, but between runs a device someone is
looking at can be hours behind. Endpoints that show a single device answer
from the stored readings straight away and, when the newest stored reading is
stale, refresh just that device in the background:

- airqo devices fetch their ThingSpeak channel from the newest stored reading
  (or the start of the UTC day) up to now;
- devices from other manufacturers fetch their current reading through the
  live feed (``external_sync_service.fetch_current_reading``).

A ``device_readings_refresh`` row per device lets one refresh run at a time
across workers and replicas (they share the database, not memory), and keeps
a device that has stopped reporting from being refetched on every view: the
row holds ``running`` during a refresh and the outcome for a short cooldown
afterwards.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import BackgroundTasks
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.device_data import DeviceReadingsRefresh, SyncHourlyDeviceData, SyncRawDeviceData
from app.models.sync import SyncDevice
from app.schemas.data_sync import HourlyDeviceDataRecord, RawDeviceDataRecord
from app.services import external_sync_service as ext
from app.services import thingspeak_sync_service as ts
from app.utils.networks import (
    DATA_SOURCE_THINGSPEAK,
    device_data_source,
    device_source_key,
    is_network_enabled,
)

logger = logging.getLogger(__name__)

# What a request learns about the background refresh of the device it shows.
REFRESH_STARTED = "started"                # this request scheduled a refresh
REFRESH_RUNNING = "running"                # another request's refresh is still running
REFRESH_COOLDOWN = "cooldown"              # refreshed moments ago; stored readings are the latest available
REFRESH_NOT_NEEDED = "not_needed"          # the newest stored reading is recent
REFRESH_NOT_APPLICABLE = "not_applicable"  # past day, refresh turned off, or no readable source
REFRESH_UNAVAILABLE = "unavailable"        # the check itself failed; nothing was scheduled

SOURCE_THINGSPEAK = "thingspeak"
SOURCE_LIVE_FEED = "live_feed"

_CLAIM_RUNNING = "running"
# Upper bound on one refresh (ThingSpeak pages, live-feed retries with
# backoff); a refresh that dies without releasing its claim frees it after this.
_RUNNING_TTL_SECONDS = 300


# ── Device and stored readings ────────────────────────────────────────────────

def find_device(db: Session, device: str) -> Optional[SyncDevice]:
    """A synced device by registry id, else by name."""
    return (
        db.query(SyncDevice).filter(SyncDevice.device_id == device).first()
        or db.query(SyncDevice).filter(SyncDevice.device_name == device).first()
    )


def readings_key(dev: SyncDevice) -> Optional[str]:
    """The ``channel_id`` the device's readings are stored under."""
    return device_source_key(dev.network_id, dev.device_id, dev.device_number)


def refresh_source(dev: SyncDevice) -> Optional[str]:
    """Where a refresh reads ``dev`` from: ThingSpeak, the live feed, or nowhere (None)."""
    if not is_network_enabled(dev.network_id):
        return None
    if device_data_source(dev.network_id, dev.device_number, dev.readKey) == DATA_SOURCE_THINGSPEAK:
        return SOURCE_THINGSPEAK
    if ext.supports_live_feed(dev):
        return SOURCE_LIVE_FEED
    return None


def latest_reading_at(db: Session, channel_id: Optional[str]) -> Optional[datetime]:
    """Timestamp of the newest stored raw reading for ``channel_id``."""
    if not channel_id:
        return None
    latest = (
        db.query(func.max(SyncRawDeviceData.created_at_ts))
        .filter(SyncRawDeviceData.channel_id == channel_id)
        .scalar()
    )
    return ext._as_utc(latest) if latest else None


def stored_readings(
    db: Session, channel_id: str, day: date, frequency: str = "raw", limit: int = 10000,
) -> List[Any]:
    """Raw or hourly rows of one UTC day, oldest first."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    if frequency == "hourly":
        model, ts_col = SyncHourlyDeviceData, SyncHourlyDeviceData.hour_start
    else:
        model, ts_col = SyncRawDeviceData, SyncRawDeviceData.created_at_ts
    return (
        db.query(model)
        .filter(model.channel_id == channel_id, ts_col >= start, ts_col < end)
        .order_by(ts_col)
        .limit(limit)
        .all()
    )


def is_stale(last_reading_at: Optional[datetime], now_utc: datetime) -> bool:
    if last_reading_at is None:
        return True
    threshold = timedelta(minutes=settings.DEVICE_READINGS_STALE_MINUTES)
    return ext._as_utc(last_reading_at) < now_utc - threshold


def refresh_window_start(last_reading_at: Optional[datetime], now_utc: datetime) -> datetime:
    """
    Fetch from the newest stored reading, but never from before the start of
    the UTC day: earlier days are the nightly sync's job.
    """
    day_start = datetime.combine(now_utc.date(), datetime.min.time(), tzinfo=timezone.utc)
    if last_reading_at is not None and ext._as_utc(last_reading_at) > day_start:
        return ext._as_utc(last_reading_at)
    return day_start


def covers_today(end_date_time: Optional[str], now_utc: Optional[datetime] = None) -> bool:
    """True when a requested window ends today (UTC) or later."""
    end = ext.parse_record_time(end_date_time)
    if end is None:
        return False
    now_utc = now_utc or datetime.now(timezone.utc)
    return end.date() >= now_utc.date()


# ── Refresh claim (shared through the database) ───────────────────────────────

def _claim(device_id: str, now_utc: datetime) -> Tuple[bool, Optional[str]]:
    """
    Claim ``device_id`` for a refresh. Returns ``(claimed, state)``; when the
    claim fails, ``state`` is what the current holder left (``running`` or a
    refresh outcome in its cooldown).

    Safe across replicas: an expired row is taken over by one conditional
    UPDATE (a concurrent taker re-checks the condition and matches nothing),
    and two first claims race on the primary key.
    """
    until = now_utc + timedelta(seconds=_RUNNING_TTL_SECONDS)
    db = SessionLocal()
    try:
        taken = (
            db.query(DeviceReadingsRefresh)
            .filter(DeviceReadingsRefresh.device_id == device_id, DeviceReadingsRefresh.expires_at <= now_utc)
            .update({"state": _CLAIM_RUNNING, "expires_at": until}, synchronize_session=False)
        )
        db.commit()
        if taken:
            return True, _CLAIM_RUNNING
        current = (
            db.query(DeviceReadingsRefresh.state)
            .filter(DeviceReadingsRefresh.device_id == device_id)
            .scalar()
        )
        if current is not None:
            return False, current
        db.add(DeviceReadingsRefresh(device_id=device_id, state=_CLAIM_RUNNING, expires_at=until))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            return False, _CLAIM_RUNNING
        return True, _CLAIM_RUNNING
    finally:
        db.close()


def _release(device_id: str, outcome: str) -> None:
    """Hold ``device_id`` with the refresh's outcome for the cooldown."""
    until = datetime.now(timezone.utc) + timedelta(seconds=settings.DEVICE_READINGS_REFRESH_COOLDOWN_SECONDS)
    db = SessionLocal()
    try:
        (
            db.query(DeviceReadingsRefresh)
            .filter(DeviceReadingsRefresh.device_id == device_id)
            .update({"state": outcome, "expires_at": until}, synchronize_session=False)
        )
        db.commit()
    finally:
        db.close()


# ── Scheduling ────────────────────────────────────────────────────────────────

def refresh_if_stale(
    db: Session,
    background_tasks: BackgroundTasks,
    dev: Optional[SyncDevice],
    now_utc: Optional[datetime] = None,
) -> str:
    """
    Schedule a background refresh of ``dev`` when its newest stored reading
    is stale and no refresh of it is running or just ran. Returns one of the
    ``REFRESH_*`` states. Never raises, so any single-device endpoint can call
    it without risking its own response.
    """
    try:
        now_utc = now_utc or datetime.now(timezone.utc)
        if dev is None or refresh_source(dev) is None:
            return REFRESH_NOT_APPLICABLE
        if not is_stale(latest_reading_at(db, readings_key(dev)), now_utc):
            return REFRESH_NOT_NEEDED
        claimed, state = _claim(dev.device_id, now_utc)
        if claimed:
            background_tasks.add_task(refresh_device_readings, dev.device_id)
            return REFRESH_STARTED
        return REFRESH_RUNNING if state == _CLAIM_RUNNING else REFRESH_COOLDOWN
    except Exception as e:
        logger.warning(f"[Readings Refresh] check failed for {getattr(dev, 'device_id', None)}: {e}")
        return REFRESH_UNAVAILABLE


def refresh_viewed_device(db: Session, background_tasks: BackgroundTasks, device: str) -> str:
    """``refresh_if_stale`` for a device given by registry id or name. Never raises."""
    try:
        dev = find_device(db, device)
    except Exception as e:
        logger.warning(f"[Readings Refresh] lookup failed for {device}: {e}")
        return REFRESH_UNAVAILABLE
    return refresh_if_stale(db, background_tasks, dev)


def get_device_readings(
    db: Session,
    background_tasks: BackgroundTasks,
    dev: SyncDevice,
    day: Optional[date] = None,
    frequency: str = "raw",
    refresh: bool = True,
    limit: int = 10000,
    now_utc: Optional[datetime] = None,
) -> Dict[str, Any]:
    """
    The stored readings of ``dev`` for one UTC day (today by default). For
    today, a stale device is also refreshed in the background; ``refresh``
    in the response says what happened so a client knows whether to ask again.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    day = day or now_utc.date()
    channel_id = readings_key(dev)
    records = stored_readings(db, channel_id, day, frequency, limit) if channel_id else []
    schema = HourlyDeviceDataRecord if frequency == "hourly" else RawDeviceDataRecord

    status = REFRESH_NOT_APPLICABLE
    if refresh and day == now_utc.date():
        status = refresh_if_stale(db, background_tasks, dev, now_utc)

    return {
        "success": True,
        "device_id": dev.device_id,
        "device_name": dev.device_name,
        "network": dev.network_id,
        "channel_id": channel_id,
        "data_date": day,
        "frequency": frequency,
        "last_reading_at": latest_reading_at(db, channel_id),
        "refresh": status,
        "count": len(records),
        "data": [schema.model_validate(r) for r in records],
    }


# ── Background refresh ────────────────────────────────────────────────────────

async def _thingspeak_rows(
    dev: SyncDevice, since: datetime, now_utc: datetime,
) -> Tuple[List[Dict[str, Any]], str]:
    channel_id = str(dev.device_number)
    results = await ts.fetch_thingspeak_data_bulk(
        [{"channel_id": channel_id, "api_key": dev.readKey}],
        since.strftime("%Y-%m-%d"),
        now_utc.strftime("%Y-%m-%d"),
        start_time=since.strftime("%H:%M:%S"),
        end_time=now_utc.strftime("%H:%M:%S"),
    )
    rows = []
    for feed in results[0].get("feeds", []) if results else []:
        row = ts._parse_feed_record(feed, channel_id, dev.device_id)
        row["created_at_ts"] = ext.parse_record_time(row["created_at_ts"])
        if row["entry_id"] is not None and row["created_at_ts"] is not None:
            rows.append(row)
    return rows, "ok" if rows else "no_data"


async def _live_feed_rows(dev: SyncDevice, now_utc: datetime) -> Tuple[List[Dict[str, Any]], str]:
    params, headers = ext._platform_auth()
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        payload, outcome = await ext.fetch_current_reading(client, dev, params, headers)
    if outcome != "ok" or payload is None:
        return [], outcome
    db = SessionLocal()
    try:
        slot_maps = ext._slot_maps_for(db, [dev])
    finally:
        db.close()
    record = ext.feed_record(dev, payload, now_utc)
    rows = ext.build_raw_rows([record] if record else [], {dev.device_name: dev}, slot_maps)
    return rows, "ok" if rows else "no_data"


async def refresh_device_readings(device_id: str, now_utc: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Background task: fetch the newest readings of one device from its source,
    store them and rebuild the aggregates of the days they touch, then hold
    the device's claim with the outcome for the cooldown.
    """
    now_utc = now_utc or datetime.now(timezone.utc)
    result: Dict[str, Any] = {
        "device_id": device_id, "outcome": "failed", "raw_records": 0, "hourly_records": 0, "daily_records": 0,
    }
    try:
        db = SessionLocal()
        try:
            dev = find_device(db, device_id)
            last_reading_at = latest_reading_at(db, readings_key(dev)) if dev else None
        finally:
            db.close()

        source = refresh_source(dev) if dev else None
        if source == SOURCE_THINGSPEAK:
            rows, outcome = await _thingspeak_rows(dev, refresh_window_start(last_reading_at, now_utc), now_utc)
        elif source == SOURCE_LIVE_FEED:
            rows, outcome = await _live_feed_rows(dev, now_utc)
        else:
            rows, outcome = [], REFRESH_NOT_APPLICABLE

        if rows:
            db = SessionLocal()
            try:
                raw, hourly, daily = ext.store_device_rows(db, rows, dev.device_id, now_utc)
            finally:
                db.close()
            result.update(raw_records=raw, hourly_records=hourly, daily_records=daily)
        result["outcome"] = outcome
        logger.info(
            f"[Readings Refresh] {device_id} ({source}): {outcome}, "
            f"{result['raw_records']} raw / {result['hourly_records']} hourly / {result['daily_records']} daily rows"
        )
    except Exception as e:
        logger.exception(f"[Readings Refresh] refresh of {device_id} failed: {e}")
    finally:
        try:
            _release(device_id, result["outcome"])
        except Exception as e:
            # The claim still expires after _RUNNING_TTL_SECONDS.
            logger.error(f"[Readings Refresh] releasing {device_id} failed: {e}")
    return result
