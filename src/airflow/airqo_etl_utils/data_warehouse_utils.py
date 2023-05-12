import pandas as pd

from .airqo_api import AirQoApi
from .airqo_utils import AirQoDataUtils

# from .app_insights_utils import AirQoAppUtils
from .bigquery_api import BigQueryApi
from .constants import Tenant, DeviceCategory
from .data_validator import DataValidationUtils
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
        data.loc[:, "device_category"] = str(DeviceCategory.BAM)
        return DataWarehouseUtils.filter_valid_columns(data)

    @staticmethod
    def extract_data_from_big_query(
        start_date_time: str,
        end_date_time: str,
    ) -> pd.DataFrame:
        biq_query_api = BigQueryApi()
        return biq_query_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            table=biq_query_api.consolidated_data_table,
            tenant=Tenant.ALL,
        )

    @staticmethod
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        return data.drop_duplicates(
            subset=["tenant", "timestamp", "device_number", "device_id"],
            keep="first",
        )

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
        data.loc[:, "device_category"] = str(DeviceCategory.LOW_COST)
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
    def update_latest_measurements(data: pd.DataFrame, tenant: Tenant):
        device_cols = [
            "device_number",
            "device_id",
            "device_latitude",
            "device_longitude",
        ]
        site_cols = [
            "site_latitude",
            "site_longitude",
            "site_name",
            "site_id",
            "site_location",
            "site_display_name",
            "site_display_location",
            "site_approximate_latitude",
            "site_approximate_longitude",
        ]

        big_query_api = BigQueryApi()
        devices_data = big_query_api.query_devices(tenant=tenant)

        if not devices_data.empty:
            devices_data.rename(
                columns={
                    "latitude": "device_latitude",
                    "longitude": "device_longitude",
                },
                inplace=True,
            )
            devices_data = devices_data[device_cols]
            data = pd.merge(
                left=data,
                right=devices_data,
                on=["device_number", "device_id"],
                how="left",
            )
            data["device_latitude"] = data["device_latitude"].fillna(data["latitude"])
            data["device_longitude"] = data["device_longitude"].fillna(
                data["longitude"]
            )
            del data["latitude"]
            del data["longitude"]

        sites_data = big_query_api.query_sites(tenant=tenant)
        sites_data = (
            sites_data if sites_data.empty else sites_data.dropna(subset=["id"])
        )
        if not sites_data.empty:
            sites_data.rename(
                columns={
                    "latitude": "site_latitude",
                    "longitude": "site_longitude",
                    "name": "site_name",
                    "id": "site_id",
                    "location": "site_location",
                    "display_name": "site_display_name",
                    "display_location": "site_display_location",
                    "approximate_latitude": "site_approximate_latitude",
                    "approximate_longitude": "site_approximate_longitude",
                },
                inplace=True,
            )
            sites_data = sites_data[site_cols]

            if tenant == Tenant.US_EMBASSY:
                data = data[data["site_id"].isin(sites_data["site_id"].to_list())]

            data = pd.merge(
                left=data,
                right=sites_data,
                on=["site_id"],
                how="left",
            )

        table = big_query_api.latest_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table, tenant=tenant
        )

        big_query_api.update_data(data, table=table)

    @staticmethod
    def merge_datasets(
        weather_data: pd.DataFrame,
        bam_data: pd.DataFrame,
        low_cost_data: pd.DataFrame,
        sites_info: pd.DataFrame,
    ) -> pd.DataFrame:
        low_cost_data.loc[:, "device_category"] = str(DeviceCategory.LOW_COST)
        bam_data.loc[:, "device_category"] = str(DeviceCategory.BAM)

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
            right=sites_info,
            on=["site_id", "tenant"],
            how="left",
        )
