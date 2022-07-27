import pandas as pd

from airqo_api import AirQoApi
from bigquery_api import BigQueryApi


def query_hourly_measurements(start_date_time: str, end_date_time: str) -> pd.DataFrame:
    biq_query_api = BigQueryApi()
    columns = biq_query_api.get_columns(table=biq_query_api.hourly_measurements_table)
    hourly_measurements = biq_query_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=columns,
        table=biq_query_api.hourly_measurements_table,
    )

    if hourly_measurements.empty:
        hourly_measurements = pd.DataFrame(data=[], columns=columns)

    hourly_measurements.rename(
        columns={
            "latitude": "device_latitude",
            "longitude": "device_longitude",
            "device": "device_name",
        },
        inplace=True,
    )

    return hourly_measurements


def query_hourly_weather_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
    biq_query_api = BigQueryApi()
    columns = biq_query_api.get_columns(table=biq_query_api.hourly_weather_table)
    hourly_weather_measurements = biq_query_api.query_data(
        start_date_time=start_date_time,
        end_date_time=end_date_time,
        columns=columns,
        table=biq_query_api.hourly_weather_table,
    )
    if hourly_weather_measurements.empty:
        return pd.DataFrame(data=[], columns=columns)

    return hourly_weather_measurements


def extract_sites_meta_data(tenant=None) -> pd.DataFrame:
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

    sites_df[
        [
            "latitude",
            "longitude",
            "bearing_to_kampala_center",
            "landform_90",
            "distance_to_kampala_center",
            "altitude",
            "landform_270",
            "aspect",
            "distance_to_nearest_tertiary_road",
            "distance_to_nearest_primary_road",
            "distance_to_nearest_road",
            "distance_to_nearest_residential_road",
            "distance_to_nearest_secondary_road",
            "distance_to_nearest_unclassified_road",
        ]
    ] = sites_df[
        [
            "latitude",
            "longitude",
            "bearing_to_kampala_center",
            "landform_90",
            "distance_to_kampala_center",
            "altitude",
            "landform_270",
            "aspect",
            "distance_to_nearest_tertiary_road",
            "distance_to_nearest_primary_road",
            "distance_to_nearest_road",
            "distance_to_nearest_residential_road",
            "distance_to_nearest_secondary_road",
            "distance_to_nearest_unclassified_road",
        ]
    ].apply(
        pd.to_numeric, errors="coerce"
    )

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
    return sites_df


def merge_measurements_weather_sites(
    measurements_data: pd.DataFrame, weather_data: pd.DataFrame, sites: pd.DataFrame
) -> pd.DataFrame:

    biq_query_api = BigQueryApi()
    if weather_data.empty:
        weather_columns = biq_query_api.get_columns(
            table=biq_query_api.hourly_weather_table
        )
        weather_data = pd.DataFrame(data=[], columns=weather_columns)
    if measurements_data.empty:
        measurements_columns = biq_query_api.get_columns(
            table=biq_query_api.hourly_measurements_table
        )
        measurements_data = pd.DataFrame(data=[], columns=measurements_columns)
    del measurements_data["wind_speed"]

    measurements_df = pd.merge(
        left=measurements_data,
        right=weather_data,
        on=["tenant", "site_id", "timestamp"],
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

    data_df = pd.merge(measurements_df, sites, on=["tenant", "site_id"], how="left")
    return data_df
