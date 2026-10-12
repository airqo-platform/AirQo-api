"""
External-manufacturer data sync
───────────────────────────────
Backfills readings for devices from sensor manufacturers other than AirQo
(airgradient, iqair, metone, ...). Those devices have no ThingSpeak channel;
their measurements reach the platform through the ETL pipelines and land in
BigQuery tagged with the device's network. This job pulls them through the
platform's ``/analytics/raw-data`` endpoint, the same endpoint beacon already
uses for airqo devices in the cohort performance path, and stores them in
the local ``sync_*_device_data`` tables so every read path (latest readings,
online status, performance, diagnostics) works for every manufacturer.

Rows are keyed by the registry device id (``device_source_key``) instead of
a ThingSpeak channel number, and named fields (``pm2_5``, ``temperature``,
...) are placed into ``field1..field20`` through the device's manufacturer
profile (see ``manufacturer_profiles``).
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import crud_device_data
from app.db.session import SessionLocal
from app.models.device_schema import DeviceProfile
from app.models.sync import SyncDevice
from app.services.manufacturer_profiles import (
    assign_profiles_to_external_devices,
    ensure_manufacturer_profiles,
    map_record_to_slots,
    slot_map_for_profile,
)
from app.services.thingspeak_sync_service import _aggregate_to_daily, _aggregate_to_hourly
from app.utils.networks import (
    AIRQO_NETWORK,
    DATA_SOURCE_EXTERNAL_API,
    device_data_source,
    device_source_key,
    is_network_enabled,
    normalize_network,
)

logger = logging.getLogger(__name__)

RAW_DATA_PATH = "/analytics/raw-data"
# Device names per raw-data request (matches the cohort performance path).
CHUNK_SIZE = 50
# The analytics API caps raw windows to a few days per request.
SEGMENT_DAYS = 7
MAX_RETRIES = 3
# raw-data is rate limited (5 requests per minute per IP), so back off generously.
RETRY_BACKOFF_SECONDS = 15
# Analytics validates ``network`` against its enum but does not use it to
# filter rows (device names decide). Deployments that predate the wider enum
# reject unknown networks with 422; we then retry with the historic default.
FALLBACK_NETWORK = AIRQO_NETWORK
_RETRYABLE_STATUSES = {429, 502, 503, 504}


@dataclass
class FetchGroup:
    network: str
    category: str
    device_names: List[str]
    start_date: date
    end_date: date
    missing_days: int = 0


@dataclass
class SyncSummary:
    devices: int = 0
    groups: int = 0
    failed_groups: int = 0
    records: int = 0
    raw_records: int = 0
    hourly_records: int = 0
    daily_records: int = 0
    profiles_created: List[str] = field(default_factory=list)
    profiles_assigned: int = 0


# ── Device selection ──────────────────────────────────────────────────────────

def select_external_devices(db: Session) -> List[SyncDevice]:
    """Mirrored devices whose readings come from a manufacturer API rather than ThingSpeak."""
    rows = (
        db.query(SyncDevice)
        .filter(SyncDevice.network_id.isnot(None), SyncDevice.device_name.isnot(None))
        .all()
    )
    return [
        d for d in rows
        if is_network_enabled(d.network_id)
        and device_data_source(d.network_id, d.device_number, d.readKey, d.serial_number, d.api_code)
        == DATA_SOURCE_EXTERNAL_API
    ]


def _platform_auth() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Query params and headers that authenticate beacon against the platform."""
    params: Dict[str, str] = {}
    headers: Dict[str, str] = {}
    api_token = (getattr(settings, "PLATFORM_API_TOKEN", "") or "").strip()
    if api_token:
        params["token"] = api_token
    jwt = (getattr(settings, "TOKEN", "") or "").strip()
    if jwt:
        headers["Authorization"] = jwt if jwt.startswith("JWT ") else f"JWT {jwt}"
    return params, headers


# ── Planning ──────────────────────────────────────────────────────────────────

