"""
Networks ("sensor manufacturers") sync and listing.

The platform keeps one ``network`` record per manufacturer / data provider
(airqo, airgradient, iqair, metone, clarity, airbeam ...). Vertex shows this
list as "Sensor Manufacturers". Beacon mirrors it into ``sync_network`` so the
device list can be filtered and summarised per manufacturer.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.device_data import SyncRawDeviceData
from app.models.sync import SyncDevice, SyncNetwork
from app.utils.networks import (
    DATA_SOURCE_EXTERNAL_API,
    DATA_SOURCE_THINGSPEAK,
    device_data_source,
    is_network_enabled,
    normalize_network,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sync from the platform
# ---------------------------------------------------------------------------

def _parse_platform_datetime(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _same_value(current: Any, new: Any) -> bool:
    """Equality that treats a naive stored datetime as UTC (SQLite drops tzinfo)."""
    if isinstance(current, datetime) and isinstance(new, datetime):
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        if new.tzinfo is None:
            new = new.replace(tzinfo=timezone.utc)
    return current == new


def _network_values(net: Dict[str, Any]) -> Dict[str, Any]:
    """Map a platform network payload to SyncNetwork column values."""
    return {
        "name": normalize_network(net.get("net_name") or net.get("name")),
        "acronym": net.get("net_acronym"),
        "status": net.get("net_status"),
        "category": net.get("net_category"),
        "data_source": net.get("net_data_source"),
        "website": net.get("net_website"),
        "email": net.get("net_email"),
        "description": net.get("net_description"),
        "profile_picture": net.get("net_profile_picture"),
        "platform_updated_at": _parse_platform_datetime(net.get("updatedAt")),
    }


def upsert_network_to_sync(db: Session, net: Dict[str, Any]) -> tuple:
    """Upsert one platform network. Returns (row, is_new, is_updated)."""
    network_id = net.get("_id")
    values = _network_values(net)
    if not network_id or not values["name"]:
        return None, False, False

    row = db.query(SyncNetwork).filter(SyncNetwork.network_id == network_id).first()
    if row is None:
        # The platform's legacy ``name`` is unique too; reuse a row created
        # under the same name so we never violate the unique index.
        row = db.query(SyncNetwork).filter(SyncNetwork.name == values["name"]).first()

    if row is None:
        row = SyncNetwork(network_id=network_id, **values)
        db.add(row)
        return row, True, False

    updated = False
    if row.network_id != network_id:
        row.network_id = network_id
        updated = True
    for field, new_val in values.items():
        if not _same_value(getattr(row, field), new_val):
            setattr(row, field, new_val)
            updated = True
    if updated:
        db.add(row)
    return row, False, updated


async def sync_networks(db: Session, token: str) -> Dict[str, Any]:
    """Pull every network from ``GET /devices/networks`` and mirror it locally."""
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/networks"

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
    except Exception as e:
        logger.exception(f"Unexpected error fetching networks for sync: {e}")
        return {"success": False, "message": f"Network or parsing error: {e}", "status_code": 500}

    if response.status_code != 200:
        logger.error(f"Platform API error during network sync: {response.status_code}")
        return {
            "success": False,
            "message": f"Platform API error: {response.status_code}",
            "status_code": response.status_code,
        }

    try:
        networks = response.json().get("networks", []) or []
    except Exception as e:
        logger.error(f"Failed to parse platform networks response: {e}")
        return {"success": False, "message": "Failed to parse platform API response", "status_code": 502}

    new_count = 0
    updates_count = 0
    for net in networks:
        try:
            _, is_new, is_updated = upsert_network_to_sync(db, net)
            if is_new:
                new_count += 1
            elif is_updated:
                updates_count += 1
        except Exception as e:
            logger.exception(f"Error syncing network {net.get('_id')}: {e}")
            db.rollback()
    db.commit()

    return {
        "success": True,
        "message": f"Successfully synced networks. {updates_count} updated, {new_count} new networks added.",
        "updates_count": updates_count,
        "new_count": new_count,
    }


# ---------------------------------------------------------------------------
# Listing with per-network device counts
# ---------------------------------------------------------------------------

def _device_counts_by_network(db: Session) -> Dict[str, Dict[str, int]]:
    """
    Per network (lower-cased) counts of mirrored devices: total, deployed,
    online, and how many have a readable data source.
    """
    from app.services.device_service import online_threshold_utc  # noqa: WPS433

    counts: Dict[str, Dict[str, int]] = {}

    def bucket(name: Optional[str]) -> Dict[str, int]:
        key = normalize_network(name) or ""
        return counts.setdefault(key, {
            "total_devices": 0,
            "deployed_devices": 0,
            "online_devices": 0,
            "thingspeak_devices": 0,
            "external_api_devices": 0,
        })

    for dev in db.query(SyncDevice).all():
        b = bucket(dev.network_id)
        b["total_devices"] += 1
        if (dev.status or "").lower() == "deployed":
            b["deployed_devices"] += 1
        source = device_data_source(
            dev.network_id, dev.device_number, dev.readKey, dev.serial_number, dev.api_code,
        )
        if source == DATA_SOURCE_THINGSPEAK:
            b["thingspeak_devices"] += 1
        elif source == DATA_SOURCE_EXTERNAL_API:
            b["external_api_devices"] += 1

    latest_seen = (
        db.query(
            SyncRawDeviceData.device_id.label("device_id"),
            func.max(SyncRawDeviceData.created_at_ts).label("last_seen_at"),
        )
        .group_by(SyncRawDeviceData.device_id)
        .subquery()
    )
    online_rows = (
        db.query(SyncDevice.network_id, func.count(func.distinct(SyncDevice.device_id)))
        .join(latest_seen, SyncDevice.device_id == latest_seen.c.device_id)
        .filter(func.lower(SyncDevice.status) == "deployed")
        .filter(latest_seen.c.last_seen_at >= online_threshold_utc())
        .group_by(SyncDevice.network_id)
        .all()
    )
    for network_id, online in online_rows:
        bucket(network_id)["online_devices"] = int(online or 0)

    return counts


def _serialize_network(row: Optional[SyncNetwork], name: str, counts: Dict[str, int]) -> Dict[str, Any]:
    base: Dict[str, Any] = {
        "network_id": row.network_id if row else None,
        "name": name,
        "acronym": row.acronym if row else None,
        "status": row.status if row else None,
        "category": row.category if row else None,
        "data_source": row.data_source if row else None,
        "website": row.website if row else None,
        "email": row.email if row else None,
        "description": row.description if row else None,
        "profile_picture": row.profile_picture if row else None,
        "platform_updated_at": row.platform_updated_at if row else None,
        "enabled": is_network_enabled(name),
    }
    base.update(counts)
    return base


def list_networks(db: Session, include_counts: bool = True) -> Dict[str, Any]:
    """
    Networks known to beacon: every synced ``sync_network`` row plus any
    network name that appears on a mirrored device but has not been synced
    yet (so counts never hide devices).
    """
    rows = {r.name: r for r in db.query(SyncNetwork).order_by(SyncNetwork.name).all()}
    counts = _device_counts_by_network(db) if include_counts else {}

    names = set(rows.keys()) | {n for n in counts.keys() if n}
    empty_counts = {
        "total_devices": 0, "deployed_devices": 0, "online_devices": 0,
        "thingspeak_devices": 0, "external_api_devices": 0,
    }
    networks: List[Dict[str, Any]] = [
        _serialize_network(rows.get(name), name, counts.get(name, empty_counts))
        for name in sorted(names)
    ]
    return {
        "success": True,
        "message": "Networks fetched successfully",
        "total": len(networks),
        "networks": networks,
    }
