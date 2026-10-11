"""
Diagnosis Summaries for List Endpoints
──────────────────────────────────────
Attaches each device's most recent stored daily diagnosis to device, site, grid
and cohort list responses, and rolls those diagnoses up per site, grid or cohort.

Only reads what the daily run already stored; the engine never runs here. Each
request costs two queries whatever the page size (one for the latest diagnosis
per device, one for those diagnoses' issues), and only summary columns are
selected so the large JSON columns are never loaded.
"""
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Optional

from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from app.models.health import DeviceDailyDiagnostic, DeviceDailyIssue
from app.services.diagnostics.issues import SEVERITY_RANK

DEFAULT_LOOKBACK_DAYS = 7
DEFAULT_ISSUES_PER_DEVICE = 3
DEFAULT_TOP_ISSUES = 5
# Device IDs per query, keeping IN lists to a size every driver accepts.
_ID_BATCH_SIZE = 1000


def _unique(ids: Iterable[Optional[str]]) -> List[str]:
    return list(dict.fromkeys(i for i in ids if i))


def _severity_rank(severity: Optional[str]) -> int:
    return SEVERITY_RANK.get(severity or "", 0)


def _load_diagnoses(db: Session, device_ids: List[str], since: date) -> Dict[str, Dict[str, Any]]:
    latest = (
        db.query(
            DeviceDailyDiagnostic.device_id.label("device_id"),
            func.max(DeviceDailyDiagnostic.diagnosis_date).label("diagnosis_date"),
        )
        .filter(
            DeviceDailyDiagnostic.device_id.in_(device_ids),
            DeviceDailyDiagnostic.diagnosis_date >= since,
        )
        .group_by(DeviceDailyDiagnostic.device_id)
        .subquery()
    )
    rows = (
        db.query(
            DeviceDailyDiagnostic.id,
            DeviceDailyDiagnostic.device_id,
            DeviceDailyDiagnostic.diagnosis_date,
            DeviceDailyDiagnostic.overall_health_score,
            DeviceDailyDiagnostic.lifecycle_state,
            DeviceDailyDiagnostic.issue_count,
            DeviceDailyDiagnostic.max_severity,
            DeviceDailyDiagnostic.top_cause_code,
            DeviceDailyDiagnostic.headline,
        )
        .join(
            latest,
            and_(
                DeviceDailyDiagnostic.device_id == latest.c.device_id,
                DeviceDailyDiagnostic.diagnosis_date == latest.c.diagnosis_date,
            ),
        )
        .all()
    )
    return {
        row.id: {
            "device_id": row.device_id,
            "diagnosis_date": row.diagnosis_date,
            "overall_health_score": row.overall_health_score,
            "lifecycle_state": row.lifecycle_state,
            "issue_count": row.issue_count or 0,
            "max_severity": row.max_severity,
            "top_cause_code": row.top_cause_code,
            "headline": row.headline,
            "issues": [],
        }
        for row in rows
    }


def _load_issues(db: Session, diagnoses: Dict[Any, Dict[str, Any]]) -> None:
    rows = (
        db.query(
            DeviceDailyIssue.daily_diagnostic_id,
            DeviceDailyIssue.issue_code,
            DeviceDailyIssue.title,
            DeviceDailyIssue.severity,
            DeviceDailyIssue.subsystem,
            DeviceDailyIssue.component_name,
            DeviceDailyIssue.streak_days,
            DeviceDailyIssue.is_new,
        )
        .filter(DeviceDailyIssue.daily_diagnostic_id.in_(list(diagnoses)))
        .all()
    )
    for row in rows:
        diagnoses[row.daily_diagnostic_id]["issues"].append({
            "issue_code": row.issue_code,
            "title": row.title,
            "severity": row.severity,
            "subsystem": row.subsystem,
            "component_name": row.component_name,
            "streak_days": row.streak_days or 1,
            "is_new": bool(row.is_new),
        })


def load_latest_diagnostics(
    db: Session,
    device_ids: Iterable[Optional[str]],
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    today: Optional[date] = None,
) -> Dict[str, Dict[str, Any]]:
    """
    Return {device_id: diagnosis} for each device's most recent diagnosed day in
    the last ``lookback_days`` days. Devices with no diagnosis in that window
    (offline, or without a diagnosable profile) are left out. Each diagnosis
    lists all of that day's issues, most severe first.
    """
    ids = _unique(device_ids)
    if not ids:
        return {}
    since = (today or datetime.now(timezone.utc).date()) - timedelta(days=lookback_days)

    by_device: Dict[str, Dict[str, Any]] = {}
    for start in range(0, len(ids), _ID_BATCH_SIZE):
        diagnoses = _load_diagnoses(db, ids[start:start + _ID_BATCH_SIZE], since)
        if not diagnoses:
            continue
        _load_issues(db, diagnoses)
        for diagnosis in diagnoses.values():
            diagnosis["issues"].sort(
                key=lambda i: (-_severity_rank(i["severity"]), -i["streak_days"], i["issue_code"])
            )
            by_device[diagnosis.pop("device_id")] = diagnosis
    return by_device