def _date_range(start: date, end: date) -> List[date]:
    days = []
    d = start
    while d <= end:
        days.append(d)
        d += timedelta(days=1)
    return days


def _split_segments(start: date, end: date, segment_days: int) -> List[Tuple[date, date]]:
    segments = []
    seg_start = start
    while seg_start <= end:
        seg_end = min(seg_start + timedelta(days=segment_days - 1), end)
        segments.append((seg_start, seg_end))
        seg_start = seg_end + timedelta(days=1)
    return segments


def plan_fetch_groups(
    db: Session,
    devices: Iterable[SyncDevice],
    range_start: date,
    range_end: date,
) -> List[FetchGroup]:
    """
    Work out which (network, category) groups still have days without a
    complete daily record and split them into raw-data requests of at most
    ``CHUNK_SIZE`` devices and ``SEGMENT_DAYS`` days.
    """
    expected = set(_date_range(range_start, range_end))
    missing_by_group: Dict[Tuple[str, str], Dict[str, Set[date]]] = defaultdict(dict)

    for dev in devices:
        key = device_source_key(dev.network_id, dev.device_id, dev.device_number)
        if not key:
            continue
        complete = crud_device_data.get_complete_daily_dates(db, key, range_start, range_end)
        missing = expected - complete
        if not missing:
            continue
        network = normalize_network(dev.network_id) or AIRQO_NETWORK
        category = (dev.category or "lowcost").strip().lower()
        missing_by_group[(network, category)][dev.device_name] = missing

    groups: List[FetchGroup] = []
    for (network, category), missing_by_name in missing_by_group.items():
        names = sorted(missing_by_name)
        window_start = min(min(days) for days in missing_by_name.values())
        window_end = max(max(days) for days in missing_by_name.values())
        total_missing = sum(len(days) for days in missing_by_name.values())
        for i in range(0, len(names), CHUNK_SIZE):
            chunk = names[i:i + CHUNK_SIZE]
            for seg_start, seg_end in _split_segments(window_start, window_end, SEGMENT_DAYS):
                groups.append(FetchGroup(network, category, chunk, seg_start, seg_end, total_missing))
    return groups


def build_raw_data_payload(
    network: str,
    category: str,
    device_names: List[str],
    start_date: date,
    end_date: date,
) -> Dict[str, Any]:
    """Body for ``POST /analytics/raw-data`` covering one group and date segment."""
    return {
        "network": network,
        "device_category": "bam" if category == "bam" else "lowcost",
        "device_names": list(device_names),
        "startDateTime": f"{start_date.isoformat()}T00:00:00Z",
        "endDateTime": f"{end_date.isoformat()}T23:59:59Z",
        "frequency": "raw",
        "datatype": "raw",
        "downloadType": "json",
        "pollutants": ["pm2_5", "pm10"],
        "metaDataFields": ["latitude", "longitude"],
        "weatherFields": ["temperature", "humidity"],
    }


# ── Fetching ──────────────────────────────────────────────────────────────────

async def _post_with_retries(
    client: httpx.AsyncClient,
    url: str,
    body: Dict[str, Any],
    params: Dict[str, str],
    headers: Dict[str, str],
    max_retries: int,
) -> Optional[httpx.Response]:
    for attempt in range(1, max_retries + 1):
        try:
            response = await client.post(url, json=body, params=params, headers=headers)
        except (httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ConnectError) as e:
            if attempt < max_retries:
                delay = RETRY_BACKOFF_SECONDS * attempt
                logger.warning(
                    f"[External Sync] raw-data request failed ({e.__class__.__name__}), "
                    f"retrying in {delay}s (attempt {attempt}/{max_retries})"
                )
                await asyncio.sleep(delay)
                continue
            logger.error(f"[External Sync] raw-data request failed after {max_retries} attempts: {e}")
            return None
        if response.status_code in _RETRYABLE_STATUSES and attempt < max_retries:
            delay = RETRY_BACKOFF_SECONDS * attempt
            logger.warning(
                f"[External Sync] raw-data returned HTTP {response.status_code}, "
                f"retrying in {delay}s (attempt {attempt}/{max_retries})"
            )
            await asyncio.sleep(delay)
            continue
        return response
    return None


