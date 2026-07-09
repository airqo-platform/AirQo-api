import httpx
import logging
from typing import Dict, Any, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sync import SyncGroup, SyncGroupCohort, SyncCohort

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_all_groups(token: str) -> Optional[List[Dict[str, Any]]]:
    """Fetch all groups from the platform groups/summary endpoint.

    Returns None when the request fails.
    """
    headers = {"Authorization": f"JWT {token}"}
    url = f"{settings.PLATFORM_BASE_URL}/users/groups/summary"

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        try:
            logger.info(f"[Group Sync] Fetching groups from {url}")
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                logger.error(f"[Group Sync] Platform API error: {response.status_code}")
                return None
            data = response.json()
            return data.get("groups", [])
        except Exception as e:
            logger.exception(f"[Group Sync] Error fetching groups: {e}")
            return None


def _apply_group_scalars(db_group: SyncGroup, group_data: Dict[str, Any]) -> bool:
    """Update scalar fields on a SyncGroup. Returns True if anything changed."""
    updates = [
        ("grp_title", group_data.get("grp_title"), db_group.grp_title),
        ("grp_status", group_data.get("grp_status"), db_group.grp_status),
        ("organization_slug", group_data.get("organization_slug"), db_group.organization_slug),
        ("grp_website", group_data.get("grp_website"), db_group.grp_website),
        ("grp_industry", group_data.get("grp_industry"), db_group.grp_industry),
        ("grp_country", group_data.get("grp_country"), db_group.grp_country),
        ("grp_timezone", group_data.get("grp_timezone"), db_group.grp_timezone),
        ("grp_profile_picture", group_data.get("grp_profile_picture"), db_group.grp_profile_picture),
        ("number_of_users", group_data.get("numberOfGroupUsers", 0) or 0,
         db_group.number_of_users or 0),
    ]

    changed = False
    for attr, new_val, current_val in updates:
        if current_val != new_val:
            setattr(db_group, attr, new_val)
            changed = True

    return changed


def _sync_group_cohort_junctions(
    db: Session, group_id: str, desired_cohort_ids: List[str]
) -> bool:
    """Reconcile sync_group_cohort rows against the desired set. Returns True if changed.

    Cohort IDs that don't exist in ``sync_cohort`` are silently skipped to
    avoid FK violations — the group may reference cohorts that haven't been
    synced yet.
    """
    # Only keep cohort IDs that actually exist in sync_cohort
    if desired_cohort_ids:
        existing_cohorts = {
            row[0]
            for row in db.query(SyncCohort.cohort_id)
            .filter(SyncCohort.cohort_id.in_(desired_cohort_ids))
            .all()
        }
        skipped = set(desired_cohort_ids) - existing_cohorts
        if skipped:
            logger.warning(
                f"[Group Sync] Skipping {len(skipped)} cohort(s) not in sync_cohort "
                f"for group {group_id}: {list(skipped)[:5]}..."
            )
        desired_cohort_ids = [c for c in desired_cohort_ids if c in existing_cohorts]

    existing_rows = (
        db.query(SyncGroupCohort)
        .filter(SyncGroupCohort.group_id == group_id)
        .all()
    )
    existing: Dict[str, SyncGroupCohort] = {r.cohort_id: r for r in existing_rows}
    desired_set = set(desired_cohort_ids)
    changed = False

    # Remove cohorts no longer in the group
    for cohort_id, row in existing.items():
        if cohort_id not in desired_set:
            db.delete(row)
            changed = True

    # Add new cohorts
    for cohort_id in desired_cohort_ids:
        if cohort_id not in existing:
            db.add(SyncGroupCohort(group_id=group_id, cohort_id=cohort_id))
            changed = True

    return changed


def _upsert_single_group(
    db: Session, group_data: Dict[str, Any]
) -> Optional[Tuple[str, int]]:
    """
    Upsert one group and reconcile its cohorts.

    Returns (status, 0) where status is one of
    'new' | 'updated' | 'unchanged', or None if the group had no id.
    """
    group_id = group_data.get("_id")
    if not group_id:
        return None

    db_group = db.query(SyncGroup).filter(SyncGroup.group_id == group_id).first()
    is_new = db_group is None
    if is_new:
        db_group = SyncGroup(
            group_id=group_id,
            grp_title=group_data.get("grp_title", ""),
        )
        db.add(db_group)

    group_field_changed = _apply_group_scalars(db_group, group_data)
    cohort_ids = group_data.get("cohorts") or []
    junction_changed = _sync_group_cohort_junctions(db, group_id, cohort_ids)

    if is_new:
        status = "new"
    elif group_field_changed or junction_changed:
        status = "updated"
    else:
        status = "unchanged"
    return status, 0


# ---------------------------------------------------------------------------
# Sync: Platform → Local DB
# ---------------------------------------------------------------------------

