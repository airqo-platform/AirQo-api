from flask import request, jsonify, Response
from typing import Any, Dict, List
from datetime import datetime
import numpy as np

from api.utils.pollutants.report import (
    fetch_air_quality_data,
    query_bigquery,
    results_to_dataframe,
    PManalysis,
)

import logging

logging.basicConfig(filename="report_log.log", level=logging.INFO, filemode="w")


def air_quality_data() -> Response:
    """
    Fetch and process air quality data for a specified grid and time range.

    This function:
    1. Parses input JSON for grid_id, start_time, and end_time.
    2. Validates the time range (must not exceed 12 months and start != end).
    3. Fetches air quality site IDs for the given grid and timeframe.
    4. Queries BigQuery for PM2.5 data for the selected sites.
    5. Processes the results into various aggregated forms (daily, monthly, yearly, etc.).
    6. Returns a structured JSON response with air quality statistics.

    **Request JSON Format**
    {
        "grid_id": "<grid_identifier>",
        "start_time": "YYYY-MM-DDTHH:MM:SS",
        "end_time": "YYYY-MM-DDTHH:MM:SS"
    }

    **Response**
    JSON containing:
        - grid metadata
        - time period
        - various aggregated PM2.5 data (daily, hourly, monthly, yearly)
        - site/city/country/region-level statistics

    Returns:
        flask.Response:
            - 200 with structured air quality data (if successful)
            - 400 for invalid time range or date format
            - 404 if no site data is available
    """
    data: Dict[str, str] = request.get_json() or {}
    grid_id: str = data.get("grid_id", "")
    start_time_str: str = data.get("start_time", "")
    end_time_str: str = data.get("end_time", "")

    # Validate and parse time range
    try:
        start_time: datetime = datetime.fromisoformat(start_time_str)
        end_time: datetime = datetime.fromisoformat(end_time_str)
        validate_dates(start_time, end_time)
    except ValueError as e:
        logging.error("Invalid date format: %s", e)
        return jsonify({"error": "Invalid date format"}), 400

    # Fetch available site IDs for the requested grid & timeframe
    site_ids: list[str] = fetch_air_quality_data(grid_id, start_time, end_time)

    if not site_ids:
        return jsonify({"message": "No site IDs found for the given parameters."}), 404

    # Query BigQuery for raw air quality measurements
    results: Any = query_bigquery(site_ids, start_time, end_time)
    if results is None:
        return jsonify({"message": "No data available for the given time frame."}), 404

    processed_data = results_to_dataframe(results)

    # ✅ Extracted helper function for all PM aggregations
    aggregated_pm: Dict[str, Any] = compute_pm_aggregates(processed_data)

    # Convert timestamps into human-readable formats
    aggregated_pm["daily_mean_pm"]["date"] = aggregated_pm["daily_mean_pm"][
        "date"
    ].dt.strftime("%Y-%m-%d")
    aggregated_pm["datetime_mean_pm"]["timestamp"] = aggregated_pm["datetime_mean_pm"][
        "timestamp"
    ].dt.strftime("%Y-%m-%d %H:%M %Z")

    logging.info("Successfully processed air quality data for grid_id %s", grid_id)

    # Build structured response
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
            **aggregated_pm["final_dict"],  # directly merge all computed aggregates
        }
    }

    # Replace NaN with None for JSON serialization
    return jsonify(replace_nan_with_null(response_data))


