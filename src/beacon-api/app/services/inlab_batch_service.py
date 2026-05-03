"""
Inlab Batch Service — CRUD operations for collocation batches.

Batches group inlab devices for a date range, with optional per-device
date overrides. A device can belong to at most one active batch at a time.
Deletion is soft (is_deleted / is_removed flags).
"""
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import and_
from sqlalchemy.exc import IntegrityError

from app.models.sync import SyncDevice, SyncInlabBatch, SyncInlabBatchDevice
from app.services import cohort_service
from app.services.collocation_service import (
    _default_window,
    _lowcost_error_margin,
)

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────

def _iso(dt: Optional[datetime]) -> Optional[str]:
    """Datetime → ISO string or None."""
    if dt is None:
        return None
    return dt.isoformat()


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    """ISO string → aware datetime (UTC if naive), or None."""
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _active_batch_for_device(db: Session, device_id: str, exclude_batch_id: UUID = None):
    """Check if a device is already in a non-removed, non-deleted batch."""
    q = (
        db.query(SyncInlabBatchDevice)
        .join(SyncInlabBatch, SyncInlabBatch.id == SyncInlabBatchDevice.batch_id)
        .filter(
            SyncInlabBatchDevice.device_id == device_id,
            SyncInlabBatchDevice.is_removed.is_(False),
            SyncInlabBatch.is_deleted.is_(False),
        )
    )
    if exclude_batch_id:
        q = q.filter(SyncInlabBatch.id != exclude_batch_id)
    return q.first()


def _snapshot_firmware(db: Session, device_id: str) -> Optional[str]:
    dev = db.query(SyncDevice).filter(SyncDevice.device_id == device_id).first()
    return dev.current_firmware if dev else None


def _device_info_map(db: Session, device_ids: List[str]) -> Dict[str, SyncDevice]:
    """Load SyncDevice rows keyed by device_id."""
    if not device_ids:
        return {}
    rows = db.query(SyncDevice).filter(SyncDevice.device_id.in_(device_ids)).all()
    return {d.device_id: d for d in rows}


# ── CRUD ───────────────────────────────────────────────────────────

