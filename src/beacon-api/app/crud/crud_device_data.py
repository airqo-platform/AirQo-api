import logging
from typing import List, Dict, Any, Optional
from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import and_

from app.models.device_data import SyncRawDeviceData, SyncHourlyDeviceData, SyncDailyDeviceData

logger = logging.getLogger(__name__)

# Field column names used across all three tables
RAW_FIELD_COLUMNS = [f"field{i}" for i in range(1, 21)]
AVG_FIELD_COLUMNS = [f"field{i}_avg" for i in range(1, 21)]


# ── Raw Data ──────────────────────────────────────────────────────────────────

def upsert_raw_data(db: Session, records: List[Dict[str, Any]], batch_size: int = 2000) -> int:
    """
    Bulk upsert raw ThingSpeak feed records.
    On conflict (channel_id, entry_id), update all field values + synced_at.
    """
    if not records:
        return 0

    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        values = []
        for r in batch:
            row = {
                "channel_id": r["channel_id"],
                "device_id": r.get("device_id"),
                "entry_id": r["entry_id"],
                "created_at_ts": r["created_at_ts"],
                "synced_at": datetime.utcnow(),
            }
            for col in RAW_FIELD_COLUMNS:
                row[col] = r.get(col)
            values.append(row)

        stmt = pg_insert(SyncRawDeviceData).values(values)
        update_cols = {col: stmt.excluded[col] for col in RAW_FIELD_COLUMNS}
        update_cols["synced_at"] = stmt.excluded.synced_at
        update_cols["device_id"] = stmt.excluded.device_id

        stmt = stmt.on_conflict_do_update(
            constraint="uq_raw_channel_entry",
            set_=update_cols,
        )
        db.execute(stmt)
        db.commit()
        total += len(values)

    logger.info(f"Upserted {total} raw device data records")
    return total


# ── Hourly Data ───────────────────────────────────────────────────────────────

def upsert_hourly_data(db: Session, records: List[Dict[str, Any]], batch_size: int = 2000) -> int:
    """
    Bulk upsert hourly aggregated records.
    On conflict (channel_id, hour_start), update all averages.
    """
    if not records:
        return 0

    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        values = []
        for r in batch:
            row = {
                "channel_id": r["channel_id"],
                "device_id": r.get("device_id"),
                "hour_start": r["hour_start"],
                "record_count": r.get("record_count", 0),
                "complete": r.get("complete", False),
                "synced_at": datetime.utcnow(),
            }
            for col in AVG_FIELD_COLUMNS:
                row[col] = r.get(col)
            values.append(row)

        stmt = pg_insert(SyncHourlyDeviceData).values(values)
        update_cols = {col: stmt.excluded[col] for col in AVG_FIELD_COLUMNS}
        update_cols["record_count"] = stmt.excluded.record_count
        update_cols["complete"] = stmt.excluded.complete
        update_cols["synced_at"] = stmt.excluded.synced_at
        update_cols["device_id"] = stmt.excluded.device_id

        stmt = stmt.on_conflict_do_update(
            constraint="uq_hourly_channel_hour",
            set_=update_cols,
        )
        db.execute(stmt)
        db.commit()
        total += len(values)

    logger.info(f"Upserted {total} hourly device data records")
    return total


# ── Daily Data ────────────────────────────────────────────────────────────────

def upsert_daily_data(db: Session, records: List[Dict[str, Any]], batch_size: int = 2000) -> int:
    """
    Bulk upsert daily aggregated records.
    On conflict (channel_id, data_date), update all averages.
    """
    if not records:
        return 0

    total = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        values = []
        for r in batch:
            row = {
                "channel_id": r["channel_id"],
                "device_id": r.get("device_id"),
                "data_date": r["data_date"],
                "record_count": r.get("record_count", 0),
                "complete": r.get("complete", False),
                "synced_at": datetime.utcnow(),
            }
            for col in AVG_FIELD_COLUMNS:
                row[col] = r.get(col)
            values.append(row)

        stmt = pg_insert(SyncDailyDeviceData).values(values)
        update_cols = {col: stmt.excluded[col] for col in AVG_FIELD_COLUMNS}
        update_cols["record_count"] = stmt.excluded.record_count
        update_cols["complete"] = stmt.excluded.complete
        update_cols["synced_at"] = stmt.excluded.synced_at
        update_cols["device_id"] = stmt.excluded.device_id

        stmt = stmt.on_conflict_do_update(
            constraint="uq_daily_channel_date",
            set_=update_cols,
        )
        db.execute(stmt)
        db.commit()
        total += len(values)

    logger.info(f"Upserted {total} daily device data records")
    return total


