import json
from datetime import datetime
import requests
import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account
from config import Config
import numpy as np
from timezonefinder import TimezoneFinder
import pytz


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


def fetch_air_quality_data(grid_id, start_time, end_time) -> list:
    # Convert start_time and end_time to ISO format
    start_time_iso = start_time.isoformat() + "Z"
    end_time_iso = end_time.isoformat() + "Z"

    grid_params = {
        "token": Config.AIRQO_API_TOKEN,
        "startTime": start_time_iso,
        "endTime": end_time_iso,
        "recent": "no",
    }

    grid_url = f"{Config.GRID_URL}{grid_id}"

    try:
        grid_response = requests.get(grid_url, params=grid_params)
        grid_response.raise_for_status()  # Raise an exception for 4xx and 5xx status codes

        data = grid_response.json()

        # Extracting only the 'site_id' from each measurement
        site_ids = [
            measurement.get("site_id") for measurement in data.get("measurements", [])
        ]

        return site_ids
    except requests.exceptions.RequestException as e:
        print(f"Error fetching air quality data: ")
        return []


# Create a BigQuery client
client = bigquery.Client()


def query_bigquery(site_ids, start_time, end_time):
    # Construct the BigQuery SQL query
    query = f"""
        SELECT site_id, timestamp, site_name, site_latitude, site_longitude, pm2_5_raw_value,
        pm2_5_calibrated_value, pm10_raw_value, pm10_calibrated_value, country, region, city, county
        FROM {Config.BIGQUERY_HOURLY_CONSOLIDATED}
        WHERE site_id IN UNNEST({site_ids})
        AND timestamp BETWEEN TIMESTAMP('{start_time.isoformat()}')
        AND TIMESTAMP('{end_time.isoformat()}')
        AND NOT pm2_5_raw_value IS NULL
    """

    try:
        # Execute the query
        query_job = client.query(query)

        # Fetch and return the results as a Pandas DataFrame
        data = query_job.to_dataframe()
        if data.empty:
            print("No data available for the given parameters.")
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
    except Exception as e:
        print(f"Error querying BigQuery: {e}")
        return None


def results_to_dataframe(results):
    df = (
        pd.DataFrame(results)
        .assign(timestamp=lambda x: pd.to_datetime(x['timestamp']))
        .assign(
            dates=lambda x: x['timestamp'].dt.date.astype(str),
            date=lambda x: pd.to_datetime(x['dates']),
            day=lambda x: x['timestamp'].dt.day_name(),
            hour=lambda x: x['timestamp'].dt.hour,
            year=lambda x: x['timestamp'].dt.year,
            month=lambda x: x['timestamp'].dt.month,
            month_name=lambda x: x['timestamp'].dt.month_name()
        )
        .dropna(subset=['site_latitude', 'site_longitude'])
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
        return dataframe.groupby(['site_name','year'])[PM_COLUMNS_CORD].mean().round(4).reset_index() 
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
        return (dataframe.groupby(["day", "hour"])[PM_COLUMNS].mean().round(4).reset_index())
    
    @staticmethod
    def gridname(dataframe):
        unique_cities = dataframe['city'].unique().tolist()
        return unique_cities