def air_quality_data_diurnal() -> Response:
    """
    Fetch and process **diurnal (hourly)** air quality data for a specified grid and time range.

    This function:
    1. Parses input JSON for `grid_id`, `start_time`, and `end_time`.
    2. Validates the time range:
        - Start time cannot equal end time.
        - Maximum range is 12 months.
    3. Fetches available site IDs for the grid within the specified time frame.
    4. Queries BigQuery for raw PM2.5 data for those sites.
    5. Processes the results into **hourly/diurnal PM2.5 aggregates**.
    6. Returns a structured JSON response with diurnal statistics.

    **Request JSON Example**
    ```json
    {
        "grid_id": "grid_123",
        "start_time": "2024-01-01T00:00:00",
        "end_time": "2024-02-01T00:00:00"
    }
    ```

    **Response Example**
    ```json
    {
        "airquality": {
            "status": "success",
            "grid_id": "grid_123",
            "sites": {
                "site_ids": ["site1", "site2"],
                "number_of_sites": 2,
                "grid name": "Example Grid"
            },
            "period": {
                "startTime": "2024-01-01T00:00:00",
                "endTime": "2024-02-01T00:00:00"
            },
            "diurnal": [... hourly mean PM2.5 data ...],
            "mean_pm_by_day_hour": [... day-hour aggregated PM2.5 data ...]
        }
    }
    ```

    Returns:
        Response:
            - `200 OK` with JSON data containing diurnal PM2.5 statistics.
            - `400 Bad Request` if the date format is invalid or the time range is invalid.
            - `404 Not Found` if no site IDs or no data is available for the given parameters.
    """
    # ✅ Parse incoming JSON request safely
    data: Dict[str, str] = request.get_json() or {}
    grid_id: str = data.get("grid_id", "")
    start_time_str: str = data.get("start_time", "")
    end_time_str: str = data.get("end_time", "")

    # ✅ Validate and parse time range
    try:
        start_time: datetime = datetime.fromisoformat(start_time_str)
        end_time: datetime = datetime.fromisoformat(end_time_str)
        validate_dates(start_time, end_time)

    except ValueError as e:
        logging.error("Invalid date format: %s", e)
        return jsonify({"error": "Invalid date format"}), 400

    # ✅ Fetch available site IDs for the requested grid & timeframe
    site_ids: List[str] = fetch_air_quality_data(grid_id, start_time, end_time)

    if not site_ids:
        return jsonify({"message": "No site IDs found for the given parameters."}), 404

    # ✅ Query BigQuery for raw air quality measurements
    results: Any = query_bigquery(site_ids, start_time, end_time)
    if results is None:
        return jsonify({"message": "No data available for the given time frame."}), 404

    processed_data = results_to_dataframe(results)
    computed_data = compute_pm_aggregates_diurnal(
        processed_data, start_time, end_time, grid_id, site_ids
    )
    response_data = replace_nan_with_null(computed_data)
    return jsonify(response_data)


def compute_pm_aggregates(processed_data: Any) -> Dict[str, Any]:
    """
    Compute various PM2.5 aggregations for a given dataframe.

    Args:
        processed_data: DataFrame containing air quality readings.

    Returns:
        dict: A dictionary of all computed PM2.5 statistics, including daily, monthly, yearly, site-level, city-level, and region-level data.
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
    processed_data: Any, start_time: datetime, end_time: datetime, grid_id, site_ids
) -> Dict[str, Any]:
    daily_mean_pm2_5 = PManalysis.mean_daily_pm2_5(processed_data)
    datetime_mean_pm2_5 = PManalysis.datetime_pm2_5(processed_data)
    hour_mean_pm2_5 = PManalysis.mean_pm2_5_by_hour(processed_data)
    mean_pm_by_day_hour = PManalysis.pm_day_hour_name(processed_data)
    grid_name: str = PManalysis.gridname(processed_data)

    # ✅ Convert timestamps into human-readable formats
    daily_mean_pm2_5["date"] = daily_mean_pm2_5["date"].dt.strftime("%Y-%m-%d")
    datetime_mean_pm2_5["timestamp"] = datetime_mean_pm2_5["timestamp"].dt.strftime(
        "%Y-%m-%d %H:%M %Z"
    )

    logging.info(
        "Successfully processed diurnal air quality data for grid_id %s", grid_id
    )

    # ✅ Prepare the JSON response
    response_data: Dict[str, Any] = {
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
    return response_data


def replace_nan_with_null(obj: Any) -> Any:
    """
    Recursively replace NaN values with None for JSON serialization.

    Args:
        obj: A nested list, dict, or primitive type.

    Returns:
        A structure with NaN replaced by None.
    """
    if isinstance(obj, list):
        return [replace_nan_with_null(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: replace_nan_with_null(value) for key, value in obj.items()}
    elif isinstance(obj, float) and np.isnan(obj):
        return None
    return obj


def validate_dates(start: datetime, end: datetime) -> None:
    """
    Validate a start and end datetime for an API request.

    Rules:
    - Start time cannot equal end time.
    - The date range must not exceed 12 months (365 days).

    Args:
        start (datetime): The start time.
        end (datetime): The end time.

    Returns:
        Tuple[bool, Union[None, Response]]:
            - (True, None) if the date range is valid.
            - (False, Response) if invalid, with a Flask JSON error response.

    Example:
        >>> valid, error = validate_dates(dt1, dt2)
        >>> if not valid:
        >>>     return error
    """
    if start == end:
        raise ValueError("error: Start time and end time cannot be the same.")

    if (end - start).days > 365:
        raise ValueError("error Time range exceeded 12 months")
