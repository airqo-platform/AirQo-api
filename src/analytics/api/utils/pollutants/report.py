import pandas as pd
from google.cloud import bigquery
from api.utils.bigquery_jobs import query_job_config, shared_bigquery_client
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
    job_config = query_job_config(
        query_parameters=[bigquery.ScalarQueryParameter("grid_id", "STRING", grid_id)]
    )

    try:
        data = (
            shared_bigquery_client().query(query, job_config=job_config).to_dataframe()
        )
        return data["site_id"].tolist()
    except Exception:
        logger.exception(f"Error fetching grid sites for grid {grid_id}")
        return []


def query_bigquery(site_ids, start_time, end_time):
    """
    Fetches hourly consolidated PM measurements for the given sites/window.

    All user-derived values (site IDs, timestamps) are bound as query
    parameters — never interpolated into the SQL text.

    Returns:
        pd.DataFrame with timestamps localised per site, or None when no data.
    """
    table = Utils.table_name(settings.bigquery_hourly_consolidated)
    query = f"""
        SELECT site_id, timestamp, site_name, site_latitude, site_longitude, pm2_5_raw_value,
        pm2_5_calibrated_value, pm10_raw_value, pm10_calibrated_value, country, region, city, county
        FROM {table}
        WHERE site_id IN UNNEST(@site_ids)
        AND timestamp BETWEEN @start_time AND @end_time
        AND NOT pm2_5_raw_value IS NULL
    """
    job_config = query_job_config(
        query_parameters=[
            bigquery.ArrayQueryParameter("site_ids", "STRING", list(site_ids)),
            bigquery.ScalarQueryParameter("start_time", "TIMESTAMP", start_time),
            bigquery.ScalarQueryParameter("end_time", "TIMESTAMP", end_time),
        ]
    )

    try:
        data = (
            shared_bigquery_client().query(query, job_config=job_config).to_dataframe()
        )
        if data.empty:
            logger.info("No consolidated data for the given sites/window.")
            return None

        if (
            np.isnan(data["site_latitude"]).any()
            or np.isnan(data["site_longitude"]).any()
        ):
            data = data[
                ~np.isnan(data["site_latitude"]) & ~np.isnan(data["site_longitude"])
            ]

        # Convert timestamp to local time based on latitude and longitude
        data["timestamp"] = convert_utc_to_local(
            data["timestamp"], data["site_latitude"], data["site_longitude"]
        )

        return data
    except Exception:
        logger.exception("Error querying BigQuery for grid report data")
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
