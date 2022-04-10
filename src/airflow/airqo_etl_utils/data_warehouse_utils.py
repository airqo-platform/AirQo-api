import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi

hourly_weather_columns = [
    "timestamp",
    "site_id",
    "temperature",
    "humidity",
    "wind_speed",
    "atmospheric_pressure",
    "radiation",
    "vapor_pressure",
    "wind_gusts",
    "precipitation",
    "wind_direction",
]


hourly_measurements_columns = [
    "timestamp",
    "site_id",
    "device",
    "device_number",
    "latitude",
    "longitude",
    "pm2_5",
    "s1_pm2_5",
    "s2_pm2_5",
    "pm2_5_raw_value",
    "pm2_5_calibrated_value",
    "pm10",
    "s1_pm10",
    "s2_pm10",
    "pm10_raw_value",
    "pm10_calibrated_value",
    "no2",
    "no2_raw_value",
    "no2_calibrated_value",
    "pm1",
    "pm1_raw_value",
    "pm1_calibrated_value",
    "external_temperature",
    "external_humidity",
]


def query_hourly_measurements(start_date_time: str, end_date_time: str) -> list:
    biq_query_api = BigQueryApi()

    hourly_measurements = biq_query_api.get_hourly_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=hourly_measurements_columns,
        table=biq_query_api.hourly_measurements_table,
    )

    if hourly_measurements.empty:
        hourly_measurements = pd.DataFrame(data=[], columns=hourly_measurements_columns)

    hourly_measurements.rename(
        columns={
            "latitude": "device_latitude",
            "longitude": "device_longitude",
            "device": "device_name",
        },
        inplace=True,
    )

    return hourly_measurements.to_dict(orient="records")


def query_hourly_weather_data(start_date_time: str, end_date_time: str) -> list:
    biq_query_api = BigQueryApi()
    hourly_weather_measurements = biq_query_api.get_hourly_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=hourly_weather_columns,
        table=biq_query_api.hourly_weather_table,
    )
    if hourly_weather_measurements.empty:
        return pd.DataFrame(data=[], columns=hourly_weather_columns).to_dict(
            orient="records"
        )

    return hourly_weather_measurements.to_dict(orient="records")


def extract_sites_meta_data(tenant=None) -> list:
    airqo_api = AirQoApi()
    sites = airqo_api.get_sites(tenant=tenant)
    sites_df = pd.DataFrame(sites)
    sites_df = sites_df[
        [
            "_id",
            "latitude",
            "tenant",
            "longitude",
            "name",
            "bearing_to_kampala_center",
            "landform_90",
            "distance_to_kampala_center",
            "altitude",
            "landform_270",
            "aspect",
            "description",
            "distance_to_nearest_tertiary_road",
            "distance_to_nearest_primary_road",
            "distance_to_nearest_road",
            "distance_to_nearest_residential_road",
            "distance_to_nearest_secondary_road",
            "distance_to_nearest_unclassified_road",
            "country",
            "region",
            "parish",
            "sub_county",
            "county",
            "district",
            "city",
        ]
    ]

    sites_df.rename(
        columns={
            "_id": "site_id",
            "latitude": "site_latitude",
            "longitude": "site_longitude",
            "description": "site_description",
            "altitude": "site_altitude",
            "name": "site_name",
            "distance_to_nearest_tertiary_road": "site_distance_to_nearest_tertiary_road",
            "distance_to_nearest_primary_road": "site_distance_to_nearest_primary_road",
            "distance_to_nearest_road": "site_distance_to_nearest_road",
            "distance_to_nearest_residential_road": "site_distance_to_nearest_residential_road",
            "distance_to_nearest_secondary_road": "site_distance_to_nearest_secondary_road",
            "distance_to_nearest_unclassified_road": "site_distance_to_nearest_unclassified_road",
            "bearing_to_kampala_center": "site_bearing_to_kampala_center",
            "landform_90": "site_landform_90",
            "distance_to_kampala_center": "site_distance_to_kampala_center",
            "landform_270": "site_landform_270",
            "aspect": "site_aspect",
        },
        inplace=True,
    )
    sites_df.reset_index(drop=True, inplace=True)
    return sites_df.to_dict(orient="records")


def merge_measurements_weather_sites(
    measurements_data: list, weather_data: list, sites: list
) -> list:
    measurements_data_df = pd.DataFrame(measurements_data)
    weather_data_df = pd.DataFrame(weather_data)
    sites_df = pd.DataFrame(sites)

    if weather_data_df.empty:
        weather_data_df = pd.DataFrame(data=[], columns=hourly_weather_columns)
    if measurements_data_df.empty:
        measurements_data_df = pd.DataFrame(
            data=[], columns=hourly_measurements_columns
        )

    measurements_df = pd.merge(
        left=measurements_data_df,
        right=weather_data_df,
        on=["site_id", "timestamp"],
        how="left",
    )

    measurements_df["external_humidity"] = measurements_df["external_humidity"].fillna(
        measurements_df["humidity"]
    )

    measurements_df["external_temperature"] = measurements_df[
        "external_temperature"
    ].fillna(measurements_df["temperature"])

    measurements_df["temperature"] = measurements_df["external_temperature"]
    measurements_df["humidity"] = measurements_df["external_humidity"]

    del measurements_df["external_temperature"]
    del measurements_df["external_humidity"]

    data_df = pd.merge(measurements_df, sites_df, on=["site_id"], how="left")
    return data_df.to_dict(orient="records")
