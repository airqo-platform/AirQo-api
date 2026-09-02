import pandas as pd
from google.cloud import bigquery
from api.utils.bigquery_jobs import (
    log_cost_rejections,
    query_job_config,
    shared_bigquery_client,
)
from api.utils.exceptions import QueryTooLarge
import numpy as np
from timezonefinder import TimezoneFinder
import pytz

from api.utils.utils import Utils
from config import settings

import logging

logger = logging.getLogger(__name__)


def convert_utc_to_local(timestamps, site_latitude, site_longitude):
    tf = TimezoneFinder()
    local_times = []

    for timestamp, latitude, longitude in zip(
        timestamps, site_latitude, site_longitude
    ):
        timezone_str = tf.timezone_at(lat=latitude, lng=longitude)
        timezone = pytz.timezone(timezone_str)
        local_time = timestamp.astimezone(timezone)
        local_times.append(local_time)

    return local_times


def fetch_grid_sites(grid_id) -> list:
    """
    Resolves a grid ID to its site IDs from the BigQuery grids_sites table.

    Replaces the external Grid API round trip — grid membership already lands
    in BigQuery via the metadata sync, and this is the same table the download
    path's grid_ids filter joins against.

    Args:
        grid_id(str): The grid identifier.

    Returns:
        list: Site IDs belonging to the grid; empty on query failure.
    """
    grids_sites_table = Utils.table_name(settings.bigquery_grids_sites)
    query = f"SELECT DISTINCT site_id FROM {grids_sites_table} WHERE grid_id = @grid_id"
    return _fetch_membership(
        query,
        bigquery.ScalarQueryParameter("grid_id", "STRING", grid_id),
        column="site_id",
        context=f"grid {grid_id}",
    )


def fetch_cohort_devices(cohort_id) -> list:
    """
    Resolves a cohort ID to its device IDs from the cohorts_devices table.

    Args:
        cohort_id(str): The cohort identifier.

    Returns:
        list: Device IDs belonging to the cohort; empty on query failure.
    """
    cohorts_devices_table = Utils.table_name(settings.bigquery_cohorts_devices)
    devices_table = Utils.table_name(settings.bigquery_devices_devices)
    query = (
        f"SELECT DISTINCT {devices_table}.device_id "
        f"FROM {devices_table} "
        f"WHERE {devices_table}.id IN ("
        f"SELECT device_id FROM {cohorts_devices_table} "
        f"WHERE cohort_id = @cohort_id)"
    )
    return _fetch_membership(
        query,
        bigquery.ScalarQueryParameter("cohort_id", "STRING", cohort_id),
        column="device_id",
        context=f"cohort {cohort_id}",
    )


def _fetch_membership(query, parameter, column: str, context: str) -> list:
    """
    Run a membership lookup and return one column as a list.

    These scan two narrow ID columns of a metadata table — a few megabytes at
    most, under BigQuery's 10 MB minimum billing — so in practice they sit far
    below the ceiling. They are still subject to it (query_job_config applies
    maximum_bytes_billed to every job), so the rejection is surfaced rather
    than swallowed: reporting "no members found" for a query that was refused
    on cost would send the caller looking for a membership problem that does
    not exist. Every other failure degrades to an empty list, which the report
    builders turn into a 404.
    """
    job_config = query_job_config(query_parameters=[parameter])
    try:
        with log_cost_rejections(f"membership lookup for {context}"):
            data = (
                shared_bigquery_client()
                .query(query, job_config=job_config)
                .to_dataframe()
            )
        return data[column].tolist()
    except QueryTooLarge:
        raise
    except Exception:
        logger.exception(f"Error fetching membership for {context}")
        return []


# Membership resolves to sites for a grid and to devices for a cohort; the
# consolidated table carries both columns, so only the predicate differs.
_REPORT_FILTER_COLUMNS = {"site_id", "device_id"}


