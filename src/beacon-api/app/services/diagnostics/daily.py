"""
Daily Device Diagnostics
────────────────────────
Runs the diagnostic engine once per device per completed UTC day, using the raw
ThingSpeak readings stored by the sync pipeline, and persists the outcome
(health score, lifecycle state, issues with streaks, resolved issues) so device
and fleet health can be tracked over time.

Runs right after the scheduled ThingSpeak sync, and can be triggered manually
via POST /diagnostics/daily/run. Each run also catches up on any completed day
inside the lookback window that has not been diagnosed yet.
"""
import asyncio
import logging
import uuid
from collections import OrderedDict
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, func, text
from sqlalchemy.orm import Session

from app.crud.crud_device_data import RAW_FIELD_COLUMNS
from app.crud.crud_diagnostics import crud_diagnostics
from app.db.session import SessionLocal
from app.models.device_data import SyncDailyDeviceData, SyncRawDeviceData
from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.models.sync import SyncConfigValues, SyncDevice
from app.services.diagnostics.evaluator import DiagnosticEvaluator
from app.services.diagnostics.issues import SEVERITY_RANK, extract_issues, max_severity
from app.services.diagnostics.profile_model import DiagnosticModel, build_model
from app.utils.field_mappings import map_record_from_profile, normalize_and_unpack_record

logger = logging.getLogger(__name__)

# Bump when evidence rules or scoring change, so stored days can be told apart and re-run with force=True.
ENGINE_VERSION = "2.0.0"
SECONDS_PER_DAY = 86400.0
DEFAULT_LOOKBACK_DAYS = 3
# Raw readings are kept for 14 days by the sync retention cleanup; older days cannot be evaluated.
RAW_RETENTION_DAYS = 14
# An issue seen again within this many days of the previous diagnosed day continues its streak,
# so a device that is offline for a day does not reset a persistent fault.
STREAK_MAX_GAP_DAYS = 3
DIAGNOSTICS_RETENTION_DAYS = 365
# PostgreSQL advisory lock key shared by every daily diagnostics run (scheduled, manual, forced).
RUN_LOCK_KEY = 820260913001

_SUMMARY_EXCLUDED_KEYS = {"created_at_ts", "channel_id", "device_id", "entry_id"}

_evaluator = DiagnosticEvaluator()


# ── Window & Candidate Selection ──────────────────────────────────────────────

def resolve_window(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    today: Optional[date] = None,
) -> Tuple[date, date]:
    """Resolve the date range to diagnose, limited to completed days that still have raw data."""
    today = today or datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    earliest = today - timedelta(days=RAW_RETENTION_DAYS - 1)

    end = min(end_date or yesterday, yesterday)
    start = start_date or (end - timedelta(days=max(1, lookback_days) - 1))
    return max(start, earliest), end


def find_pending_device_days(
    db: Session,
    start_date: date,
    end_date: date,
    device_ids: Optional[List[str]] = None,
    force: bool = False,
) -> List[Tuple[str, date, str]]:
    """
    Return (device_id, date, channel_id) for every completed day with data in the
    range. Days already diagnosed are excluded unless force=True.
    Ordered by device then date so issue streaks chain correctly.
    """
    q = (
        db.query(SyncDailyDeviceData.device_id, SyncDailyDeviceData.data_date, SyncDailyDeviceData.channel_id)
        .join(SyncDevice, SyncDevice.device_id == SyncDailyDeviceData.device_id)
        .filter(
            SyncDailyDeviceData.complete == True,  # noqa: E712
            SyncDailyDeviceData.record_count > 0,
            SyncDailyDeviceData.data_date >= start_date,
            SyncDailyDeviceData.data_date <= end_date,
        )
    )
    if device_ids:
        q = q.filter(SyncDailyDeviceData.device_id.in_(device_ids))
    if not force:
        q = q.outerjoin(
            DeviceDailyDiagnostic,
            and_(
                DeviceDailyDiagnostic.device_id == SyncDailyDeviceData.device_id,
                DeviceDailyDiagnostic.diagnosis_date == SyncDailyDeviceData.data_date,
            ),
        ).filter(DeviceDailyDiagnostic.id.is_(None))

    rows = q.order_by(SyncDailyDeviceData.device_id, SyncDailyDeviceData.data_date).all()
    return [(r[0], r[1], r[2]) for r in rows]


# ── Per Device-Day Evaluation ─────────────────────────────────────────────────

def _as_utc(ts: datetime) -> datetime:
    return ts.astimezone(timezone.utc) if ts.tzinfo else ts.replace(tzinfo=timezone.utc)