def attach_device_diagnostics(
    devices: List[Dict[str, Any]],
    diagnoses: Dict[str, Dict[str, Any]],
    id_key: str = "device_id",
    issues_per_device: int = DEFAULT_ISSUES_PER_DEVICE,
) -> None:
    """Set ``diagnostics`` on each device dict in place (``None`` when not diagnosed)."""
    for device in devices:
        diagnosis = diagnoses.get(device.get(id_key))
        device["diagnostics"] = (
            {**diagnosis, "issues": diagnosis["issues"][:issues_per_device]} if diagnosis else None
        )


def summarize_diagnostics(
    device_ids: Iterable[Optional[str]],
    diagnoses: Dict[str, Dict[str, Any]],
    top_issues: int = DEFAULT_TOP_ISSUES,
) -> Dict[str, Any]:
    """Roll up the diagnoses of a set of devices (a site, grid or cohort)."""
    ids = _unique(device_ids)
    diagnosed = [diagnoses[i] for i in ids if i in diagnoses]
    scores = [d["overall_health_score"] for d in diagnosed if d["overall_health_score"] is not None]
    severities = [d["max_severity"] for d in diagnosed if d["max_severity"]]

    issue_counts: Dict[str, Dict[str, Any]] = {}
    for diagnosis in diagnosed:
        for issue in diagnosis["issues"]:
            item = issue_counts.setdefault(issue["issue_code"], {
                "issue_code": issue["issue_code"],
                "title": issue["title"],
                "severity": issue["severity"],
                "subsystem": issue["subsystem"],
                "device_count": 0,
            })
            if _severity_rank(issue["severity"]) > _severity_rank(item["severity"]):
                item["severity"] = issue["severity"]
            item["device_count"] += 1

    return {
        "devices_total": len(ids),
        "devices_diagnosed": len(diagnosed),
        "devices_not_diagnosed": len(ids) - len(diagnosed),
        "devices_with_issues": sum(1 for d in diagnosed if d["issue_count"] > 0),
        "average_health_score": round(sum(scores) / len(scores), 1) if scores else None,
        "min_health_score": min(scores) if scores else None,
        "lifecycle_state_counts": dict(Counter(d["lifecycle_state"] for d in diagnosed)),
        "max_severity": max(severities, key=_severity_rank) if severities else None,
        "latest_diagnosis_date": max((d["diagnosis_date"] for d in diagnosed), default=None),
        "top_issues": sorted(
            issue_counts.values(),
            key=lambda i: (-i["device_count"], -_severity_rank(i["severity"]), i["issue_code"]),
        )[:top_issues],
    }


def _attach_and_summarize(container: Dict[str, Any], diagnoses: Dict[str, Dict[str, Any]]) -> None:
    devices = container.get("devices") or []
    attach_device_diagnostics(devices, diagnoses)
    container["diagnostics_summary"] = summarize_diagnostics((d.get("device_id") for d in devices), diagnoses)


def apply_diagnostics_to_devices(
    devices: List[Dict[str, Any]], db: Session, id_key: str = "device_id"
) -> None:
    """Attach the latest diagnosis to each device in a device list."""
    diagnoses = load_latest_diagnostics(db, (d.get(id_key) for d in devices))
    attach_device_diagnostics(devices, diagnoses, id_key=id_key)


def apply_diagnostics_to_containers(containers: List[Dict[str, Any]], db: Session) -> None:
    """
    For synced sites and cohorts, each holding a ``devices`` list keyed by
    ``device_id``: attach each device's diagnosis and a ``diagnostics_summary``
    per container, loading every device on the page at once.
    """
    diagnoses = load_latest_diagnostics(
        db, (d.get("device_id") for c in containers for d in c.get("devices") or [])
    )
    for container in containers:
        _attach_and_summarize(container, diagnoses)


def apply_diagnostics_to_grids(grids: List[Dict[str, Any]], db: Session) -> None:
    """Like :func:`apply_diagnostics_to_containers`, with summaries for each site and each grid."""
    diagnoses = load_latest_diagnostics(
        db,
        (d.get("device_id") for g in grids for s in g.get("sites") or [] for d in s.get("devices") or []),
    )
    for grid in grids:
        sites = grid.get("sites") or []
        for site in sites:
            _attach_and_summarize(site, diagnoses)
        grid["diagnostics_summary"] = summarize_diagnostics(
            (d.get("device_id") for s in sites for d in s.get("devices") or []), diagnoses
        )
