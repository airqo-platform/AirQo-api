import pandas as pd

from .airqo_api import AirQoApi
from .airqo_utils import AirQoDataUtils
from .bigquery_api import BigQueryApi
from .constants import Tenant
from .data_validator import DataValidationUtils
from .date import date_to_str
from .weather_data_utils import WeatherDataUtils


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
            tenant=Tenant.ALL,
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
            tenant=Tenant.ALL,
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
        return WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @staticmethod
    def extract_sites_meta_data(tenant: Tenant = Tenant.ALL) -> pd.DataFrame:
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

        return pd.merge(
            left=devices_data,
            right=sites_data,
            on=["site_id", "tenant"],
            how="left",
        )

    @staticmethod
    def reload_data(data: pd.DataFrame):

        data = DataValidationUtils.format_data_types(
            data=data, timestamps=["timestamp"]
        )
        start_date_time = date_to_str(data["timestamp"].min())
        end_date_time = date_to_str(data["timestamp"].max())
        tenant = Tenant.ALL

        big_query_api = BigQueryApi()

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=big_query_api.analytics_table, tenant=tenant
        )

        big_query_api.reload_data(
            dataframe=data,
            table=big_query_api.analytics_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant=tenant,
        )