def _load_raw_rows(db: Session, channel_id: str, day: date) -> List[SyncRawDeviceData]:
    day_start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    return (
        db.query(SyncRawDeviceData)
        .filter(
            SyncRawDeviceData.channel_id == channel_id,
            SyncRawDeviceData.created_at_ts >= day_start,
            SyncRawDeviceData.created_at_ts < day_start + timedelta(days=1),
        )
        .order_by(SyncRawDeviceData.created_at_ts)
        .all()
    )


def _prepare_records(raw_rows: List[SyncRawDeviceData], profile: Optional[Any]) -> List[Dict[str, Any]]:
    prepared = []
    for row in raw_rows:
        record: Dict[str, Any] = {"created_at_ts": row.created_at_ts}
        for col in RAW_FIELD_COLUMNS:
            value = getattr(row, col)
            if value is not None:
                record[col] = value
        unpacked = normalize_and_unpack_record(record)
        prepared.append(map_record_from_profile(unpacked, profile, use_keys=True, drop_unmapped=False))
    return prepared


def summarize_metrics(records: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
    values: Dict[str, List[float]] = {}
    for record in records:
        for key, value in record.items():
            if key in _SUMMARY_EXCLUDED_KEYS or isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            values.setdefault(key, []).append(float(value))

    return {
        key: {
            "mean": round(sum(vals) / len(vals), 3),
            "min": round(min(vals), 3),
            "max": round(max(vals), 3),
            "count": len(vals),
        }
        for key, vals in sorted(values.items())
    }


def _previous_diagnosis(db: Session, device_id: str, day: date) -> Optional[DeviceDailyDiagnostic]:
    return (
        db.query(DeviceDailyDiagnostic)
        .filter(
            DeviceDailyDiagnostic.device_id == device_id,
            DeviceDailyDiagnostic.diagnosis_date < day,
            DeviceDailyDiagnostic.diagnosis_date >= day - timedelta(days=STREAK_MAX_GAP_DAYS),
        )
        .order_by(DeviceDailyDiagnostic.diagnosis_date.desc())
        .first()
    )


def _resolve_device_profile(db: Session, device: SyncDevice) -> Optional[Any]:
    try:
        if device.profile_id:
            return crud_diagnostics.get_profile(db, device.profile_id)
        if device.category:
            return crud_diagnostics.get_profile(db, device.category)
    except Exception:
        logger.warning("[Daily Diagnostics] Could not resolve profile for device %s", device.device_id, exc_info=True)
    return None


def _device_config(db: Session, device_id: str) -> Dict[str, Any]:
    """Latest synced config values for a device, keyed by slot (config1…config10)."""
    row = (
        db.query(SyncConfigValues)
        .filter(SyncConfigValues.device_id == device_id)
        .order_by(SyncConfigValues.created_at.desc())
        .first()
    )
    if row is None:
        return {}
    return {f"config{i}": getattr(row, f"config{i}") for i in range(1, 11)}


def load_profile_model(profile: Any) -> Tuple[Any, DiagnosticModel]:
    """
    Build the diagnostic model plus a detached copy of the profile's telemetry mappings,
    so one profile can be reused across many devices and commits.
    """
    mapping_profile = SimpleNamespace(
        telemetry_mappings=profile.telemetry_mappings,
        category=profile.category,
    )
    return mapping_profile, build_model(profile)


def evaluate_device_day(
    db: Session,
    device: SyncDevice,
    channel_id: str,
    day: date,
    profile: Any,
    model: Optional[DiagnosticModel] = None,
    device_config: Optional[Dict[str, Any]] = None,
) -> Optional[DeviceDailyDiagnostic]:
    """
    Evaluate one device for one UTC day against its profile and stage the result
    (replacing any existing row for that day). Returns None when no raw readings exist.
    Raises ProfileNotDiagnosableError when the profile cannot drive an analysis.
    The caller is responsible for committing.
    """
    raw_rows = _load_raw_rows(db, channel_id, day)
    if not raw_rows:
        return None

    records = _prepare_records(raw_rows, profile)
    result = _evaluator.evaluate_telemetry(
        device_id=device.device_id,
        telemetry_records=records,
        profile=profile,
        model=model,
        device_config=device_config,
        window_hours=24.0,
        window_seconds=SECONDS_PER_DAY,
    )
    issues = extract_issues(result["active_evidences"])

    previous = _previous_diagnosis(db, device.device_id, day)
    previous_issues = {i.issue_code: i for i in previous.issues} if previous else {}

    existing = (
        db.query(DeviceDailyDiagnostic)
        .filter(DeviceDailyDiagnostic.device_id == device.device_id, DeviceDailyDiagnostic.diagnosis_date == day)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    timestamps = [_as_utc(r.created_at_ts) for r in raw_rows]
    top_diagnoses = result["top_diagnoses"]
    current_codes = {i["code"] for i in issues}

    diagnostic = DeviceDailyDiagnostic(
        device_id=device.device_id,
        channel_id=channel_id,
        diagnosis_date=day,
        profile_id=uuid.UUID(result["profile_id"]) if result["profile_id"] else None,
        record_count=len(raw_rows),
        hours_with_data=len({ts.hour for ts in timestamps}),
        first_record_at=timestamps[0],
        last_record_at=timestamps[-1],
        overall_health_score=result["overall_health_score"],
        lifecycle_state=result["lifecycle_state"],
        subsystem_scores=result["subsystem_scores"],
        active_evidences=result["active_evidences"],
        detected_symptoms=result["detected_symptoms"],
        top_diagnoses=top_diagnoses,
        top_cause_code=top_diagnoses[0]["cause_code"] if top_diagnoses else None,
        issue_count=len(issues),
        max_severity=max_severity(issues),
        resolved_issue_codes=sorted(set(previous_issues) - current_codes),
        metrics_summary=summarize_metrics(records),
        engine_version=ENGINE_VERSION,
        evaluated_at=datetime.now(timezone.utc),
    )

    for issue in issues:
        prior = previous_issues.get(issue["code"])
        diagnostic.issues.append(
            DeviceDailyIssue(
                device_id=device.device_id,
                diagnosis_date=day,
                issue_code=issue["code"],
                check_type=issue["check"],
                component_name=issue["component_name"],
                metric_key=issue["metric"],
                title=issue["title"],
                subsystem=issue["subsystem"],
                severity=issue["severity"],
                confidence=issue["confidence"],
                description=issue["description"],
                value=issue["value"],
                is_new=prior is None,
                streak_days=prior.streak_days + 1 if prior else 1,
                streak_start_date=prior.streak_start_date if prior else day,
            )
        )

    db.add(diagnostic)
    db.flush()
    return diagnostic


# ── Orchestration ─────────────────────────────────────────────────────────────

@contextmanager
def _run_lock(db: Session):
    """
    Hold a session-level advisory lock for the whole run so overlapping runs cannot pick the
    same device-days. Uses a dedicated connection, because the ORM session hands its connection
    back to the pool after every commit. Yields False when another run holds the lock.
    No-op on databases without advisory locks.
    """
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        yield True
        return

    conn = bind.connect()
    try:
        acquired = bool(conn.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": RUN_LOCK_KEY}).scalar())
        conn.commit()  # the lock is session-level; don't leave the connection idle in a transaction
        try:
            yield acquired
        finally:
            if acquired:
                conn.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": RUN_LOCK_KEY})
                conn.commit()
    finally:
        conn.close()


def _diagnose_pending(
    db: Session,
    start: date,
    end: date,
    device_ids: Optional[List[str]],
    force: bool,
    summary: Dict[str, Any],
) -> None:
    pending = find_pending_device_days(db, start, end, device_ids=device_ids, force=force)
    by_device: "OrderedDict[str, List[Tuple[date, str]]]" = OrderedDict()
    for device_id, day, channel_id in pending:
        by_device.setdefault(device_id, []).append((day, channel_id))

    summary["devices"] = len(by_device)
    logger.info(
        f"[Daily Diagnostics] {len(pending)} device-days pending across {len(by_device)} devices ({start} → {end})"
    )
    # Devices share a handful of profiles; build each profile's model once per run.
    models: Dict[Any, Optional[Tuple[Any, DiagnosticModel]]] = {}

    for device_id, days in by_device.items():
        device = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
        if device is None:
            continue
        profile = _resolve_device_profile(db, device)
        if profile is not None and profile.id not in models:
            models[profile.id] = load_profile_model(profile)
        loaded = models.get(profile.id) if profile is not None else None

        if loaded is None or not loaded[1].diagnosable:
            summary["skipped_no_profile"] += len(days)
            reasons = loaded[1].errors if loaded else ["no profile assigned"]
            logger.warning(f"[Daily Diagnostics] Skipping {device_id}: {'; '.join(reasons)}")
            continue
        mapping_profile, model = loaded
        device_config = _device_config(db, device_id)

        for day, channel_id in days:
            try:
                diagnostic = evaluate_device_day(
                    db, device, channel_id, day, mapping_profile, model=model, device_config=device_config
                )
                db.commit()
            except Exception:
                db.rollback()
                summary["failed"] += 1
                logger.exception(f"[Daily Diagnostics] Evaluation failed for {device_id} on {day}")
                continue

            if diagnostic is None:
                summary["skipped_no_raw_data"] += 1
            else:
                summary["evaluated"] += 1
                summary["issues_recorded"] += diagnostic.issue_count


def run_daily_diagnostics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    device_ids: Optional[List[str]] = None,
    force: bool = False,
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
) -> Dict[str, Any]:
    """
    Diagnose every completed device-day with data in the window. Idempotent:
    already diagnosed days are skipped unless force=True. CPU-bound — call via
    run_daily_diagnostics_async from async code.
    """
    start, end = resolve_window(start_date, end_date, lookback_days)
    summary: Dict[str, Any] = {
        "success": True,
        "date_range": f"{start} → {end}",
        "devices": 0,
        "evaluated": 0,
        "skipped_no_raw_data": 0,
        "skipped_no_profile": 0,
        "failed": 0,
        "issues_recorded": 0,
    }
    if start > end:
        summary["message"] = "No completed days with raw data in the requested window"
        return summary

    db = SessionLocal()
    try:
        with _run_lock(db) as acquired:
            if not acquired:
                summary["skipped_locked"] = True
                summary["message"] = "Another daily diagnostics run is in progress; this run was skipped"
                logger.info(f"[Daily Diagnostics] {summary['message']} ({start} → {end})")
                return summary
            _diagnose_pending(db, start, end, device_ids, force, summary)
    finally:
        db.close()

    summary["message"] = (
        f"Evaluated {summary['evaluated']} device-days for {summary['devices']} devices, "
        f"recorded {summary['issues_recorded']} issues "
        f"({summary['skipped_no_raw_data']} without raw data, {summary['skipped_no_profile']} without a usable "
        f"profile, {summary['failed']} failed)"
    )
    logger.info(f"[Daily Diagnostics] Complete: {summary['message']}")
    return summary


async def run_daily_diagnostics_async(**kwargs: Any) -> Dict[str, Any]:
    """Run the CPU-bound daily diagnostics in a worker thread so the event loop stays responsive."""
    return await asyncio.to_thread(run_daily_diagnostics, **kwargs)


def cleanup_old_daily_diagnostics(retention_days: int = DIAGNOSTICS_RETENTION_DAYS) -> int:
    db = SessionLocal()
    try:
        return crud_diagnostics.cleanup_daily_diagnostics(db, retention_days=retention_days)
    finally:
        db.close()


# ── Read-side Summaries ───────────────────────────────────────────────────────

def build_device_issue_summary(
    db: Session,
    device_id: str,
    days: int = 30,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    """Aggregate a device's daily diagnoses over the last `days` days into per-issue history and a health trend."""
    today = today or datetime.now(timezone.utc).date()
    start = today - timedelta(days=days)
    rows = crud_diagnostics.list_daily_diagnostics(
        db, device_id=device_id, start_date=start, end_date=today, limit=days + 1
    )
    rows = sorted(rows, key=lambda r: r.diagnosis_date)
    latest = rows[-1] if rows else None
    latest_issues = {i.issue_code: i for i in latest.issues} if latest else {}

    aggregated: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        for issue in row.issues:
            item = aggregated.setdefault(issue.issue_code, {
                "issue_code": issue.issue_code,
                "days_observed": 0,
                "first_seen": row.diagnosis_date,
            })
            item.update({
                "title": issue.title,
                "subsystem": issue.subsystem,
                "severity": issue.severity,
                "last_seen": row.diagnosis_date,
            })
            item["days_observed"] += 1

    for code, item in aggregated.items():
        active = latest_issues.get(code)
        item["is_active"] = active is not None
        item["current_streak_days"] = active.streak_days if active else 0

    issues = sorted(
        aggregated.values(),
        key=lambda i: (i["is_active"], SEVERITY_RANK.get(i["severity"], 0), i["days_observed"]),
        reverse=True,
    )
    scores = [r.overall_health_score for r in rows]

    return {
        "device_id": device_id,
        "start_date": start,
        "end_date": today,
        "days_diagnosed": len(rows),
        "average_health_score": round(sum(scores) / len(scores), 1) if scores else None,
        "latest_diagnosis_date": latest.diagnosis_date if latest else None,
        "latest_lifecycle_state": latest.lifecycle_state if latest else None,
        "issues": issues,
        "health_trend": [
            {
                "diagnosis_date": r.diagnosis_date,
                "overall_health_score": r.overall_health_score,
                "lifecycle_state": r.lifecycle_state,
                "issue_count": r.issue_count,
            }
            for r in rows
        ],
    }


def build_fleet_daily_summary(
    db: Session,
    diagnosis_date: Optional[date] = None,
    top_n: int = 10,
) -> Dict[str, Any]:
    """Fleet-wide health overview for one day (defaults to the most recent diagnosed day)."""
    day = diagnosis_date or crud_diagnostics.get_latest_diagnosis_date(db)
    summary: Dict[str, Any] = {
        "diagnosis_date": day,
        "devices_diagnosed": 0,
        "devices_with_issues": 0,
        "average_health_score": None,
        "lifecycle_state_counts": {},
        "max_severity_counts": {},
        "new_issue_count": 0,
        "resolved_issue_count": 0,
        "top_issues": [],
        "worst_devices": [],
    }
    if day is None:
        return summary

    on_day = DeviceDailyDiagnostic.diagnosis_date == day
    devices_diagnosed, devices_with_issues, average_score = db.query(
        func.count(DeviceDailyDiagnostic.id),
        func.sum(case((DeviceDailyDiagnostic.issue_count > 0, 1), else_=0)),
        func.avg(DeviceDailyDiagnostic.overall_health_score),
    ).filter(on_day).one()
    if not devices_diagnosed:
        return summary

    summary["devices_diagnosed"] = devices_diagnosed
    summary["devices_with_issues"] = int(devices_with_issues or 0)
    summary["average_health_score"] = round(float(average_score), 1) if average_score is not None else None
    summary["lifecycle_state_counts"] = dict(
        db.query(DeviceDailyDiagnostic.lifecycle_state, func.count(DeviceDailyDiagnostic.id))
        .filter(on_day)
        .group_by(DeviceDailyDiagnostic.lifecycle_state)
        .all()
    )
    summary["max_severity_counts"] = {
        (severity or "NONE"): count
        for severity, count in db.query(DeviceDailyDiagnostic.max_severity, func.count(DeviceDailyDiagnostic.id))
        .filter(on_day)
        .group_by(DeviceDailyDiagnostic.max_severity)
        .all()
    }
    summary["resolved_issue_count"] = sum(
        len(codes or []) for (codes,) in db.query(DeviceDailyDiagnostic.resolved_issue_codes).filter(on_day).all()
    )

    device_count = func.count(func.distinct(DeviceDailyIssue.device_id))
    top_issue_rows = (
        db.query(
            DeviceDailyIssue.issue_code,
            func.max(DeviceDailyIssue.check_type),
            func.max(DeviceDailyIssue.component_name),
            func.max(DeviceDailyIssue.title),
            func.max(DeviceDailyIssue.subsystem),
            func.max(DeviceDailyIssue.severity),
            device_count,
            func.sum(case((DeviceDailyIssue.is_new == True, 1), else_=0)),  # noqa: E712
        )
        .filter(DeviceDailyIssue.diagnosis_date == day)
        .group_by(DeviceDailyIssue.issue_code)
        .order_by(device_count.desc(), DeviceDailyIssue.issue_code)
        .all()
    )
    summary["new_issue_count"] = sum(int(r[-1] or 0) for r in top_issue_rows)
    summary["top_issues"] = [
        {
            "issue_code": code,
            "check_type": check_type,
            "component_name": component_name,
            "title": title,
            "subsystem": subsystem,
            "severity": severity,
            "device_count": count,
            "new_device_count": int(new_count or 0),
        }
        for code, check_type, component_name, title, subsystem, severity, count, new_count in top_issue_rows[:top_n]
    ]

    worst = (
        db.query(DeviceDailyDiagnostic)
        .filter(on_day)
        .order_by(DeviceDailyDiagnostic.overall_health_score.asc(), DeviceDailyDiagnostic.issue_count.desc())
        .limit(top_n)
        .all()
    )
    summary["worst_devices"] = [
        {
            "device_id": d.device_id,
            "overall_health_score": d.overall_health_score,
            "lifecycle_state": d.lifecycle_state,
            "issue_count": d.issue_count,
            "max_severity": d.max_severity,
            "top_cause_code": d.top_cause_code,
        }
        for d in worst
    ]
    return summary
