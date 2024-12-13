import pandas as pd

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import Tenant
from airqo_etl_utils.data_validator import DataValidationUtils


class DailyDataUtils:
    @staticmethod
    def average_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Averages data in a pandas DataFrame on a daily basis for each device,
        grouped by network and device ID. The function resamples data
        to compute daily averages for numerical columns.

        Args:
            data (pd.DataFrame): A pandas DataFrame containing the following columns:
                - "timestamp": Timestamps of the data.
                - "network": The network the data belongs to.
                - "device_id": Unique identifier for the device.
                - "site_id": Unique identifier for the site associated with the device.
                - "device_number": Device number.

        Returns:
            pd.DataFrame: A DataFrame containing daily averages for each device,
            including metadata columns such as "tenant", "device_id", "site_id",
            and "device_number".
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])

        averaged_data_list = []

        for (network, device_id), group in data.groupby(["network", "device_id"]):
            network = group["network"].iloc[0]
            site_id = group["site_id"].iloc[0]
            device_number = group["device_number"].iloc[0]

            device_averages = (
                group.resample("1D", on="timestamp")
                .mean(numeric_only=True)
                .reset_index()
            )

            device_averages["network"] = network
            device_averages["device_id"] = device_id
            device_averages["site_id"] = site_id
            device_averages["device_number"] = device_number

            averaged_data_list.append(device_averages)

        averaged_data = pd.concat(averaged_data_list, ignore_index=True)

        return averaged_data

    @staticmethod
    def query_hourly_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        raw_data = bigquery_api.query_data(
            table=bigquery_api.hourly_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def query_daily_data(start_date_time, end_date_time) -> pd.DataFrame:
        bigquery_api = BigQueryApi()

        raw_data = bigquery_api.query_data(
            table=bigquery_api.daily_measurements_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return DataValidationUtils.remove_outliers(raw_data)

    @staticmethod
    def cleanup_and_reload(
        data: pd.DataFrame, start_date_time=None, end_date_time=None
    ):
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        data = data.drop_duplicates(
            subset=["device_number", "device_id", "timestamp"], keep="first"
        )

        bigquery_api = BigQueryApi()
        table = bigquery_api.daily_measurements_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        bigquery_api.reload_data(
            tenant=Tenant.ALL,
            table=table,
            dataframe=data,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @staticmethod
    def save_data(data: pd.DataFrame):
        bigquery_api = BigQueryApi()

        table = bigquery_api.daily_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        bigquery_api.load_data(
            table=table,
            dataframe=data,
        )