async def fetch_raw_data(
    client: httpx.AsyncClient,
    payload: Dict[str, Any],
    params: Dict[str, str],
    headers: Dict[str, str],
    max_retries: int = MAX_RETRIES,
) -> Tuple[List[Dict[str, Any]], bool]:
    """
    POST ``payload`` to raw-data and follow its cursor pagination.
    Returns ``(records, succeeded)``; a partial page set still returns the
    records collected so far.
    """
    url = f"{settings.PLATFORM_BASE_URL}{RAW_DATA_PATH}"
    body = dict(payload)
    records: List[Dict[str, Any]] = []
    while True:
        response = await _post_with_retries(client, url, body, params, headers, max_retries)
        if response is None:
            return records, False
        if response.status_code == 422 and body.get("network") != FALLBACK_NETWORK:
            logger.warning(
                f"[External Sync] analytics rejected network={body.get('network')!r} "
                f"(HTTP 422); retrying with network={FALLBACK_NETWORK!r}"
            )
            body["network"] = FALLBACK_NETWORK
            continue
        if response.status_code != 200:
            logger.error(
                f"[External Sync] raw-data HTTP {response.status_code} for "
                f"{len(body.get('device_names', []))} devices "
                f"({body.get('startDateTime')} → {body.get('endDateTime')}): {response.text[:300]}"
            )
            return records, False
        try:
            data = response.json()
        except ValueError as e:
            logger.error(f"[External Sync] could not parse raw-data response: {e}")
            return records, False
        records.extend(data.get("data") or [])
        metadata = data.get("metadata") or {}
        cursor = metadata.get("next")
        if metadata.get("has_more") and cursor:
            body["cursor"] = cursor
            continue
        return records, True


# ── Row building ──────────────────────────────────────────────────────────────

_TIME_FORMATS = ("%Y-%m-%d %H:%M:%SZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S")


