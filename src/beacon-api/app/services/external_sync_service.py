"""
External-manufacturer data sync
───────────────────────────────
Readings for devices from sensor manufacturers other than AirQo (airgradient,
iqair, metone, ...). Those devices have no ThingSpeak channel, so beacon uses
three complementary sources, closest to the device first:

1. **Live feed** (``poll_external_feeds``): the registry's
   ``GET /devices/feeds/transform/recent?serial_number=`` calls the
   manufacturer API through the per-network adapter, applies the vendor
   credentials server-side and returns the latest reading with AirQo field
   names. Polled on an interval for near real-time latest readings and online
   status. No vendor secrets live in beacon.
2. **Direct history** (``DIRECT_SOURCES``): manufacturer APIs that offer
   per-device history by date range, read with beacon's own credentials.
   AirGradient's authenticated raw endpoint is the first one.
3. **Analytics raw-data** (fallback): the platform's ``/analytics/raw-data``
   endpoint, backed by the ETL pipelines' BigQuery raw table. Used for
   devices without a direct source and when a direct fetch fails.

All three land in the same ``sync_*_device_data`` tables airqo devices use,
keyed by the registry device id (``device_source_key``) and laid out through
the device's manufacturer profile (``manufacturer_profiles``), so every read
path works for every manufacturer.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.crud import crud_device_data
from app.db.session import SessionLocal
from app.models.device_data import SyncRawDeviceData
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
FEED_PATH = "/devices/feeds/transform/recent"
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
# Keys of a live-feed response that are not readings.
_FEED_META_KEYS = {"isCache", "success", "message", "reason", "undefined", "DeviceType"}


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
    direct_devices: int = 0
    direct_requests: int = 0
    direct_failed: int = 0
    groups: int = 0
    failed_groups: int = 0
    records: int = 0
    raw_records: int = 0
    hourly_records: int = 0
    daily_records: int = 0
    profiles_created: List[str] = field(default_factory=list)
    profiles_assigned: int = 0


@dataclass
class FeedPollSummary:
    devices: int = 0
    polled: int = 0
    readings: int = 0
    not_found: int = 0
    failed: int = 0
    raw_records: int = 0
    hourly_records: int = 0
    daily_records: int = 0


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


def feed_networks() -> Set[str]:
    """Networks whose registry adapter can fetch a live reading."""
    raw = getattr(settings, "EXTERNAL_FEED_NETWORKS", "") or ""
    return {n for n in (normalize_network(p) for p in raw.split(",")) if n}


def select_feed_devices(db: Session) -> List[SyncDevice]:
    """External devices on a network with a live-feed adapter and a serial number."""
    allowed = feed_networks()
    return [
        d for d in select_external_devices(db)
        if d.serial_number and normalize_network(d.network_id) in allowed
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


def missing_dates_for_device(db: Session, dev: SyncDevice, range_start: date, range_end: date) -> Set[date]:
    """Days in the window without a complete daily record for ``dev``."""
    key = device_source_key(dev.network_id, dev.device_id, dev.device_number)
    if not key:
        return set()
    expected = set(_date_range(range_start, range_end))
    complete = crud_device_data.get_complete_daily_dates(db, key, range_start, range_end)
    return expected - complete


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
    missing_by_group: Dict[Tuple[str, str], Dict[str, Set[date]]] = defaultdict(dict)

    for dev in devices:
        missing = missing_dates_for_device(db, dev, range_start, range_end)
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


# ── HTTP helpers ──────────────────────────────────────────────────────────────

async def _request_with_retries(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    max_retries: int = MAX_RETRIES,
    **kwargs: Any,
) -> Optional[httpx.Response]:
    """Send a request, retrying transient transport errors and 429/5xx with backoff."""
    send = client.post if method.upper() == "POST" else client.get
    for attempt in range(1, max_retries + 1):
        try:
            response = await send(url, **kwargs)
        except (httpx.TimeoutException, httpx.RemoteProtocolError, httpx.ConnectError) as e:
            if attempt < max_retries:
                delay = RETRY_BACKOFF_SECONDS * attempt
                logger.warning(
                    f"[External Sync] {method} {url.split('?')[0]} failed ({e.__class__.__name__}), "
                    f"retrying in {delay}s (attempt {attempt}/{max_retries})"
                )
                await asyncio.sleep(delay)
                continue
            logger.error(f"[External Sync] {method} {url.split('?')[0]} failed after {max_retries} attempts: {e}")
            return None
        if response.status_code in _RETRYABLE_STATUSES and attempt < max_retries:
            delay = RETRY_BACKOFF_SECONDS * attempt
            logger.warning(
                f"[External Sync] {method} {url.split('?')[0]} returned HTTP {response.status_code}, "
                f"retrying in {delay}s (attempt {attempt}/{max_retries})"
            )
            await asyncio.sleep(delay)
            continue
        return response
    return None


async def _post_with_retries(
    client: httpx.AsyncClient,
    url: str,
    body: Dict[str, Any],
    params: Dict[str, str],
    headers: Dict[str, str],
    max_retries: int,
) -> Optional[httpx.Response]:
    return await _request_with_retries(
        client, "POST", url, max_retries=max_retries, json=body, params=params, headers=headers,
    )


# ── Source 3: analytics raw-data ──────────────────────────────────────────────

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


# ── Source 2: direct manufacturer history ─────────────────────────────────────

class AirGradientRawSource:
    """
    AirGradient's authenticated history endpoint
    ``GET {base}/locations/{location_id}/measures/raw?token=&from=&to=``.

    Only devices shared privately with the account (``authRequired`` true in
    the registry) have history there; public "world" devices expose a current
    snapshot only and are left to the live feed and analytics fallback.
    """

    network = "airgradient"
    # The API serves a limited window per call; the pipeline uses 12-hour chunks.
    chunk_hours = 12
    _location_re = re.compile(r"/locations/([^/?#]+)/")

    @property
    def token(self) -> str:
        return (getattr(settings, "AIRGRADIENT_API_TOKEN", "") or "").strip()

    @property
    def base_url(self) -> str:
        return (getattr(settings, "AIRGRADIENT_BASE_URL", "") or "").rstrip("/")

    def available(self) -> bool:
        return bool(self.token and self.base_url)

    def location_id(self, dev: SyncDevice) -> Optional[str]:
        if dev.serial_number:
            return str(dev.serial_number).strip()
        match = self._location_re.search(dev.api_code or "")
        return match.group(1) if match else None

    def supports(self, dev: SyncDevice) -> bool:
        return (
            self.available()
            and normalize_network(dev.network_id) == self.network
            and bool(dev.auth_required)
            and self.location_id(dev) is not None
        )

    def url(self, dev: SyncDevice) -> str:
        return f"{self.base_url}/locations/{self.location_id(dev)}/measures/raw"

    @staticmethod
    def _window_params(start: datetime, end: datetime) -> Dict[str, str]:
        fmt = "%Y%m%d%H%M%SZ"
        return {"from": start.strftime(fmt), "to": end.strftime(fmt)}

    async def fetch(
        self,
        client: httpx.AsyncClient,
        dev: SyncDevice,
        start_date: date,
        end_date: date,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Readings for ``dev`` over the date window as records ``build_raw_rows`` understands."""
        records: List[Dict[str, Any]] = []
        window_start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        window_end = datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        cursor = window_start
        ok = True
        while cursor < window_end:
            chunk_end = min(cursor + timedelta(hours=self.chunk_hours), window_end)
            params = {"token": self.token, **self._window_params(cursor, chunk_end)}
            response = await _request_with_retries(
                client, "GET", self.url(dev), params=params, headers={"accept": "application/json"},
            )
            if response is None or response.status_code != 200:
                status = response.status_code if response is not None else "no response"
                logger.warning(
                    f"[External Sync] AirGradient raw history HTTP {status} for {dev.device_name} "
                    f"({cursor:%Y-%m-%d %H:%M} → {chunk_end:%Y-%m-%d %H:%M})"
                )
                ok = False
                break
            try:
                payload = response.json()
            except ValueError:
                logger.warning(f"[External Sync] AirGradient returned non-JSON for {dev.device_name}")
                ok = False
                break
            for item in payload if isinstance(payload, list) else []:
                if isinstance(item, dict):
                    records.append({**item, "device_name": dev.device_name, "datetime": item.get("timestamp")})
            cursor = chunk_end
        return records, ok


