"""
Grid and cohort air-quality report processing.

Grids and cohorts share one pipeline; only membership resolution and the
measurement filter column differ (see ``_ENTITY_KINDS``).

Pipeline (both entity kinds):
1. Resolve the entity to its members from BigQuery metadata — a grid to its
   site IDs via grids_sites, a cohort to its device IDs via cohorts_devices
   (``fetch_grid_sites`` / ``fetch_cohort_devices``, api/utils/pollutants/report.py).
2. Query hourly consolidated PM data for those members from BigQuery
   (``query_bigquery``, parameterized).
3. Enrich into a DataFrame with date/hour/month breakdown columns
   (``results_to_dataframe``).
4. Aggregate with ``PManalysis`` and shape the response dict.

Everything here is blocking I/O + pandas; callers on the event loop must run
these via ``asyncio.to_thread`` (AirQualityReportService does).

An entity that cannot be resolved and a window that holds no data are
different outcomes and answer differently: the first is a 404, the second is a
200 carrying the standard no-data message and empty aggregates, matching how
every other endpoint answers an empty result.

Raises:
    ValueError: invalid date range (equal start/end, or span > MAX_QUERY_DAYS).
    LookupError: no members found for the entity — mapped to HTTP 404 by the
        service layer.
    QueryTooLarge: window too wide to scan within the byte ceiling — mapped to
        HTTP 400 by the service layer.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

from config import settings
from api.utils.messages import no_data_message
from api.utils.pollutants.report import (
    PManalysis,
    fetch_cohort_devices,
    fetch_grid_sites,
    query_bigquery,
    results_to_dataframe,
)

import logging

logger = logging.getLogger(__name__)


def validate_dates(start: datetime, end: datetime) -> None:
    """
    Validate a reporting window.

    Rules:
    - Start time cannot equal end time.
    - The range must not exceed MAX_QUERY_DAYS, the same ceiling the download
      and chart paths enforce. The original contract hardcoded 12 months.

    Raises:
        ValueError: When either rule is violated.
    """
    if start == end:
        raise ValueError("Start time and end time cannot be the same.")
    max_days = settings.max_query_days
    if (end - start).days > max_days:
        raise ValueError(f"Time range must not exceed {max_days} days.")


# Each entity kind differs only in how membership resolves and which column
# the measurement query filters on; everything downstream is shared.
#   id_column    -> the consolidated column those members match
#   members_key  -> response key holding them ("sites" / "devices")
#   member_ids_key / count_key -> the nested keys inside it
_ENTITY_KINDS = {
    "grid": {
        "id_column": "site_id",
        "id_key": "grid_id",
        "members_key": "sites",
        "member_ids_key": "site_ids",
        "count_key": "number_of_sites",
        "name_key": "grid name",
        "missing": "No site IDs found for the given parameters.",
    },
    "cohort": {
        "id_column": "device_id",
        "id_key": "cohort_id",
        "members_key": "devices",
        "member_ids_key": "device_ids",
        "count_key": "number_of_devices",
        "name_key": "cohort name",
        "missing": "No device IDs found for the given parameters.",
    },
}


def _resolve_members(kind: str, entity_id: str) -> List[str]:
    """
    Membership lookup for one entity kind, or LookupError when empty.

    Dispatched by name rather than held in _ENTITY_KINDS: a function object
    stored in that dict would bind at import time, so the resolver could never
    be substituted afterwards.
    """
    if kind == "grid":
        members: List[str] = fetch_grid_sites(entity_id)
    else:
        members = fetch_cohort_devices(entity_id)
    if not members:
        raise LookupError(_ENTITY_KINDS[kind]["missing"])
    return members


def _members_block(kind: str, members: List[str], name: Any) -> Dict[str, Any]:
    """The `sites`/`devices` block of the response for one entity kind."""
    spec = _ENTITY_KINDS[kind]
    return {
        spec["members_key"]: {
            spec["member_ids_key"]: members,
            spec["count_key"]: len(members),
            spec["name_key"]: name,
        }
    }


# Every aggregate key the report emits. A no-data window returns all of them as
# empty lists rather than omitting them, so a client can iterate any aggregate
# without first checking the key exists. Kept in step with compute_pm_aggregates
# by test_no_data_report_carries_every_aggregate_key.
_AGGREGATE_KEYS = (
    "daily_mean_pm",
    "datetime_mean_pm",
    "diurnal",
    "annual_pm",
    "monthly_pm",
    "pm_by_month_year",
    "pm_by_month_name",
    "site_monthly_mean_pm",
    "site_annual_mean_pm",
    "site_mean_pm",
    "mean_pm_by_city",
    "mean_pm_by_country",
    "mean_pm_by_region",
    "mean_pm_by_day_of_week",
    "mean_pm_by_day_hour",
)


def _report_envelope(
    kind: str,
    entity_id: str,
    members: List[str],
    name: Any,
    start_time: datetime,
    end_time: datetime,
    aggregates: Dict[str, Any],
    message: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Assemble the response body shared by the populated and no-data cases.

    Both carry the same keys, so a client parses one shape either way; only
    `message` and the contents of the aggregates differ.
    """
    spec = _ENTITY_KINDS[kind]
    airquality: Dict[str, Any] = {"status": "success"}
    if message:
        airquality["message"] = message
    airquality.update(
        {
            spec["id_key"]: entity_id,
            **_members_block(kind, members, name),
            "period": {
                "startTime": start_time.isoformat(),
                "endTime": end_time.isoformat(),
            },
            **aggregates,
        }
    )
    return {"airquality": airquality}


