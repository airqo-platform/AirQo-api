"""
Grid air-quality report processing.

Framework-free port of the Flask grid-report feature (outer analytics
``/api/v2/analytics/grid/report`` and ``/grid/report/diurnal``): every function
here takes plain arguments and returns dicts / raises exceptions — no Flask
``request``/``jsonify``. HTTP concerns (status codes, request parsing) live in
``GridReportService`` (api/services) and the v2 router.

Pipeline (both report variants):
1. Resolve grid_id -> site IDs from the BigQuery grids_sites table
   (``fetch_grid_sites``, api/utils/pollutants/report.py).
2. Query hourly consolidated PM data for those sites from BigQuery
   (``query_bigquery``, parameterized).
3. Enrich into a DataFrame with date/hour/month breakdown columns
   (``results_to_dataframe``).
4. Aggregate with ``PManalysis`` and shape the response dict.

Everything here is blocking I/O + pandas; callers on the event loop must run
these via ``asyncio.to_thread`` (GridReportService does).

Raises:
    ValueError: invalid date range (equal start/end, or span > 12 months).
    LookupError: no sites found for the grid, or no data for the window —
        mapped to HTTP 404 by the service layer.
"""

from datetime import datetime
from typing import Any, Dict, List

import numpy as np

from api.utils.pollutants.report import (
    PManalysis,
    fetch_grid_sites,
    query_bigquery,
    results_to_dataframe,
)

import logging

logger = logging.getLogger(__name__)


def validate_dates(start: datetime, end: datetime) -> None:
    """
    Validate a reporting window.

    Rules (unchanged from the original API contract):
    - Start time cannot equal end time.
    - The range must not exceed 12 months (365 days).

    Raises:
        ValueError: When either rule is violated.
    """
    if start == end:
        raise ValueError("Start time and end time cannot be the same.")
    if (end - start).days > 365:
        raise ValueError("Time range exceeded 12 months.")


def build_grid_report(
    grid_id: str, start_time: datetime, end_time: datetime
) -> Dict[str, Any]:
    """
    Build the full grid air-quality report.

    Args:
        grid_id: The grid identifier.
        start_time: Start of the reporting window.
        end_time: End of the reporting window.

    Returns:
        The ``{"airquality": {...}}`` response dict with daily/monthly/annual,
        site/city/country/region-level PM aggregates (NaN already nullified).

    Raises:
        ValueError: Invalid date range.
        LookupError: No sites for the grid, or no data for the window.
    """
    validate_dates(start_time, end_time)

    site_ids: List[str] = fetch_grid_sites(grid_id)
    if not site_ids:
        raise LookupError("No site IDs found for the given parameters.")

    results = query_bigquery(site_ids, start_time, end_time)
    if results is None:
        raise LookupError("No data available for the given time frame.")

    processed_data = results_to_dataframe(results)
    aggregated_pm = compute_pm_aggregates(processed_data)

    # Convert timestamps into human-readable formats
    aggregated_pm["daily_mean_pm"]["date"] = aggregated_pm["daily_mean_pm"][
        "date"
    ].dt.strftime("%Y-%m-%d")
    aggregated_pm["datetime_mean_pm"]["timestamp"] = aggregated_pm["datetime_mean_pm"][
        "timestamp"
    ].dt.strftime("%Y-%m-%d %H:%M %Z")

    logger.info("Successfully processed air quality data for grid_id %s", grid_id)

    response_data: Dict[str, Any] = {
        "airquality": {
            "status": "success",
            "grid_id": grid_id,
            "sites": {
                "site_ids": site_ids,
                "number_of_sites": len(site_ids),
                "grid name": aggregated_pm["grid_name"],
            },
            "period": {
                "startTime": start_time.isoformat(),
                "endTime": end_time.isoformat(),
            },
            **aggregated_pm["final_dict"],
        }
    }
    return replace_nan_with_null(response_data)


def build_grid_diurnal_report(
    grid_id: str, start_time: datetime, end_time: datetime
) -> Dict[str, Any]:
    """
    Build the diurnal (hourly-pattern) grid air-quality report.

    Same pipeline as :func:`build_grid_report`, but aggregates only the
    hour-of-day and day/hour breakdowns.

    Raises:
        ValueError: Invalid date range.
        LookupError: No sites for the grid, or no data for the window.
    """
    validate_dates(start_time, end_time)

    site_ids: List[str] = fetch_grid_sites(grid_id)
    if not site_ids:
        raise LookupError("No site IDs found for the given parameters.")

    results = query_bigquery(site_ids, start_time, end_time)
    if results is None:
        raise LookupError("No data available for the given time frame.")

    processed_data = results_to_dataframe(results)
    computed_data = compute_pm_aggregates_diurnal(
        processed_data, start_time, end_time, grid_id, site_ids
    )

    logger.info(
        "Successfully processed diurnal air quality data for grid_id %s", grid_id
    )
    return replace_nan_with_null(computed_data)


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


def compute_pm_aggregates_diurnal(
    processed_data: Any,
    start_time: datetime,
    end_time: datetime,
    grid_id: str,
    site_ids: List[str],
) -> Dict[str, Any]:
    """
    Compute the diurnal aggregates and shape the diurnal response dict.

    Args:
        processed_data: DataFrame from ``results_to_dataframe``.
        start_time: Start of the reporting window (echoed in the response).
        end_time: End of the reporting window (echoed in the response).
        grid_id: Grid identifier (echoed in the response).
        site_ids: Sites included (echoed in the response).

    Returns:
        The ``{"airquality": {...}}`` diurnal response dict.
    """
    hour_mean_pm2_5 = PManalysis.mean_pm2_5_by_hour(processed_data)
    mean_pm_by_day_hour = PManalysis.pm_day_hour_name(processed_data)
    grid_name = PManalysis.gridname(processed_data)

    return {
        "airquality": {
            "status": "success",
            "grid_id": grid_id,
            "sites": {
                "site_ids": site_ids,
                "number_of_sites": len(site_ids),
                "grid name": grid_name,
            },
            "period": {
                "startTime": start_time.isoformat(),
                "endTime": end_time.isoformat(),
            },
            "diurnal": hour_mean_pm2_5.to_dict(orient="records"),
            "mean_pm_by_day_hour": mean_pm_by_day_hour.to_dict(orient="records"),
        }
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