# ── Query Helpers ─────────────────────────────────────────────────────────────

def get_raw_data(
    db: Session,
    channel_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = 1000,
) -> List[SyncRawDeviceData]:
    """Query raw data with optional channel and time-range filters."""
    q = db.query(SyncRawDeviceData)
    if channel_id:
        q = q.filter(SyncRawDeviceData.channel_id == channel_id)
    if start:
        q = q.filter(SyncRawDeviceData.created_at_ts >= start)
    if end:
        q = q.filter(SyncRawDeviceData.created_at_ts <= end)
    return q.order_by(SyncRawDeviceData.created_at_ts.desc()).limit(limit).all()


def get_hourly_data(
    db: Session,
    channel_id: Optional[str] = None,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    limit: int = 1000,
) -> List[SyncHourlyDeviceData]:
    """Query hourly data with optional channel and time-range filters."""
    q = db.query(SyncHourlyDeviceData)
    if channel_id:
        q = q.filter(SyncHourlyDeviceData.channel_id == channel_id)
    if start:
        q = q.filter(SyncHourlyDeviceData.hour_start >= start)
    if end:
        q = q.filter(SyncHourlyDeviceData.hour_start <= end)
    return q.order_by(SyncHourlyDeviceData.hour_start.desc()).limit(limit).all()


def get_daily_data(
    db: Session,
    channel_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = 1000,
) -> List[SyncDailyDeviceData]:
    """Query daily data with optional channel and date-range filters."""
    q = db.query(SyncDailyDeviceData)
    if channel_id:
        q = q.filter(SyncDailyDeviceData.channel_id == channel_id)
    if start_date:
        q = q.filter(SyncDailyDeviceData.data_date >= start_date)
    if end_date:
        q = q.filter(SyncDailyDeviceData.data_date <= end_date)
    return q.order_by(SyncDailyDeviceData.data_date.desc()).limit(limit).all()

# ── Completeness Check ────────────────────────────────────────────────────────

def get_complete_daily_dates(
    db: Session, channel_id: str, start_date: date, end_date: date
) -> set:
    """
    Return the set of dates in [start_date, end_date] that already have
    complete=True daily records for the given channel_id.
    """
    rows = (
        db.query(SyncDailyDeviceData.data_date)
        .filter(
            SyncDailyDeviceData.channel_id == channel_id,
            SyncDailyDeviceData.data_date >= start_date,
            SyncDailyDeviceData.data_date <= end_date,
            SyncDailyDeviceData.complete == True,
        )
        .all()
    )
    return {r[0] for r in rows}


# ── Retention Cleanup ─────────────────────────────────────────────────────────

def cleanup_raw_data(db: Session, retention_days: int = 14) -> int:
    """Delete raw data older than `retention_days`. Default: 2 weeks."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    deleted = (
        db.query(SyncRawDeviceData)
        .filter(SyncRawDeviceData.created_at_ts < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info(f"Cleaned up {deleted} raw records older than {retention_days} days")
    return deleted


def cleanup_hourly_data(db: Session, retention_days: int = 30) -> int:
    """Delete hourly data older than `retention_days`. Default: 1 month."""
    cutoff = datetime.utcnow() - timedelta(days=retention_days)
    deleted = (
        db.query(SyncHourlyDeviceData)
        .filter(SyncHourlyDeviceData.hour_start < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info(f"Cleaned up {deleted} hourly records older than {retention_days} days")
    return deleted


def cleanup_daily_data(db: Session, retention_days: int = 180) -> int:
    """Delete daily data older than `retention_days`. Default: 6 months."""
    cutoff = date.today() - timedelta(days=retention_days)
    deleted = (
        db.query(SyncDailyDeviceData)
        .filter(SyncDailyDeviceData.data_date < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    logger.info(f"Cleaned up {deleted} daily records older than {retention_days} days")
    return deleted