def build_entity_report(
    kind: str, entity_id: str, start_time: datetime, end_time: datetime
) -> Dict[str, Any]:
    """
    Build the full air-quality report for a grid or cohort.

    Args:
        kind: "grid" or "cohort".
        entity_id: The grid or cohort identifier.
        start_time: Start of the reporting window.
        end_time: End of the reporting window.

    Returns:
        The ``{"airquality": {...}}`` response dict with daily/monthly/annual,
        site/city/country/region-level PM aggregates (NaN already nullified).
        A window holding no measurements returns the same shape with every
        aggregate empty and a ``message`` naming the period.

    Raises:
        ValueError: Invalid date range.
        LookupError: No members for the entity.
        QueryTooLarge: Window too wide to scan within the byte ceiling.
    """
    validate_dates(start_time, end_time)
    spec = _ENTITY_KINDS[kind]

    members = _resolve_members(kind, entity_id)

    results = query_bigquery(members, start_time, end_time, id_column=spec["id_column"])
    if results is None:
        # The entity resolved and the query ran; the period simply holds no
        # measurements. That is a valid request with an empty answer, so it
        # returns a success body rather than the 404 an unresolvable entity
        # gets.
        logger.info("No air quality data for %s %s in the window", kind, entity_id)
        return _report_envelope(
            kind,
            entity_id,
            members,
            [],
            start_time,
            end_time,
            {key: [] for key in _AGGREGATE_KEYS},
            message=no_data_message(start_time, end_time, f"{kind} {entity_id}"),
        )

    processed_data = results_to_dataframe(results)
    aggregated_pm = compute_pm_aggregates(processed_data)

    # Convert timestamps into human-readable formats
    aggregated_pm["daily_mean_pm"]["date"] = aggregated_pm["daily_mean_pm"][
        "date"
    ].dt.strftime("%Y-%m-%d")
    aggregated_pm["datetime_mean_pm"]["timestamp"] = aggregated_pm["datetime_mean_pm"][
        "timestamp"
    ].dt.strftime("%Y-%m-%d %H:%M %Z")

    logger.info("Successfully processed air quality data for %s %s", kind, entity_id)

    return replace_nan_with_null(
        _report_envelope(
            kind,
            entity_id,
            members,
            aggregated_pm["grid_name"],
            start_time,
            end_time,
            aggregated_pm["final_dict"],
        )
    )


