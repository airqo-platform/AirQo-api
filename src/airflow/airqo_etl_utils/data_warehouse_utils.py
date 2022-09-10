import pandas as pd

from .airqo_api import AirQoApi
from .airqo_utils import AirQoDataUtils
from .bigquery_api import BigQueryApi
from .constants import Tenant
from .utils import Utils


class DataWarehouseUtils:
    @staticmethod
    def filter_valid_columns(data: pd.DataFrame) -> pd.DataFrame:
        biq_query_api = BigQueryApi()
        data_warehouse_cols = biq_query_api.get_columns(
            table=biq_query_api.consolidated_data_table
        )
        data_cols = set(data.columns.to_list())
        data_warehouse_cols = set(data_warehouse_cols)

        return data[list(data_cols & data_warehouse_cols)]

    @staticmethod
    def extract_hourly_bam_data(
        start_date_time: str,
        end_date_time: str,
    ) -> pd.DataFrame:
        biq_query_api = BigQueryApi()
        columns = biq_query_api.get_columns(table=biq_query_api.bam_measurements_table)
        data = biq_query_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=biq_query_api.bam_measurements_table,
        )

        if data.empty:
            data = pd.DataFrame(data=[], columns=columns)

        data.rename(
            columns={
                "latitude": "device_latitude",
                "longitude": "device_longitude",
            },
            inplace=True,
        )

        return DataWarehouseUtils.filter_valid_columns(data)

    @staticmethod
    def extract_hourly_low_cost_data(
        start_date_time: str,
        end_date_time: str,
    ) -> pd.DataFrame:
        biq_query_api = BigQueryApi()
        columns = biq_query_api.get_columns(
            table=biq_query_api.hourly_measurements_table
        )
        data = biq_query_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=biq_query_api.hourly_measurements_table,
        )

        if data.empty:
            data = pd.DataFrame(data=[], columns=columns)

        data.rename(
            columns={
                "latitude": "device_latitude",
                "longitude": "device_longitude",
                "altitude": "device_altitude",
            },
            inplace=True,
        )

        return DataWarehouseUtils.filter_valid_columns(data)

    @staticmethod
    def extract_hourly_weather_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        biq_query_api = BigQueryApi()
        columns = biq_query_api.get_columns(table=biq_query_api.hourly_weather_table)
        data = biq_query_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=biq_query_api.hourly_weather_table,
        )
        if data.empty:
            data = pd.DataFrame(data=[], columns=columns)

        return data

    @staticmethod
    def extract_sites_meta_data(tenant: Tenant = Tenant.NONE) -> pd.DataFrame:
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(tenant=tenant)
        sites = pd.DataFrame(sites)
        sites.rename(
            columns={
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

        return DataWarehouseUtils.filter_valid_columns(sites)

    @staticmethod
    def merge_bam_low_cost_and_weather_data(
        weather_data: pd.DataFrame,
        bam_data: pd.DataFrame,
        low_cost_data: pd.DataFrame,
        sites_data: pd.DataFrame,
    ) -> pd.DataFrame:

        airqo_data = low_cost_data.loc[low_cost_data["tenant"] == str(Tenant.AIRQO)]
        non_airqo_data = low_cost_data.loc[low_cost_data["tenant"] != str(Tenant.AIRQO)]
        airqo_data = AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=airqo_data, weather_data=weather_data
        )

        devices_data = pd.concat(
            [airqo_data, non_airqo_data, bam_data], ignore_index=True
        )

        devices_data = devices_data.merge(
            right=sites_data,
            on=["site_id", "tenant"],
            how="left",
        )

        return devices_data

    @staticmethod
    def format_data_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.analytics_table)
        return Utils.populate_missing_columns(data=data, cols=cols)


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


def extract_sites_meta_data(tenant: Tenant = Tenant.NONE) -> pd.DataFrame:
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