DIRECT_SOURCES = [AirGradientRawSource()]


def direct_source_for(dev: SyncDevice):
    for source in DIRECT_SOURCES:
        if source.supports(dev):
            return source
    return None


# ── Row building ──────────────────────────────────────────────────────────────

_TIME_FORMATS = (
    "%Y-%m-%d %H:%M:%SZ", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
)


def parse_record_time(value: Any) -> Optional[datetime]:
    """Parse the ``datetime`` of a reading into an aware UTC datetime."""
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
    Turn readings into ``sync_raw_device_data`` rows. ``entry_id`` is the
    reading's epoch second, which keeps re-fetched readings idempotent under
    the (channel_id, entry_id) unique constraint.
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


def _slot_maps_for(db: Session, devices: List[SyncDevice]) -> Dict[str, Dict[str, str]]:
    profile_ids = {d.profile_id for d in devices if d.profile_id}
    profiles = {
        p.id: p for p in db.query(DeviceProfile).filter(DeviceProfile.id.in_(list(profile_ids))).all()
    } if profile_ids else {}
    return {d.device_id: slot_map_for_profile(profiles.get(d.profile_id), d.category) for d in devices}


# ── Aggregation ───────────────────────────────────────────────────────────────

def _upsert_rows(rows: List[Dict[str, Any]], now_utc: datetime, summary: Any) -> None:
    """Upsert raw rows, then hourly/daily aggregates computed from those rows."""
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