def query_bigquery(entity_ids, start_time, end_time, id_column: str = "site_id"):
    """
    Fetches hourly consolidated PM measurements for the given members/window.

    All user-derived values (member IDs, timestamps) are bound as query
    parameters — never interpolated into the SQL text. ``id_column`` selects
    the predicate and is checked against a fixed set, since it is the one
    part that reaches the SQL text.

    Args:
        entity_ids: Site IDs (grid reports) or device IDs (cohort reports).
        start_time: Start of the reporting window.
        end_time: End of the reporting window.
        id_column: "site_id" or "device_id".

    Returns:
        pd.DataFrame with timestamps localised per site, or None when no data.

    Raises:
        QueryTooLarge: If the query exceeds the bytes-billed ceiling.
    """
    if id_column not in _REPORT_FILTER_COLUMNS:
        raise ValueError(f"Invalid report filter column: {id_column}")

    table = Utils.table_name(settings.bigquery_hourly_consolidated)
    query = f"""
        SELECT site_id, timestamp, site_name, site_latitude, site_longitude, pm2_5_raw_value,
        pm2_5_calibrated_value, pm10_raw_value, pm10_calibrated_value, country, region, city, county
        FROM {table}
        WHERE {id_column} IN UNNEST(@entity_ids)
        AND timestamp BETWEEN @start_time AND @end_time
        AND NOT pm2_5_raw_value IS NULL
    """
    job_config = query_job_config(
        query_parameters=[
            bigquery.ArrayQueryParameter("entity_ids", "STRING", list(entity_ids)),
            bigquery.ScalarQueryParameter("start_time", "TIMESTAMP", start_time),
            bigquery.ScalarQueryParameter("end_time", "TIMESTAMP", end_time),
        ]
    )

    try:
        with log_cost_rejections("grid/cohort report data"):
            data = (
                shared_bigquery_client()
                .query(query, job_config=job_config)
                .to_dataframe()
            )
        if (
            np.isnan(data["site_latitude"]).any()
            or np.isnan(data["site_longitude"]).any()
        ):
            data = data[
                ~np.isnan(data["site_latitude"]) & ~np.isnan(data["site_longitude"])
            ]

        # Emptiness is checked after the coordinate filter, not before: rows
        # without coordinates cannot be localised or aggregated, so a frame
        # left empty by that filter is as much "no data" as an empty result
        # set. Checking first returned an empty frame the caller treated as a
        # success, yielding a 200 full of empty aggregates instead of a 404.
        if data.empty:
            logger.info("No consolidated data for the given members/window.")
            return None

        # Convert timestamp to local time based on latitude and longitude
        data["timestamp"] = convert_utc_to_local(
            data["timestamp"], data["site_latitude"], data["site_longitude"]
        )

        return data
    except QueryTooLarge:
        # A window too wide to scan is the caller's to fix; swallowing it here
        # would report "no data" for a query that was never run.
        raise
    except Exception:
        logger.exception("Error querying BigQuery for report data")
        return None


def results_to_dataframe(results):
    df = (
        pd.DataFrame(results)
        .assign(timestamp=lambda x: pd.to_datetime(x["timestamp"]))
        .assign(
            dates=lambda x: x["timestamp"].dt.date.astype(str),
            date=lambda x: pd.to_datetime(x["dates"]),
            day=lambda x: x["timestamp"].dt.day_name(),
            hour=lambda x: x["timestamp"].dt.hour,
            year=lambda x: x["timestamp"].dt.year,
            month=lambda x: x["timestamp"].dt.month,
            month_name=lambda x: x["timestamp"].dt.month_name(),
        )
        .dropna(subset=["site_latitude", "site_longitude"])
    )

    return df


# Define the list of columns as a constant
PM_COLUMNS = [
    "pm2_5_raw_value",
    "pm2_5_calibrated_value",
    "pm10_raw_value",
    "pm10_calibrated_value",
]
PM_COLUMNS_CORD = PM_COLUMNS + ["site_latitude", "site_longitude"]


class PManalysis:
    @staticmethod
    def datetime_pm2_5(dataframe):
        return dataframe.groupby("timestamp")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def mean_daily_pm2_5(dataframe):
        return dataframe.groupby("date")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def mean_pm2_5_by_site_name(dataframe):
        pm_result = (
            dataframe.groupby("site_name")[PM_COLUMNS_CORD]
            .mean()
            .round(4)
            .reset_index()
        )
        result_sorted = pm_result.sort_values(
            by="pm2_5_calibrated_value", ascending=False
        )
        return result_sorted

    @staticmethod
    def monthly_mean_pm_site_name(dataframe):
        return (
            dataframe.groupby(["site_name", "month", "year"])[PM_COLUMNS_CORD]
            .mean()
            .round(4)
            .reset_index()
        )

    @staticmethod
    def annual_mean_pm_site_name(dataframe):
        return (
            dataframe.groupby(["site_name", "year"])[PM_COLUMNS_CORD]
            .mean()
            .round(4)
            .reset_index()
        )

    @staticmethod
    def mean_pm2_5_by_hour(dataframe):
        return dataframe.groupby("hour")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def mean_pm2_5_by_month_year(dataframe):
        return (
            dataframe.groupby(["month", "year"])[PM_COLUMNS]
            .mean()
            .round(4)
            .reset_index()
        )

    @staticmethod
    def mean_pm2_5_by_month(dataframe):
        return dataframe.groupby("month")[PM_COLUMNS].mean().round(2).reset_index()

    @staticmethod
    def mean_pm2_5_by_month_name(dataframe):
        return (
            dataframe.groupby(["month_name"])[PM_COLUMNS].mean().round(4).reset_index()
        )

    @staticmethod
    def mean_pm2_5_by_year(dataframe):
        return dataframe.groupby("year")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def pm_by_city(dataframe):
        return (
            dataframe.groupby(["city", "month", "year"])[PM_COLUMNS]
            .mean()
            .round(4)
            .reset_index()
        )

    @staticmethod
    def pm_by_country(dataframe):
        return dataframe.groupby("country")[PM_COLUMNS].mean().round(2).reset_index()

    @staticmethod
    def pm_by_region(dataframe):
        return dataframe.groupby("region")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def pm_day_name(dataframe):
        return dataframe.groupby("day")[PM_COLUMNS].mean().round(4).reset_index()

    @staticmethod
    def pm_day_hour_name(dataframe):
        return (
            dataframe.groupby(["day", "hour"])[PM_COLUMNS].mean().round(4).reset_index()
        )

    @staticmethod
    def gridname(dataframe):
        unique_cities = dataframe["city"].unique().tolist()
        return unique_cities
