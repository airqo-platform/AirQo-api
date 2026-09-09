"""
CRUD helpers for reading the locally-synced ThingSpeak data tables:
``sync_raw_device_data`` / ``sync_hourly_device_data`` / ``sync_daily_device_data``.

These tables key rows by ``channel_id`` (the ThingSpeak channel number as a
string). We resolve device identity by joining with ``sync_device`` on
``sync_device.device_number`` (Integer) cast to text.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.device_data import (
    SyncRawDeviceData,
    SyncHourlyDeviceData,
    SyncDailyDeviceData,
)
from app.models.sync import SyncDevice

logger = logging.getLogger(__name__)


# Frequency → (Model class, timestamp column name, avg-column-suffix)
_FREQ_CONFIG = {
    "raw": (SyncRawDeviceData, "created_at_ts", ""),
    "hourly": (SyncHourlyDeviceData, "hour_start", "_avg"),
    "daily": (SyncDailyDeviceData, "data_date", "_avg"),
}


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        logger.warning(f"Could not parse datetime value: {value!r}")
        return None


def _resolve_devices(
    db: Session, device_names: Iterable[str]
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, str]]:
    """
    Build lookups from a list of device names:

    - ``info_by_name``: {device_name: {device_id, device_number, category}}
    - ``name_by_channel``: {channel_id_str: device_name}
    """
    names = [n for n in device_names if n]
    if not names:
        return {}, {}

    rows = (
        db.query(SyncDevice)
        .filter(SyncDevice.device_name.in_(names))
        .all()
    )
    info_by_name: Dict[str, Dict[str, Any]] = {}
    name_by_channel: Dict[str, str] = {}
    for row in rows:
        if not row.device_name:
            continue
        info_by_name[row.device_name] = {
            "device_id": row.device_id,
            "device_number": row.device_number,
            "category": row.category or "lowcost",
        }
        if row.device_number is not None:
            name_by_channel[str(row.device_number)] = row.device_name

    return info_by_name, name_by_channel


def _row_to_dict(row: Any, frequency: str) -> Dict[str, Any]:
    """Convert an ORM row to a plain dict shaped for downstream mapping."""
    _model, ts_col, suffix = _FREQ_CONFIG[frequency]

    ts_value = getattr(row, ts_col, None)
    datetime_iso: Optional[str]
    if ts_value is None:
        datetime_iso = None
    elif frequency == "daily":
        # ``data_date`` is a ``date`` — render as ISO date string.
        datetime_iso = ts_value.isoformat()
    else:
        datetime_iso = ts_value.isoformat()

    out: Dict[str, Any] = {
        "channel_id": getattr(row, "channel_id", None),
        "device_id": getattr(row, "device_id", None),
        "datetime": datetime_iso,
        "frequency": frequency,
    }

    for i in range(1, 21):
        column_name = f"field{i}{suffix}"
        out[f"field{i}"] = getattr(row, column_name, None)

    if frequency != "raw":
        out["record_count"] = getattr(row, "record_count", None)
        out["complete"] = getattr(row, "complete", None)
    else:
        out["entry_id"] = getattr(row, "entry_id", None)

    return out


def _apply_time_range(query, ts_attr, frequency: str, start: Optional[str], end: Optional[str]):
    """Apply start/end filters to ``query`` against ``ts_attr`` for the given frequency."""
    start_dt = _parse_datetime(start)
    end_dt = _parse_datetime(end)
    if frequency == "daily":
        # ``data_date`` is a date — compare on the date component.
        start_val = start_dt.date() if start_dt is not None else None
        end_val = end_dt.date() if end_dt is not None else None
    else:
        start_val = start_dt
        end_val = end_dt
    if start_val is not None:
        query = query.filter(ts_attr >= start_val)
    if end_val is not None:
        query = query.filter(ts_attr <= end_val)
    return query


def _group_rows_by_device(
    rows: Iterable[Any],
    name_by_channel: Dict[str, str],
    device_names: List[str],
    frequency: str,
) -> Dict[str, List[Dict[str, Any]]]:
    """Convert ORM rows into per-device dict lists keyed by device_name."""
    records_by_device: Dict[str, List[Dict[str, Any]]] = {name: [] for name in device_names}
    for row in rows:
        device_name = name_by_channel.get(str(row.channel_id))
        if not device_name:
            continue
        rec = _row_to_dict(row, frequency)
        rec["device_name"] = device_name
        records_by_device.setdefault(device_name, []).append(rec)
    return records_by_device


def get_device_data_for_devices(
    db: Session,
    device_names: List[str],
    start: Optional[str],
    end: Optional[str],
    frequency: str = "hourly",
) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, Dict[str, Any]]]:
    """
    Fetch locally-synced device data for ``device_names`` between ``start`` and
    ``end`` at the requested ``frequency`` (``raw`` / ``hourly`` / ``daily``).

    Returns:
        records_by_device: {device_name: [row_dict, ...]}
        info_by_name: {device_name: {device_id, device_number, category}}

    Each row dict carries:
        - ``device_name``, ``device_id``, ``channel_id``
        - ``datetime`` (ISO 8601 string; for daily it's ``YYYY-MM-DD``)
        - ``frequency``
        - ``field1``..``field20`` (raw values; ``_avg`` suffix stripped for
          hourly/daily aggregates)
        - ``entry_id`` (raw) or ``record_count``/``complete`` (hourly/daily)
    """
    frequency = (frequency or "hourly").lower()
    if frequency not in _FREQ_CONFIG:
        raise ValueError(
            f"Invalid frequency {frequency!r}. Expected one of: "
            f"{sorted(_FREQ_CONFIG)}"
        )

    info_by_name, name_by_channel = _resolve_devices(db, device_names)
    if not name_by_channel:
        return {name: [] for name in device_names}, info_by_name

    model_cls, ts_col, _suffix = _FREQ_CONFIG[frequency]
    ts_attr = getattr(model_cls, ts_col)

    channels = list(name_by_channel.keys())
    BATCH_SIZE = 200
    rows = []
    for i in range(0, len(channels), BATCH_SIZE):
        batch = channels[i : i + BATCH_SIZE]
        query = db.query(model_cls).filter(model_cls.channel_id.in_(batch))
        query = _apply_time_range(query, ts_attr, frequency, start, end)
        rows.extend(query.order_by(ts_attr.asc()).all())

    records_by_device = _group_rows_by_device(rows, name_by_channel, device_names, frequency)
    return records_by_device, info_by_name


def get_latest_raw_timestamps(
    db: Session,
    channel_ids: Iterable[str],
) -> Dict[str, datetime]:
    """
    Return the most recent ``created_at_ts`` from ``sync_raw_device_data`` for
    each provided channel_id.

    Returns a dict ``{channel_id_str: datetime}``. Channel ids with no rows
    are omitted.
    """
    ids = [str(c) for c in channel_ids if c is not None and str(c) != ""]
    if not ids:
        return {}

    BATCH_SIZE = 200
    out: Dict[str, datetime] = {}
    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        rows = (
            db.query(
                SyncRawDeviceData.channel_id,
                func.max(SyncRawDeviceData.created_at_ts).label("last_ts"),
            )
            .filter(SyncRawDeviceData.channel_id.in_(batch))
            .group_by(SyncRawDeviceData.channel_id)
            .all()
        )
        for r in rows:
            if r.last_ts is not None:
                out[str(r.channel_id)] = r.last_ts
    return out


def get_device_metrics_for_map_view(
    db: Session,
    channel_ids: Iterable[str],
    start: Optional[str],
    end: Optional[str],
    frequency: str = "hourly",
) -> Dict[str, Dict[str, float]]:
    """
    Compute lightweight aggregate metrics (uptime, data_completeness, error_margin)
    for map-view devices directly in SQL.

    Instead of fetching hundreds of thousands of raw/hourly rows into Python,
    this function executes a single GROUP BY query returning only 1 summary row per channel.

    Returns:
        {channel_id_str: {"uptime": float, "data_completeness": float, "error_margin": float}}
    """
    frequency = (frequency or "hourly").lower()
    if frequency not in _FREQ_CONFIG:
        raise ValueError(
            f"Invalid frequency {frequency!r}. Expected one of: "
            f"{sorted(_FREQ_CONFIG)}"
        )

    ids = [str(c) for c in channel_ids if c is not None and str(c) != ""]
    if not ids:
        return {}

    model_cls, ts_col, _suffix = _FREQ_CONFIG[frequency]
    ts_attr = getattr(model_cls, ts_col)

    start_dt = _parse_datetime(start)
    end_dt = _parse_datetime(end)
    use_days = frequency == "daily"
    if start_dt and end_dt and end_dt > start_dt:
        if use_days:
            total_buckets = max(1, int((end_dt.date() - start_dt.date()).days) + 1)
        else:
            total_buckets = max(1, int((end_dt - start_dt).total_seconds() // 3600))
    else:
        total_buckets = 1

    if frequency == "raw":
        field1_col = model_cls.field1
        field3_col = model_cls.field3
        bind = db.get_bind() if hasattr(db, "get_bind") else getattr(db, "bind", None)
        is_sqlite = bind is not None and getattr(bind.dialect, "name", "") == "sqlite"
        if is_sqlite:
            hour_expr = func.strftime("%Y-%m-%d %H", model_cls.created_at_ts)
        else:
            hour_expr = func.date_trunc("hour", model_cls.created_at_ts)
        bucket_expr = func.count(func.distinct(hour_expr))
    elif frequency == "daily":
        field1_col = model_cls.field1_avg
        field3_col = model_cls.field3_avg
        bucket_expr = func.count(func.distinct(model_cls.data_date))
    else:  # hourly
        field1_col = model_cls.field1_avg
        field3_col = model_cls.field3_avg
        bucket_expr = func.count(func.distinct(model_cls.hour_start))

    BATCH_SIZE = 200
    metrics_by_channel: Dict[str, Dict[str, float]] = {}

    for i in range(0, len(ids), BATCH_SIZE):
        batch = ids[i : i + BATCH_SIZE]
        query = (
            db.query(
                model_cls.channel_id,
                bucket_expr.label("bucket_count"),
                func.avg(field1_col).label("avg_s1"),
                func.avg(field3_col).label("avg_s2"),
            )
            .filter(model_cls.channel_id.in_(batch))
        )
        query = _apply_time_range(query, ts_attr, frequency, start, end)
        rows = query.group_by(model_cls.channel_id).all()

        for row in rows:
            cid = str(row.channel_id)
            bucket_count = row.bucket_count or 0
            uptime = round(min(bucket_count / total_buckets, 1.0) * 100.0, 2)
            avg_s1 = row.avg_s1
            avg_s2 = row.avg_s2
            if avg_s1 is not None and avg_s2 is not None:
                err = round(abs(avg_s1 - avg_s2), 4)
            else:
                err = 0.0
            metrics_by_channel[cid] = {
                "uptime": uptime,
                "data_completeness": uptime,
                "error_margin": err,
            }

    return metrics_by_channel