def _row_dict(row: SyncRawDeviceData) -> Dict[str, Any]:
    out: Dict[str, Any] = {"created_at_ts": row.created_at_ts}
    for i in range(1, 21):
        out[f"field{i}"] = getattr(row, f"field{i}")
    return out


def _as_utc(ts: datetime) -> datetime:
    return ts.replace(tzinfo=timezone.utc) if ts.tzinfo is None else ts.astimezone(timezone.utc)


def recompute_aggregates_from_db(
    db: Session, channel_id: str, device_id: Optional[str], timestamps: Iterable[datetime], now_utc: datetime,
) -> Tuple[int, int]:
    """
    Rebuild the hourly and daily aggregates touched by ``timestamps`` from
    every stored raw row, so a single new live-feed sample is averaged in with
    the samples already stored for that hour and day.
    """
    hours = {_as_utc(t).replace(minute=0, second=0, microsecond=0) for t in timestamps}
    days = {h.date() for h in hours}
    hourly_count = daily_count = 0

    for hour in hours:
        rows = (
            db.query(SyncRawDeviceData)
            .filter(
                SyncRawDeviceData.channel_id == channel_id,
                SyncRawDeviceData.created_at_ts >= hour,
                SyncRawDeviceData.created_at_ts < hour + timedelta(hours=1),
            )
            .all()
        )
        records = [{**_row_dict(r), "created_at_ts": _as_utc(r.created_at_ts)} for r in rows]
        if records:
            hourly_count += crud_device_data.upsert_hourly_data(
                db, _aggregate_to_hourly(records, channel_id, device_id, now_utc),
            )
    for day in days:
        day_start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
        rows = (
            db.query(SyncRawDeviceData)
            .filter(
                SyncRawDeviceData.channel_id == channel_id,
                SyncRawDeviceData.created_at_ts >= day_start,
                SyncRawDeviceData.created_at_ts < day_start + timedelta(days=1),
            )
            .all()
        )
        records = [{**_row_dict(r), "created_at_ts": _as_utc(r.created_at_ts)} for r in rows]
        if records:
            daily_count += crud_device_data.upsert_daily_data(
                db, _aggregate_to_daily(records, channel_id, device_id, now_utc),
            )
    return hourly_count, daily_count


# ── Source 1: registry live feed ──────────────────────────────────────────────

def feed_record(dev: SyncDevice, payload: Dict[str, Any], polled_at: datetime) -> Optional[Dict[str, Any]]:
    """
    Turn a live-feed response into a reading record. The reading's own
    timestamp is used when the manufacturer supplies one; otherwise the poll
    time stands in (IQAir's API carries no timestamp).
    """
    readings = {k: v for k, v in payload.items() if k not in _FEED_META_KEYS}
    if not readings:
        return None
    ts = parse_record_time(readings.pop("timestamp", None) or readings.pop("created_at", None)) or polled_at
    return {**readings, "device_name": dev.device_name, "datetime": ts}


async def fetch_live_feed(
    client: httpx.AsyncClient,
    dev: SyncDevice,
    params: Dict[str, str],
    headers: Dict[str, str],
) -> Tuple[Optional[Dict[str, Any]], str]:
    """
    Latest reading for ``dev`` from the registry feed endpoint.
    Returns ``(payload, outcome)`` with outcome ``ok`` / ``not_found`` / ``failed``.
    """
    url = f"{settings.PLATFORM_BASE_URL}{FEED_PATH}"
    response = await _request_with_retries(
        client, "GET", url, params={**params, "serial_number": dev.serial_number}, headers=headers,
    )
    if response is None:
        return None, "failed"
    if response.status_code == 404:
        return None, "not_found"
    if response.status_code != 200:
        logger.warning(
            f"[External Feed] HTTP {response.status_code} for {dev.device_name} "
            f"({dev.network_id}): {response.text[:200]}"
        )
        return None, "failed"
    try:
        payload = response.json()
    except ValueError:
        return None, "failed"
    if not isinstance(payload, dict) or payload.get("success") is False:
        return None, "failed"
    return payload, "ok"