def compute_pm_aggregates(processed_data: Any) -> Dict[str, Any]:
    """
    Compute the full set of PM2.5/PM10 aggregations for the standard report.

    Args:
        processed_data: DataFrame from ``results_to_dataframe``.

    Returns:
        dict with the two frames needing timestamp formatting
        (``daily_mean_pm``, ``datetime_mean_pm``), the grid name, and
        ``final_dict`` holding every aggregate as JSON-ready records.
    """
    daily_mean_pm2_5 = PManalysis.mean_daily_pm2_5(processed_data)
    datetime_mean_pm2_5 = PManalysis.datetime_pm2_5(processed_data)
    site_mean_pm2_5 = PManalysis.mean_pm2_5_by_site_name(processed_data)
    hour_mean_pm2_5 = PManalysis.mean_pm2_5_by_hour(processed_data)
    pm2_5_by_month = PManalysis.mean_pm2_5_by_month(processed_data)
    pm2_5_by_month_name = PManalysis.mean_pm2_5_by_month_name(processed_data)
    pm2_5_by_month_year = PManalysis.mean_pm2_5_by_month_year(processed_data)
    monthly_mean_pm_by_site_name = PManalysis.monthly_mean_pm_site_name(processed_data)
    mean_pm2_5_year = PManalysis.mean_pm2_5_by_year(processed_data)
    mean_pm_by_city = PManalysis.pm_by_city(processed_data)
    mean_pm_by_country = PManalysis.pm_by_country(processed_data)
    mean_pm_by_region = PManalysis.pm_by_region(processed_data)
    mean_pm_by_day_of_week = PManalysis.pm_day_name(processed_data)
    mean_pm_by_day_hour = PManalysis.pm_day_hour_name(processed_data)
    mean_pm_by_site_year = PManalysis.annual_mean_pm_site_name(processed_data)
    grid_name = PManalysis.gridname(processed_data)

    return {
        "daily_mean_pm": daily_mean_pm2_5,
        "datetime_mean_pm": datetime_mean_pm2_5,
        "grid_name": grid_name,
        "final_dict": {
            "daily_mean_pm": daily_mean_pm2_5.to_dict(orient="records"),
            "datetime_mean_pm": datetime_mean_pm2_5.to_dict(orient="records"),
            "diurnal": hour_mean_pm2_5.to_dict(orient="records"),
            "annual_pm": mean_pm2_5_year.to_dict(orient="records"),
            "monthly_pm": pm2_5_by_month.to_dict(orient="records"),
            "pm_by_month_year": pm2_5_by_month_year.to_dict(orient="records"),
            "pm_by_month_name": pm2_5_by_month_name.to_dict(orient="records"),
            "site_monthly_mean_pm": monthly_mean_pm_by_site_name.to_dict(
                orient="records"
            ),
            "site_annual_mean_pm": mean_pm_by_site_year.to_dict(orient="records"),
            "site_mean_pm": site_mean_pm2_5.to_dict(orient="records"),
            "mean_pm_by_city": mean_pm_by_city.to_dict(orient="records"),
            "mean_pm_by_country": mean_pm_by_country.to_dict(orient="records"),
            "mean_pm_by_region": mean_pm_by_region.to_dict(orient="records"),
            "mean_pm_by_day_of_week": mean_pm_by_day_of_week.to_dict(orient="records"),
            "mean_pm_by_day_hour": mean_pm_by_day_hour.to_dict(orient="records"),
        },
    }


def replace_nan_with_null(obj: Any) -> Any:
    """
    Recursively replace NaN values with None for JSON serialization.

    Args:
        obj: A nested list, dict, or primitive.

    Returns:
        The same structure with every NaN replaced by None.
    """
    if isinstance(obj, list):
        return [replace_nan_with_null(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: replace_nan_with_null(value) for key, value in obj.items()}
    elif isinstance(obj, float) and np.isnan(obj):
        return None
    return obj