def parse_record_time(value: Any) -> Optional[datetime]:
    """Parse the ``datetime`` of a raw-data record into an aware UTC datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).strip()
    for fmt in _TIME_FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def build_raw_rows(
    records: Iterable[Dict[str, Any]],
    devices_by_name: Dict[str, SyncDevice],
    slot_maps: Dict[str, Dict[str, str]],
) -> List[Dict[str, Any]]:
    """
    Turn raw-data records into ``sync_raw_device_data`` rows. ``entry_id`` is
    the reading's epoch second, which keeps re-fetched readings idempotent
    under the (channel_id, entry_id) unique constraint.
    """
    rows: List[Dict[str, Any]] = []
    for rec in records:
        name = rec.get("device_name") or rec.get("device_id")
        dev = devices_by_name.get(name)
        if dev is None:
            continue
        ts = parse_record_time(rec.get("datetime") or rec.get("timestamp") or rec.get("time"))
        if ts is None:
            continue
        key = device_source_key(dev.network_id, dev.device_id, dev.device_number)
        if not key:
            continue
        slots = map_record_to_slots(rec, slot_maps.get(dev.device_id, {}))
        if not slots:
            continue
        row: Dict[str, Any] = {
            "channel_id": key,
            "device_id": dev.device_id,
            "entry_id": int(ts.timestamp()),
            "created_at_ts": ts,
        }
        for i in range(1, 21):
            row[f"field{i}"] = slots.get(f"field{i}")
        rows.append(row)
    return rows


# ── Orchestrator ──────────────────────────────────────────────────────────────

def _upsert_rows(rows: List[Dict[str, Any]], now_utc: datetime, summary: SyncSummary) -> None:
    """Upsert raw rows, then hourly/daily aggregates per source key."""
    db = SessionLocal()
    try:
        summary.raw_records += crud_device_data.upsert_raw_data(db, rows)
    except Exception as e:
        logger.error(f"[External Sync] raw upsert failed: {e}")
    finally:
        db.close()

    by_key: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_key[row["channel_id"]].append(row)

    for key, key_rows in by_key.items():
        device_id = key_rows[0].get("device_id")
        hourly = _aggregate_to_hourly(key_rows, key, device_id, now_utc)
        daily = _aggregate_to_daily(key_rows, key, device_id, now_utc)
        db = SessionLocal()
        try:
            summary.hourly_records += crud_device_data.upsert_hourly_data(db, hourly)
            summary.daily_records += crud_device_data.upsert_daily_data(db, daily)
        except Exception as e:
            logger.error(f"[External Sync] aggregate upsert failed for {key}: {e}")
        finally:
            db.close()


async def sync_external_device_data(
    days: int = 14,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Backfill readings for every external-manufacturer device.

    1. Seed/assign manufacturer profiles so each device has a slot layout.
    2. Find the days in the window without a complete daily record.
    3. Fetch those days from ``/analytics/raw-data`` per (network, category).
    4. Upsert raw rows and recompute hourly/daily aggregates.

    Retention cleanup is shared with the ThingSpeak job, which runs first.
    """
    now_utc = datetime.now(timezone.utc)
    range_end = date.fromisoformat(end_date) if end_date else now_utc.date()
    range_start = date.fromisoformat(start_date) if start_date else (now_utc - timedelta(days=days)).date()
    summary = SyncSummary()

    db = SessionLocal()
    try:
        seeded = ensure_manufacturer_profiles(db)
        summary.profiles_created = seeded.get("created", [])
        summary.profiles_assigned = assign_profiles_to_external_devices(db)
        devices = select_external_devices(db)
        summary.devices = len(devices)
        if not devices:
            logger.info("[External Sync] No external-manufacturer devices to sync")
            return {"success": True, "message": "No eligible devices", **summary.__dict__}

        profile_ids = {d.profile_id for d in devices if d.profile_id}
        profiles = {
            p.id: p for p in db.query(DeviceProfile).filter(DeviceProfile.id.in_(list(profile_ids))).all()
        } if profile_ids else {}
        slot_maps = {
            d.device_id: slot_map_for_profile(profiles.get(d.profile_id), d.category) for d in devices
        }
        devices_by_name = {d.device_name: d for d in devices}
        groups = plan_fetch_groups(db, devices, range_start, range_end)
    finally:
        db.close()

    summary.groups = len(groups)
    logger.info(
        f"[External Sync] {summary.devices} devices, {len(groups)} raw-data requests "
        f"({range_start} → {range_end})"
    )
    if not groups:
        return {"success": True, "message": "All days already complete", **summary.__dict__}

    params, headers = _platform_auth()
    if not params and not headers:
        logger.warning("[External Sync] No PLATFORM_API_TOKEN or TOKEN configured; raw-data calls will be unauthenticated")

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        for idx, group in enumerate(groups, start=1):
            payload = build_raw_data_payload(
                group.network, group.category, group.device_names, group.start_date, group.end_date,
            )
            logger.info(
                f"[External Sync] Request {idx}/{len(groups)}: network={group.network} "
                f"category={group.category} devices={len(group.device_names)} "
                f"{group.start_date} → {group.end_date}"
            )
            records, ok = await fetch_raw_data(client, payload, params, headers)
            if not ok:
                summary.failed_groups += 1
            summary.records += len(records)
            rows = build_raw_rows(records, devices_by_name, slot_maps)
            if rows:
                _upsert_rows(rows, now_utc, summary)

    message = (
        f"Synced {summary.raw_records} raw, {summary.hourly_records} hourly, "
        f"{summary.daily_records} daily records for {summary.devices} external devices "
        f"({summary.failed_groups}/{summary.groups} requests failed)"
    )
    logger.info(f"[External Sync] Complete: {message}")
    return {"success": summary.failed_groups == 0, "message": message, "date_range": f"{range_start} → {range_end}", **summary.__dict__}