async def poll_external_feeds() -> Dict[str, Any]:
    """
    Poll the registry live feed once for every external device on a network
    with a working adapter, store the reading as a raw row and refresh the
    hour's and day's aggregates.
    """
    now_utc = datetime.now(timezone.utc)
    summary = FeedPollSummary()

    db = SessionLocal()
    try:
        ensure_manufacturer_profiles(db)
        assign_profiles_to_external_devices(db)
        devices = select_feed_devices(db)
        slot_maps = _slot_maps_for(db, devices)
    finally:
        db.close()

    summary.devices = len(devices)
    if not devices:
        logger.info("[External Feed] No devices on a live-feed network")
        return {"success": True, "message": "No eligible devices", **summary.__dict__}

    params, headers = _platform_auth()
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for dev in devices:
            payload, outcome = await fetch_live_feed(client, dev, params, headers)
            summary.polled += 1
            if outcome == "not_found":
                summary.not_found += 1
                continue
            if outcome != "ok" or payload is None:
                summary.failed += 1
                continue
            record = feed_record(dev, payload, now_utc)
            rows = build_raw_rows([record] if record else [], {dev.device_name: dev}, slot_maps)
            if not rows:
                continue
            summary.readings += 1
            db = SessionLocal()
            try:
                summary.raw_records += crud_device_data.upsert_raw_data(db, rows)
                hourly, daily = recompute_aggregates_from_db(
                    db, rows[0]["channel_id"], dev.device_id, [r["created_at_ts"] for r in rows], now_utc,
                )
                summary.hourly_records += hourly
                summary.daily_records += daily
            except Exception as e:
                logger.error(f"[External Feed] storing reading for {dev.device_name} failed: {e}")
            finally:
                db.close()

    message = (
        f"Polled {summary.polled} devices: {summary.readings} readings stored, "
        f"{summary.not_found} unknown to the manufacturer, {summary.failed} failed"
    )
    logger.info(f"[External Feed] {message}")
    return {"success": True, "message": message, **summary.__dict__}


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def _sync_direct(
    client: httpx.AsyncClient,
    devices: List[SyncDevice],
    range_start: date,
    range_end: date,
    devices_by_name: Dict[str, SyncDevice],
    slot_maps: Dict[str, Dict[str, str]],
    now_utc: datetime,
    summary: SyncSummary,
) -> List[SyncDevice]:
    """
    Fetch history straight from the manufacturer for devices with a direct
    source. Returns the devices that still need the analytics fallback.
    """
    fallback: List[SyncDevice] = []
    for dev in devices:
        source = direct_source_for(dev)
        if source is None:
            fallback.append(dev)
            continue
        db = SessionLocal()
        try:
            missing = missing_dates_for_device(db, dev, range_start, range_end)
        finally:
            db.close()
        summary.direct_devices += 1
        if not missing:
            continue
        summary.direct_requests += 1
        records, ok = await source.fetch(client, dev, min(missing), max(missing))
        summary.records += len(records)
        rows = build_raw_rows(records, devices_by_name, slot_maps)
        if rows:
            _upsert_rows(rows, now_utc, summary)
        if not ok:
            summary.direct_failed += 1
            fallback.append(dev)
    return fallback


async def sync_external_device_data(
    days: int = 14,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Backfill readings for every external-manufacturer device.

    1. Seed/assign manufacturer profiles so each device has a slot layout.
    2. Devices with a direct manufacturer source fetch their missing days
       straight from the manufacturer API.
    3. Everything else (and any device whose direct fetch failed) is fetched
       from ``/analytics/raw-data`` per (network, category).
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
        slot_maps = _slot_maps_for(db, devices)
        devices_by_name = {d.device_name: d for d in devices}
    finally:
        db.close()

    params, headers = _platform_auth()
    if not params and not headers:
        logger.warning("[External Sync] No PLATFORM_API_TOKEN or TOKEN configured; platform calls will be unauthenticated")

    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        remaining = await _sync_direct(
            client, devices, range_start, range_end, devices_by_name, slot_maps, now_utc, summary,
        )

        db = SessionLocal()
        try:
            groups = plan_fetch_groups(db, remaining, range_start, range_end)
        finally:
            db.close()
        summary.groups = len(groups)
        logger.info(
            f"[External Sync] {summary.devices} devices ({summary.direct_devices} direct), "
            f"{len(groups)} raw-data requests ({range_start} → {range_end})"
        )

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
        f"({summary.direct_requests} direct requests, {summary.direct_failed} failed; "
        f"{summary.failed_groups}/{summary.groups} analytics requests failed)"
    )
    logger.info(f"[External Sync] Complete: {message}")
    return {
        "success": summary.failed_groups == 0 and summary.direct_failed == 0,
        "message": message,
        "date_range": f"{range_start} → {range_end}",
        **summary.__dict__,
    }
