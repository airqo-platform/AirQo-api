import pandas as pd

from .airqo_api import AirQoApi
from .airqo_utils import AirQoDataUtils

# from .app_insights_utils import AirQoAppUtils
from .bigquery_api import BigQueryApi
from .constants import DeviceCategory, DeviceNetwork
from .data_validator import DataValidationUtils
from .weather_data_utils import WeatherDataUtils
from .constants import DataType, Frequency
from .datautils import DataUtils


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

        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.BAM,
        )

        data.rename(
            columns={
                "latitude": "device_latitude",
                "longitude": "device_longitude",
            },
            inplace=True,
        )
        data["device_category"] = str(DeviceCategory.BAM)
        return DataWarehouseUtils.filter_valid_columns(data)

    @staticmethod
    def extract_hourly_low_cost_data(
        start_date_time: str,
        end_date_time: str,
    ) -> pd.DataFrame:
        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )

        data.rename(
            columns={
                "latitude": "device_latitude",
                "longitude": "device_longitude",
                "altitude": "device_altitude",
            },
            inplace=True,
        )
        data["device_category"] = str(DeviceCategory.LOW_COST)
        return DataWarehouseUtils.filter_valid_columns(data)

    @staticmethod
    def extract_hourly_weather_data(
        start_date_time: str, end_date_time: str
    ) -> pd.DataFrame:
        return WeatherDataUtils.extract_weather_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            remove_outliers=False,
        )

    @staticmethod
    def extract_sites_meta_data(network: DeviceNetwork = None) -> pd.DataFrame:
        airqo_api = AirQoApi()
        sites = airqo_api.get_sites(network=network)
        sites = pd.DataFrame(sites)
        sites.rename(
            columns={
                "approximate_latitude": "site_latitude",
                "approximate_longitude": "site_longitude",
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
    def merge_datasets(
        weather_data: pd.DataFrame,
        bam_data: pd.DataFrame,
        low_cost_data: pd.DataFrame,
        sites_info: pd.DataFrame,
    ) -> pd.DataFrame:
        low_cost_data.loc[:, "device_category"] = str(DeviceCategory.LOW_COST)
        bam_data.loc[:, "device_category"] = str(DeviceCategory.BAM)

        airqo_data = low_cost_data.loc[low_cost_data["network"] == DeviceNetwork.AIRQO]

        non_airqo_data = low_cost_data.loc[
            low_cost_data["network"] != DeviceNetwork.AIRQO
        ]
        airqo_data = AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=airqo_data, weather_data=weather_data
        )

        devices_data = pd.concat(
            [airqo_data, non_airqo_data, bam_data], ignore_index=True
        )

        return pd.merge(
            left=devices_data,
            right=sites_info,
            on=["site_id", "network"],
            how="left",
        )