async def sync_groups(db: Session, token: str) -> Dict[str, Any]:
    """
    Fetch all groups from the platform API, upsert into sync_group,
    and rebuild the sync_group_cohort junction.
    """
    try:
        all_groups = await _fetch_all_groups(token)

        if all_groups is None:
            return {
                "success": False,
                "message": "Failed to fetch groups from platform",
                "groups_synced": 0,
            }
    except Exception as exc:
        logger.exception(f"Group sync failed: {exc}")
        return {
            "success": False,
            "message": "Group sync failed",
            "groups_synced": 0,
        }

    if not all_groups:
        return {
            "success": True,
            "message": "No groups found on platform",
            "groups_synced": 0,
        }

    counts = {"new": 0, "updated": 0, "unchanged": 0}

    for group_data in all_groups:
        try:
            result = _upsert_single_group(db, group_data)
            if result is None:
                continue
            status, _ = result
            counts[status] += 1

            # Commit in batches
            if (counts["new"] + counts["updated"]) % 20 == 0:
                db.commit()
        except Exception as e:
            logger.error(
                f"[Group Sync] Error syncing group {group_data.get('_id')}: {e}"
            )
            db.rollback()

    db.commit()

    total_synced = counts["new"] + counts["updated"] + counts["unchanged"]
    logger.info(
        f"[Group Sync] Done — {total_synced} groups processed "
        f"({counts['new']} new, {counts['updated']} updated, {counts['unchanged']} unchanged)"
    )

    return {
        "success": True,
        "message": (
            f"Processed {total_synced} groups: {counts['new']} new, "
            f"{counts['updated']} updated, {counts['unchanged']} unchanged."
        ),
        "groups_synced": counts["new"] + counts["updated"],
        "groups_new": counts["new"],
        "groups_updated": counts["updated"],
        "groups_unchanged": counts["unchanged"],
    }


# ---------------------------------------------------------------------------
# Read: Local DB (source of truth)
# ---------------------------------------------------------------------------

def _build_group_cohorts(db: Session, group_id: str) -> List[Dict[str, Any]]:
    """Return junction-derived cohort dicts for a single group."""
    junctions = (
        db.query(SyncGroupCohort)
        .filter(SyncGroupCohort.group_id == group_id)
        .all()
    )
    cohorts = []
    for j in junctions:
        sync_cohort = (
            db.query(SyncCohort).filter(SyncCohort.cohort_id == j.cohort_id).first()
        )
        cohorts.append({
            "cohort_id": j.cohort_id,
            "name": sync_cohort.name if sync_cohort else None,
        })
    return cohorts


def _serialize_group(db: Session, g: SyncGroup) -> Dict[str, Any]:
    """Serialize a SyncGroup plus its cohorts into the public dict shape."""
    cohorts = _build_group_cohorts(db, g.group_id)
    return {
        "group_id": g.group_id,
        "grp_title": g.grp_title,
        "grp_status": g.grp_status,
        "organization_slug": g.organization_slug,
        "grp_website": g.grp_website,
        "grp_industry": g.grp_industry,
        "grp_country": g.grp_country,
        "grp_timezone": g.grp_timezone,
        "grp_profile_picture": g.grp_profile_picture,
        "number_of_users": g.number_of_users or 0,
        "number_of_cohorts": len(cohorts),
        "cohorts": cohorts,
    }


def _apply_group_query_filters(
    query,
    search: Optional[str],
    group_ids: Optional[str],
    grp_status: Optional[str],
):
    """Apply optional filters to a SyncGroup query."""
    if group_ids:
        ids = [gid.strip() for gid in group_ids.split(",") if gid.strip()]
        if ids:
            query = query.filter(SyncGroup.group_id.in_(ids))

    if search:
        query = query.filter(SyncGroup.grp_title.ilike(f"%{search}%"))

    if grp_status:
        query = query.filter(SyncGroup.grp_status.ilike(grp_status))

    return query


def get_synced_groups(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    group_ids: Optional[str] = None,
    grp_status: Optional[str] = None,
) -> Dict[str, Any]:
    """Read groups from the local sync_group table."""
    safe_skip = max(skip, 0)
    safe_limit = max(limit, 1)

    query = _apply_group_query_filters(
        db.query(SyncGroup), search, group_ids, grp_status
    )

    total = query.count()
    groups = query.order_by(SyncGroup.grp_title).offset(safe_skip).limit(safe_limit).all()

    total_pages = max(1, (total + safe_limit - 1) // safe_limit)
    current_page = (safe_skip // safe_limit) + 1
    next_page = (
        f"skip={safe_skip + safe_limit}&limit={safe_limit}"
        if (safe_skip + safe_limit) < total
        else None
    )

    return {
        "success": True,
        "message": "Synced groups fetched successfully",
        "meta": {
            "total": total,
            "totalResults": total,
            "skip": safe_skip,
            "limit": safe_limit,
            "page": current_page,
            "totalPages": total_pages,
            "detailLevel": "local",
            "usedCache": False,
            "nextPage": next_page,
        },
        "groups": [_serialize_group(db, g) for g in groups],
    }


def get_synced_group(db: Session, group_id: str) -> Dict[str, Any]:
    """Read a single group from the local sync_group table."""
    g = db.query(SyncGroup).filter(SyncGroup.group_id == group_id).first()
    if not g:
        return {
            "success": False,
            "message": f"Group {group_id} not found in local sync table",
            "status_code": 404,
        }

    return {
        "success": True,
        "message": "Synced group fetched successfully",
        "group": _serialize_group(db, g),
    }
