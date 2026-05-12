"""Shared group→cohort ID resolution used by all group-filtered endpoints."""

import logging
from typing import List

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.sync import SyncGroup, SyncGroupCohort

logger = logging.getLogger(__name__)

# These group titles grant unrestricted access to all data.
SUPERGROUP_TITLES = {"airqo_group", "airqo"}


def resolve_group_cohort_ids(db: Session, group_titles_csv: str):
    """Resolve a comma-separated list of group titles to their cohort IDs.

    Returns ``None`` when a supergroup title (``airqo_group`` or ``airqo``) is
    present — callers treat ``None`` as "no restriction".

    Raises:
        HTTPException 404  if none of the group titles are found.
        HTTPException 400  if the resolved groups have zero cohorts.
    """
    titles = [t.strip() for t in group_titles_csv.split(",") if t.strip()]
    if not titles:
        raise HTTPException(status_code=400, detail="group parameter must not be empty")

    # Supergroup: unrestricted access
    if SUPERGROUP_TITLES & set(titles):
        return None

    groups = (
        db.query(SyncGroup)
        .filter(SyncGroup.grp_title.in_(titles))
        .all()
    )

    if not groups:
        raise HTTPException(
            status_code=404,
            detail=f"Group(s) not found: {', '.join(titles)}",
        )

    group_ids = [g.group_id for g in groups]

    junctions = (
        db.query(SyncGroupCohort.cohort_id)
        .filter(SyncGroupCohort.group_id.in_(group_ids))
        .distinct()
        .all()
    )

    cohort_ids = [j.cohort_id for j in junctions]

    if not cohort_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Group(s) '{group_titles_csv}' have no associated cohorts. Sync groups first.",
        )

    return cohort_ids


def resolve_group_device_ids(db: Session, cohort_ids):
    """Given cohort IDs, return all device IDs from the cohort-device junction.

    Returns ``None`` when ``cohort_ids`` is ``None`` (supergroup bypass).
    """
    if cohort_ids is None:
        return None

    from app.models.sync import SyncCohortDevice

    if not cohort_ids:
        return []

    junctions = (
        db.query(SyncCohortDevice.device_id)
        .filter(SyncCohortDevice.cohort_id.in_(cohort_ids))
        .distinct()
        .all()
    )

    return [j.device_id for j in junctions]
