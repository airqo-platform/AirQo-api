import pandas as pd
from datetime import datetime, timezone

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.constants import DataType, Frequency, DeviceCategory
from airqo_etl_utils.config import configuration as Config
from typing import Optional


class DailyDataUtils:
    @staticmethod
    def average_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Averages data in a pandas DataFrame on a daily basis for each device, grouped by network and device ID. The function resamples data
        to compute daily averages for numerical columns.

        Args:
            data (pd.DataFrame): A pandas DataFrame containing the following columns:
                - "timestamp": Timestamps of the data.
                - "network": The network the data belongs to.
                - "device_id": Unique identifier for the device.
                - "site_id": Unique identifier for the site associated with the device.
                - "device_number": Device number.

        Returns:
            pd.DataFrame: A DataFrame containing daily averages for each device, including metadata columns such as "tenant", "device_id", "site_id",
            and "device_number".
        """
        data["timestamp"] = pd.to_datetime(data["timestamp"])

        averaged_data_list = []

        for (network, device_id), group in data.groupby(["network", "device_id"]):
            network = group["network"].iloc[0]
            device_category = group["device_category"].iloc[0]
            site_id = group["site_id"].iloc[0]
            device_number = group["device_number"].iloc[0]

            device_averages = (
                group.resample("1D", on="timestamp")
                .mean(numeric_only=True)
                .reset_index()
            )

            device_averages["network"] = network
            device_averages["device_category"] = device_category
            device_averages["device_id"] = device_id
            device_averages["site_id"] = site_id
            device_averages["device_number"] = device_number

            averaged_data_list.append(device_averages)

        averaged_data = pd.concat(averaged_data_list, ignore_index=True)
        averaged_data["last_updated"] = datetime.now(timezone.utc)
        return averaged_data

    @staticmethod
    def cleanup_and_reload(
        data: pd.DataFrame,
        start_date_time: Optional[str] = None,
        end_date_time: Optional[str] = None,
    ) -> None:
        """
        Cleans up the input dataset by removing duplicates and reloads the processed data into BigQuery.

        This function:
        - Converts the "timestamp" column to a datetime format.
        - Removes duplicate entries based on "device_number", "device_id", and "timestamp".
        - Validates and processes the data to match BigQuery requirements.
        - Reloads the cleaned dataset into the BigQuery daily measurements table.

        Args:
            data(pd.DataFrame): The input dataset containing device measurements.
            start_date_time(str, optional): The start timestamp for data reloading (ISO format).
            end_date_time(str, optional): The end timestamp for data reloading (ISO format).

        Returns:
            None
        """
        bigquery_api = BigQueryApi()
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["last_updated"] = pd.to_datetime(data["last_updated"])
        data.sort_values(by="last_updated", ascending=True, inplace=True)
        data.drop_duplicates(
            subset=["device_number", "device_id", "timestamp"],
            keep="last",
            inplace=True,
        )

        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.DAILY
        )
        bigquery_api.reload_data(
            dataframe=data,
            table=table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @staticmethod
    def save_data(data: pd.DataFrame) -> None:
        """
        Processes and saves the given dataset to BigQuery.

        This function:
        - Retrieves the BigQuery daily measurements table.
        - Validates and processes the dataset to ensure it meets BigQuery requirements.
        - Loads the processed data into the designated BigQuery table.

        Args:
            data (pd.DataFrame): The dataset containing measurement data to be stored.

        Returns:
            None
        """
        bigquery_api = BigQueryApi()

        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.DAILY
        )

        bigquery_api.load_data(dataframe=data, table=table)
