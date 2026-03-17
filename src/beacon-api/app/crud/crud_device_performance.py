import json
import logging
from typing import List, Dict, Any, Optional
from datetime import date, datetime

from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import func, and_, or_

from app.models.device_performance import SyncDevicePerformance

logger = logging.getLogger(__name__)


def upsert_device_performance(db: Session, records: List[Dict[str, Any]]) -> int:
    """
    Bulk upsert device performance records.
    On conflict (device_name, computed_for_date), update the metrics.
    Returns the number of records upserted.
    """
    if not records:
        return 0

    values = []
    for r in records:
        cohorts_val = r.get("cohorts", [])
        values.append({
            "device_id": r.get("device_id", ""),
            "device_name": r["device_name"],
            "latitude": r.get("latitude"),
            "longitude": r.get("longitude"),
            "last_active": r.get("last_active"),
            "uptime": r.get("uptime", 0.0),
            "data_completeness": r.get("data_completeness", 0.0),
            "error_margin": r.get("error_margin", 0.0),
            "cohorts_json": json.dumps(cohorts_val) if isinstance(cohorts_val, list) else cohorts_val,
            "complete_performance": r.get("complete_performance", False),
            "computed_for_date": r.get("computed_for_date", date.today()),
            "computed_at": datetime.utcnow(),
        })

    stmt = pg_insert(SyncDevicePerformance).values(values)
    stmt = stmt.on_conflict_do_update(
        constraint="uq_device_name_date",
        set_={
            "device_id": stmt.excluded.device_id,
            "latitude": stmt.excluded.latitude,
            "longitude": stmt.excluded.longitude,
            "last_active": stmt.excluded.last_active,
            "uptime": stmt.excluded.uptime,
            "data_completeness": stmt.excluded.data_completeness,
            "error_margin": stmt.excluded.error_margin,
            "cohorts_json": stmt.excluded.cohorts_json,
            "complete_performance": stmt.excluded.complete_performance,
            "computed_at": stmt.excluded.computed_at,
        },
    )

    db.execute(stmt)
    db.commit()
    logger.info(f"Upserted {len(values)} device performance records")
    return len(values)


def get_latest_performance(db: Session) -> List[SyncDevicePerformance]:
    """
    Return all records for the most recent computed_for_date.
    """
    latest_date = (
        db.query(SyncDevicePerformance.computed_for_date)
        .order_by(SyncDevicePerformance.computed_for_date.desc())
        .limit(1)
        .scalar()
    )
    if not latest_date:
        return []

    return (
        db.query(SyncDevicePerformance)
        .filter(SyncDevicePerformance.computed_for_date == latest_date)
        .all()
    )


def get_averaged_performance(db: Session, days: int = 14) -> List[Dict[str, Any]]:
    """
    Return averaged performance metrics per device over the last `days` days.

    For each device, computes AVG(uptime), AVG(data_completeness),
    AVG(error_margin) across all records in the window.
    Uses the latest record's device_id, lat, lon, last_active, and cohorts.
    Only averages days that have non-zero data to avoid diluting with
    days where the sync simply had no raw data available.
    Falls back to including zero-records if the device has no non-zero days.
    """
    from datetime import timedelta

    cutoff_date = date.today() - timedelta(days=days)

    # Subquery: average metrics per device (non-zero records only)
    avg_sq = (
        db.query(
            SyncDevicePerformance.device_name,
            func.avg(SyncDevicePerformance.uptime).label("avg_uptime"),
            func.avg(SyncDevicePerformance.data_completeness).label("avg_data_completeness"),
            func.avg(SyncDevicePerformance.error_margin).label("avg_error_margin"),
            func.count(SyncDevicePerformance.id).label("record_count"),
        )
        .filter(
            SyncDevicePerformance.computed_for_date >= cutoff_date,
            or_(
                SyncDevicePerformance.uptime > 0,
                SyncDevicePerformance.data_completeness > 0,
            ),
        )
        .group_by(SyncDevicePerformance.device_name)
        .subquery()
    )

    # Subquery: latest date per device (for metadata fallback + zero-only devices)
    latest_date_sq = (
        db.query(
            SyncDevicePerformance.device_name,
            func.max(SyncDevicePerformance.computed_for_date).label("latest_date"),
        )
        .filter(SyncDevicePerformance.computed_for_date >= cutoff_date)
        .group_by(SyncDevicePerformance.device_name)
        .subquery()
    )

    # Join latest records with averaged metrics
    latest_records = (
        db.query(
            SyncDevicePerformance,
            avg_sq.c.avg_uptime,
            avg_sq.c.avg_data_completeness,
            avg_sq.c.avg_error_margin,
        )
        .join(
            latest_date_sq,
            and_(
                SyncDevicePerformance.device_name == latest_date_sq.c.device_name,
                SyncDevicePerformance.computed_for_date == latest_date_sq.c.latest_date,
            ),
        )
        .outerjoin(
            avg_sq,
            SyncDevicePerformance.device_name == avg_sq.c.device_name,
        )
        .all()
    )

    results = []
    for record, avg_uptime, avg_data_completeness, avg_error_margin in latest_records:

        results.append({
            "device_id": record.device_id,
            "device_name": record.device_name,
            "latitude": record.latitude,
            "longitude": record.longitude,
            "last_active": record.last_active,
            "uptime": round(avg_uptime, 4) if avg_uptime else 0.0,
            "data_completeness": round(avg_data_completeness, 4) if avg_data_completeness else 0.0,
            "error_margin": round(avg_error_margin, 4) if avg_error_margin else 0.0,
            "cohorts": record.cohorts,
        })

    return results


def get_performance_for_date(db: Session, target_date: date) -> List[SyncDevicePerformance]:
    """Return all records for a specific date."""
    return (
        db.query(SyncDevicePerformance)
        .filter(SyncDevicePerformance.computed_for_date == target_date)
        .all()
    )


def has_complete_records_for_date(db: Session, target_date: date) -> bool:
    """Check if complete performance records exist for a given date."""
    return (
        db.query(SyncDevicePerformance.id)
        .filter(
            SyncDevicePerformance.computed_for_date == target_date,
            SyncDevicePerformance.complete_performance == True,
        )
        .limit(1)
        .scalar()
    ) is not None


def get_daily_performance_for_devices(
    db: Session, device_names: List[str]
) -> List[Dict[str, Any]]:
    """
    Return daily uptime and error_margin records for the given device names.
    Results are ordered by device_name then computed_for_date ascending.
    """
    if not device_names:
        return []

    records = (
        db.query(SyncDevicePerformance)
        .filter(SyncDevicePerformance.device_name.in_(device_names))
        .order_by(
            SyncDevicePerformance.device_name,
            SyncDevicePerformance.computed_for_date.asc(),
        )
        .all()
    )

    results = []
    for r in records:
        results.append({
            "device_name": r.device_name,
            "device_id": r.device_id,
            "latitude": r.latitude,
            "longitude": r.longitude,
            "last_active": r.last_active,
            "date": r.computed_for_date.isoformat(),
            "uptime": r.uptime or 0.0,
            "error_margin": r.error_margin or 0.0,
        })

    return results
