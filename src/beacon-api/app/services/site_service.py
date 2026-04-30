import httpx
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sync import SyncSite, SyncSiteDevice, SyncDevice
from app.services.device_service import upsert_device_to_sync

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Sync: Platform → Local DB
# ---------------------------------------------------------------------------

async def sync_sites(db: Session, token: str) -> Dict[str, Any]:
    """
    Fetch all sites from the platform API sequentially (page by page),
    upsert into sync_site, and rebuild the sync_site_device junction.

    Embedded devices are backfilled into sync_device non-authoritatively.
    """
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/devices/sites"

    all_sites: List[Dict[str, Any]] = []
    page = 1
    limit = 100

    # --- 1. Fetch all pages sequentially ---
    actual_limit = limit  # Will be overridden by platform's actual limit after first response
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        while True:
            params = {"limit": limit, "skip": (page - 1) * actual_limit}
            logger.info(f"[Site Sync] Fetching page {page} (skip={params['skip']})...")

            try:
                response = await client.get(url, headers=headers, params=params)
                if response.status_code != 200:
                    logger.error(f"[Site Sync] Platform API error on page {page}: {response.status_code}")
                    break

                data = response.json()
                sites_page = data.get("sites", [])
                all_sites.extend(sites_page)

                meta = data.get("meta", {})
                total_pages = meta.get("totalPages", 1)
                # Use the platform's actual limit for skip calculations
                actual_limit = meta.get("limit", limit)

                logger.info(
                    f"[Site Sync] Page {page}/{total_pages}: "
                    f"got {len(sites_page)} sites (total so far: {len(all_sites)}, "
                    f"platform limit: {actual_limit})"
                )

                if page >= total_pages:
                    break
                page += 1

            except Exception as e:
                logger.error(f"[Site Sync] Error fetching page {page}: {e}")
                break

    if not all_sites:
        return {
            "success": True,
            "message": "No sites found on platform",
            "sites_synced": 0,
            "devices_backfilled": 0,
        }

    # --- 2. Upsert sites and rebuild junction table ---
    sites_new = 0
    sites_updated = 0
    sites_unchanged = 0
    devices_backfilled = 0

    def _normalize_list(value) -> str:
        """Stable JSON serialization so string compare == semantic compare."""
        try:
            return json.dumps(value or [], sort_keys=True)
        except TypeError:
            return json.dumps([], sort_keys=True)

    # Scalar fields to diff (attr_name -> payload_key)
    scalar_fields = [
        ("name", "name"),
        ("latitude", "latitude"),
        ("longitude", "longitude"),
        ("network", "network"),
        ("country", "country"),
        ("city", "city"),
        ("county", "county"),
        ("district", "district"),
        ("region", "region"),
        ("data_provider", "data_provider"),
        ("description", "description"),
        ("generated_name", "generated_name"),
    ]

    for site_data in all_sites:
        site_id = site_data.get("_id")
        if not site_id:
            continue

        try:
            # Parse platform createdAt
            platform_created = None
            raw_created = site_data.get("createdAt")
            if raw_created:
                try:
                    platform_created = datetime.fromisoformat(raw_created.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass

            # Upsert the site record
            db_site = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
            is_new = db_site is None
            if is_new:
                db_site = SyncSite(site_id=site_id)
                db.add(db_site)

            # Diff scalar fields
            site_field_changed = False
            for attr, key in scalar_fields:
                new_val = site_data.get(key)
                if getattr(db_site, attr) != new_val:
                    setattr(db_site, attr, new_val)
                    site_field_changed = True

            new_tags = _normalize_list(site_data.get("site_tags", []))
            new_codes = _normalize_list(site_data.get("site_codes", []))
            existing_tags = _normalize_list(json.loads(db_site.site_tags)) if db_site.site_tags else _normalize_list([])
            existing_codes = _normalize_list(json.loads(db_site.site_codes)) if db_site.site_codes else _normalize_list([])
            if existing_tags != new_tags:
                db_site.site_tags = new_tags
                site_field_changed = True
            if existing_codes != new_codes:
                db_site.site_codes = new_codes
                site_field_changed = True
            if platform_created and db_site.platform_created_at != platform_created:
                db_site.platform_created_at = platform_created
                site_field_changed = True

            # --- Junction diff ---
            desired: Dict[str, bool] = {}
            for dev in site_data.get("devices", []):
                device_id = dev.get("_id")
                if not device_id:
                    continue
                desired[device_id] = bool(dev.get("isActive", False))

                # Non-authoritative backfill into sync_device
                _, dev_is_new, _ = upsert_device_to_sync(db, dev, is_authoritative=False)
                if dev_is_new:
                    devices_backfilled += 1

            existing_rows = (
                db.query(SyncSiteDevice)
                .filter(SyncSiteDevice.site_id == site_id)
                .all()
            )
            existing: Dict[str, SyncSiteDevice] = {r.device_id: r for r in existing_rows}

            junction_changed = False

            for dev_id, row in existing.items():
                if dev_id not in desired:
                    db.delete(row)
                    junction_changed = True

            for dev_id, is_active in desired.items():
                row = existing.get(dev_id)
                if row is None:
                    db.add(SyncSiteDevice(
                        site_id=site_id,
                        device_id=dev_id,
                        is_active=is_active,
                    ))
                    junction_changed = True
                elif bool(row.is_active) != is_active:
                    row.is_active = is_active
                    junction_changed = True

            if is_new:
                sites_new += 1
            elif site_field_changed or junction_changed:
                sites_updated += 1
            else:
                sites_unchanged += 1

            # Commit in batches
            if (sites_new + sites_updated) % 20 == 0:
                db.commit()

        except Exception as e:
            logger.error(f"[Site Sync] Error syncing site {site_id}: {e}")
            db.rollback()

    db.commit()

    total_synced = sites_new + sites_updated + sites_unchanged
    logger.info(
        f"[Site Sync] Done — {total_synced} sites processed "
        f"({sites_new} new, {sites_updated} updated, {sites_unchanged} unchanged), "
        f"{devices_backfilled} devices backfilled"
    )

    return {
        "success": True,
        "message": (
            f"Processed {total_synced} sites: {sites_new} new, "
            f"{sites_updated} updated, {sites_unchanged} unchanged. "
            f"{devices_backfilled} new devices backfilled."
        ),
        "sites_synced": sites_new + sites_updated,
        "sites_new": sites_new,
        "sites_updated": sites_updated,
        "sites_unchanged": sites_unchanged,
        "devices_backfilled": devices_backfilled,
    }


# ---------------------------------------------------------------------------
# Read: Local DB (source of truth)
# ---------------------------------------------------------------------------

def get_sites(
    db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None
) -> Dict[str, Any]:
    """Read sites from the local sync_site table."""
    query = db.query(SyncSite)

    if search:
        query = query.filter(SyncSite.name.ilike(f"%{search}%"))

    total = query.count()
    sites = query.order_by(SyncSite.name).offset(skip).limit(limit).all()

    result_sites = []
    for s in sites:
        # Fetch junction devices
        junctions = (
            db.query(SyncSiteDevice)
            .filter(SyncSiteDevice.site_id == s.site_id)
            .all()
        )

        devices = []
        for j in junctions:
            sync_dev = db.query(SyncDevice).filter(SyncDevice.device_id == j.device_id).first()
            devices.append({
                "device_id": j.device_id,
                "device_name": sync_dev.device_name if sync_dev else None,
                "is_active": j.is_active or False,
            })

        result_sites.append({
            "site_id": s.site_id,
            "name": s.name,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "network": s.network,
            "country": s.country,
            "city": s.city,
            "county": s.county,
            "district": s.district,
            "region": s.region,
            "data_provider": s.data_provider,
            "description": s.description,
            "generated_name": s.generated_name,
            "site_tags": json.loads(s.site_tags) if s.site_tags else [],
            "site_codes": json.loads(s.site_codes) if s.site_codes else [],
            "number_of_devices": len(devices),
            "devices": devices,
        })

    return {
        "success": True,
        "message": "Synced sites fetched successfully",
        "meta": {"total": total, "skip": skip, "limit": limit},
        "sites": result_sites,
    }


def get_site(db: Session, site_id: str) -> Dict[str, Any]:
    """Read a single site from the local sync_site table."""
    s = db.query(SyncSite).filter(SyncSite.site_id == site_id).first()
    if not s:
        return {
            "success": False,
            "message": f"Site {site_id} not found in local sync table",
            "status_code": 404,
        }

    junctions = (
        db.query(SyncSiteDevice)
        .filter(SyncSiteDevice.site_id == s.site_id)
        .all()
    )

    devices = []
    for j in junctions:
        sync_dev = db.query(SyncDevice).filter(SyncDevice.device_id == j.device_id).first()
        devices.append({
            "device_id": j.device_id,
            "device_name": sync_dev.device_name if sync_dev else None,
            "is_active": j.is_active or False,
        })

    return {
        "success": True,
        "message": "Synced site fetched successfully",
        "site": {
            "site_id": s.site_id,
            "name": s.name,
            "latitude": s.latitude,
            "longitude": s.longitude,
            "network": s.network,
            "country": s.country,
            "city": s.city,
            "county": s.county,
            "district": s.district,
            "region": s.region,
            "data_provider": s.data_provider,
            "description": s.description,
            "generated_name": s.generated_name,
            "site_tags": json.loads(s.site_tags) if s.site_tags else [],
            "site_codes": json.loads(s.site_codes) if s.site_codes else [],
            "number_of_devices": len(devices),
            "devices": devices,
        },
    }