def create_batch(
    db: Session,
    name: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    device_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Create a batch and optionally attach devices."""

    # Unique-name check
    existing = (
        db.query(SyncInlabBatch)
        .filter(SyncInlabBatch.name == name, SyncInlabBatch.is_deleted.is_(False))
        .first()
    )
    if existing:
        return {"success": False, "message": f"A batch named '{name}' already exists"}

    batch = SyncInlabBatch(
        name=name,
        start_date=_parse_dt(start_date),
        end_date=_parse_dt(end_date),
    )
    db.add(batch)
    db.flush()  # get batch.id

    skipped: List[str] = []
    added: List[str] = []
    for did in (device_ids or []):
        # Pre-check is best-effort; the partial unique index on
        # sync_inlab_batch_device(device_id) WHERE is_removed = false is the
        # source of truth and protects against concurrent inserts.
        conflict = _active_batch_for_device(db, did)
        if conflict:
            skipped.append(did)
            continue
        link = SyncInlabBatchDevice(
            batch_id=batch.id,
            device_id=did,
            firmware_version=_snapshot_firmware(db, did),
        )
        try:
            with db.begin_nested():
                db.add(link)
                db.flush()
            added.append(did)
        except IntegrityError:
            logger.info(
                "Device %s already linked to an active batch; skipping insert.",
                did,
            )
            skipped.append(did)

    db.commit()
    db.refresh(batch)

    msg = f"Batch '{name}' created with {len(added)} device(s)"
    if skipped:
        msg += f" ({len(skipped)} skipped — already in another batch)"

    return {
        "success": True,
        "message": msg,
        "batch": _batch_summary(db, batch),
    }


def list_batches(
    db: Session, skip: int = 0, limit: int = 100,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "hourly",
) -> Dict[str, Any]:
    """List all non-deleted batches with device performance data."""
    q = (
        db.query(SyncInlabBatch)
        .filter(SyncInlabBatch.is_deleted.is_(False))
        .order_by(SyncInlabBatch.created_at.desc())
    )
    total = q.count()
    page = q.offset(skip).limit(limit).all()

    total_pages = (total + limit - 1) // limit if limit > 0 else 1
    current_page = (skip // limit) + 1 if limit > 0 else 1

    batches = [_build_batch_detail_dict(db, b, start_date_time, end_date_time, frequency) for b in page]
    return {
        "success": True,
        "message": "Batches fetched successfully",
        "meta": {
            "total": total, "totalResults": total,
            "skip": skip, "limit": limit,
            "page": current_page, "totalPages": total_pages,
        },
        "batches": batches,
    }


def get_batch_detail(
    db: Session,
    batch_id: str,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "hourly",
) -> Dict[str, Any]:
    """Get batch with full device list and per-device performance data."""
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}

    return {
        "success": True,
        "message": "Batch fetched successfully",
        "batch": _build_batch_detail_dict(db, batch, start_date_time, end_date_time, frequency),
    }


def _build_batch_detail_dict(
    db: Session,
    batch: SyncInlabBatch,
    start_date_time: Optional[str] = None,
    end_date_time: Optional[str] = None,
    frequency: str = "hourly",
) -> Dict[str, Any]:
    """Build the detailed batch dictionary including performance data."""
    links = (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .all()
    )

    device_ids = [lnk.device_id for lnk in links]
    info_map = _device_info_map(db, device_ids)

    # Pre-compute the effective window per link and group device names by window
    # so we issue one performance query per distinct (eff_start, eff_end) window
    # instead of one per device.
    link_windows: Dict[Any, tuple] = {}
    grouped_names: Dict[tuple, List[str]] = {}
    for lnk in links:
        dev = info_map.get(lnk.device_id)
        d_name = dev.device_name if dev else None

        eff_start = _iso(lnk.start_date) or _iso(batch.start_date) or start_date_time
        eff_end = _iso(lnk.end_date) or _iso(batch.end_date) or end_date_time
        eff_start, eff_end = _default_window(eff_start, eff_end)

        link_windows[lnk.id] = (eff_start, eff_end)
        if d_name:
            names = grouped_names.setdefault((eff_start, eff_end), [])
            if d_name not in names:
                names.append(d_name)

    # One performance query per distinct window, returning a name -> perf map.
    perf_by_window: Dict[tuple, Dict[str, Any]] = {}
    for window, names in grouped_names.items():
        eff_start, eff_end = window
        perf_by_window[window] = cohort_service.compute_device_performance(
            db, names, eff_start, eff_end, frequency=frequency,
        ) or {}

    # Build per-device entries with performance data
    devices_out: List[Dict[str, Any]] = []

    for lnk in links:
        dev = info_map.get(lnk.device_id)
        d_name = dev.device_name if dev else None

        eff_start, eff_end = link_windows[lnk.id]

        # Hydrate performance from the pre-computed per-window map
        perf: Dict[str, Any] = {}
        if d_name:
            perf = (perf_by_window.get((eff_start, eff_end)) or {}).get(d_name) or {}

        mapped_data = perf.get("data", [])
        uptime = float(perf.get("uptime") or 0.0)
        error_margin = _lowcost_error_margin(mapped_data) if (dev and dev.category != "bam") else 0.0
        averages = perf.get("averages", {})
        data_completeness = float(perf.get("data_completeness") or uptime)

        entry: Dict[str, Any] = {
            "device_id": lnk.device_id,
            "device_name": d_name,
            "firmware_version": lnk.firmware_version,
            "category": dev.category if dev else None,
            "network_id": dev.network_id if dev else None,
            "start_date": _iso(lnk.start_date),
            "end_date": _iso(lnk.end_date),
            "uptime": round(uptime, 4),
            "data_completeness": round(data_completeness, 4),
            "error_margin": round(error_margin, 4),
            "averages": averages,
            "data": mapped_data,
        }
        devices_out.append(entry)

    return {
        "id": str(batch.id),
        "name": batch.name,
        "start_date": _iso(batch.start_date),
        "end_date": _iso(batch.end_date),
        "device_count": len(devices_out),
        "devices": devices_out,
        "created_at": _iso(batch.created_at),
    }


def update_batch(
    db: Session, batch_id: str,
    name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}

    if name and name != batch.name:
        dup = (
            db.query(SyncInlabBatch)
            .filter(
                SyncInlabBatch.name == name,
                SyncInlabBatch.is_deleted.is_(False),
                SyncInlabBatch.id != batch.id,
            )
            .first()
        )
        if dup:
            return {"success": False, "message": f"A batch named '{name}' already exists"}
        batch.name = name

    if start_date is not None:
        batch.start_date = _parse_dt(start_date) if start_date else None
    if end_date is not None:
        batch.end_date = _parse_dt(end_date) if end_date else None

    db.commit()
    db.refresh(batch)
    return {
        "success": True,
        "message": "Batch updated successfully",
        "batch": _batch_summary(db, batch),
    }


def delete_batch(db: Session, batch_id: str) -> Dict[str, Any]:
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}
    batch.is_deleted = True
    # Soft-deleting a batch must also release its devices; otherwise the
    # partial unique index on sync_inlab_batch_device(device_id)
    # WHERE is_removed = false would block re-linking those devices.
    (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .update({SyncInlabBatchDevice.is_removed: True}, synchronize_session=False)
    )
    db.commit()
    return {"success": True, "message": f"Batch '{batch.name}' deleted"}


def add_devices_to_batch(
    db: Session, batch_id: str, device_ids: List[str],
) -> Dict[str, Any]:
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}

    added: List[str] = []
    skipped: List[str] = []
    already_in_batch: List[str] = []

    for did in device_ids:
        # Check if already in this batch (not removed)
        existing_in_batch = (
            db.query(SyncInlabBatchDevice)
            .filter(
                SyncInlabBatchDevice.batch_id == batch.id,
                SyncInlabBatchDevice.device_id == did,
                SyncInlabBatchDevice.is_removed.is_(False),
            )
            .first()
        )
        if existing_in_batch:
            already_in_batch.append(did)
            continue

        conflict = _active_batch_for_device(db, did, exclude_batch_id=batch.id)
        if conflict:
            skipped.append(did)
            continue

        # Re-activate a previously removed link, or create new. Both paths
        # are protected by the partial unique index on (device_id) WHERE
        # is_removed = false; we use a SAVEPOINT so a concurrent winner
        # raising IntegrityError doesn't poison the outer transaction.
        removed = (
            db.query(SyncInlabBatchDevice)
            .filter(
                SyncInlabBatchDevice.batch_id == batch.id,
                SyncInlabBatchDevice.device_id == did,
                SyncInlabBatchDevice.is_removed.is_(True),
            )
            .first()
        )
        try:
            with db.begin_nested():
                if removed:
                    removed.is_removed = False
                    removed.firmware_version = _snapshot_firmware(db, did)
                else:
                    link = SyncInlabBatchDevice(
                        batch_id=batch.id,
                        device_id=did,
                        firmware_version=_snapshot_firmware(db, did),
                    )
                    db.add(link)
                db.flush()
            added.append(did)
        except IntegrityError:
            logger.info(
                "Device %s already linked to an active batch; skipping insert.",
                did,
            )
            skipped.append(did)

    db.commit()
    msg = f"Added {len(added)} device(s)"
    if skipped:
        msg += f", {len(skipped)} skipped (in another batch)"
    if already_in_batch:
        msg += f", {len(already_in_batch)} already in this batch"

    return {"success": True, "message": msg, "batch": _batch_summary(db, batch)}


def remove_device_from_batch(
    db: Session, batch_id: str, device_id: str,
) -> Dict[str, Any]:
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}

    link = (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.device_id == device_id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .first()
    )
    if not link:
        return {"success": False, "message": "Device not found in this batch"}

    link.is_removed = True
    db.commit()
    return {"success": True, "message": f"Device {device_id} removed from batch"}


def update_batch_device(
    db: Session, batch_id: str, device_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> Dict[str, Any]:
    batch = _load_batch(db, batch_id)
    if not batch:
        return {"success": False, "message": "Batch not found"}

    link = (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.device_id == device_id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .first()
    )
    if not link:
        return {"success": False, "message": "Device not found in this batch"}

    if start_date is not None:
        link.start_date = _parse_dt(start_date) if start_date else None
    if end_date is not None:
        link.end_date = _parse_dt(end_date) if end_date else None

    db.commit()
    return {
        "success": True,
        "message": "Device date overrides updated",
        "device": {
            "device_id": link.device_id,
            "start_date": _iso(link.start_date),
            "end_date": _iso(link.end_date),
        },
    }


# ── Internal helpers ───────────────────────────────────────────────

def _load_batch(db: Session, batch_id: str) -> Optional[SyncInlabBatch]:
    """Load a non-deleted batch by UUID string."""
    try:
        uid = UUID(batch_id)
    except (ValueError, AttributeError):
        return None
    return (
        db.query(SyncInlabBatch)
        .filter(SyncInlabBatch.id == uid, SyncInlabBatch.is_deleted.is_(False))
        .first()
    )


def _batch_summary(db: Session, batch: SyncInlabBatch) -> Dict[str, Any]:
    """Lightweight batch dict with device count (for list views)."""
    device_count = (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .count()
    )
    # Load device details for the summary
    links = (
        db.query(SyncInlabBatchDevice)
        .filter(
            SyncInlabBatchDevice.batch_id == batch.id,
            SyncInlabBatchDevice.is_removed.is_(False),
        )
        .all()
    )
    device_ids = [lnk.device_id for lnk in links]
    info_map = _device_info_map(db, device_ids)

    devices = []
    for lnk in links:
        dev = info_map.get(lnk.device_id)
        devices.append({
            "device_id": lnk.device_id,
            "device_name": dev.device_name if dev else None,
            "firmware_version": lnk.firmware_version,
            "category": dev.category if dev else None,
            "network_id": dev.network_id if dev else None,
            "start_date": _iso(lnk.start_date),
            "end_date": _iso(lnk.end_date),
        })

    return {
        "id": str(batch.id),
        "name": batch.name,
        "start_date": _iso(batch.start_date),
        "end_date": _iso(batch.end_date),
        "device_count": device_count,
        "devices": devices,
        "created_at": _iso(batch.created_at),
    }
