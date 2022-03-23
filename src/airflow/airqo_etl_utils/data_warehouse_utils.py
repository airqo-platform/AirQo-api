import pandas as pd

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.bigquery_api import BigQueryApi


def query_hourly_measurements(
    start_date_time: str, end_date_time: str, tenant=None
) -> list:
    biq_query_api = BigQueryApi()
    columns = [
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
    ]
    hourly_measurements = biq_query_api.get_hourly_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=columns,
        table=biq_query_api.hourly_measurements_table,
    )

    hourly_measurements.rename(
        columns={
            "latitude": "device_latitude",
            "longitude": "device_longitude",
            "device": "device_name",
        },
        inplace=True,
    )

    return hourly_measurements.to_dict(orient="records")


def query_hourly_weather_data(
    start_date_time: str, end_date_time: str, tenant=None
) -> list:
    biq_query_api = BigQueryApi()
    columns = [
        "timestamp",
        "tenant",
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
    hourly_weather_measurements = biq_query_api.get_hourly_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=columns,
        table=biq_query_api.hourly_weather_table,
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

    measurements_df = pd.merge(
        left=measurements_data_df,
        right=weather_data_df,
        on=["site_id", "timestamp"],
        how="left",
    )
    data_df = pd.merge(measurements_df, sites_df, on=["site_id"], how="left")
    return data_df.to_dict(orient="records")
