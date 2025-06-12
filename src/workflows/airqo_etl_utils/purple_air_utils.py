import pandas as pd

from .bigquery_api import BigQueryApi
from .constants import DeviceNetwork
from .data_validator import DataValidationUtils


class PurpleDataUtils:
    @staticmethod
    def process_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Renames sensor data columns to standardized names and tags the data with the NASA network.

        Args:
            data (pd.DataFrame): Raw sensor data with original column names.

        Returns:
            pd.DataFrame: DataFrame with standardized column names and a 'network' column set to NASA.
        """
        data.rename(
            columns={
                "time_stamp": "timestamp",
                "humidity": "device_humidity",
                "temperature": "device_temperature",
                "pressure_a": "s1_pressure",
                "pressure_b": "s2_pressure",
                "pm1.0_atm": "pm1",
                "pm1.0_atm_a": "s1_pm1",
                "pm1.0_atm_b": "s2_pm1",
                "pm2.5_atm": "pm2_5",
                "pm2.5_atm_a": "s1_pm2_5",
                "pm2.5_atm_b": "s2_pm2_5",
                "pm10.0_atm": "pm10",
                "pm10.0_atm_a": "s1_pm10",
                "pm10.0_atm_b": "s2_pm10",
                "voc_a": "s1_voc",
                "voc_b": "s2_voc",
            },
            inplace=True,
        )
        data["network"] = DeviceNetwork.NASA
        return data

    @staticmethod
    def process_for_bigquery(data: pd.DataFrame) -> pd.DataFrame:
        """
        Prepares the sensor data for BigQuery ingestion by:
        - Converting the 'timestamp' column to datetime.
        - Ensuring all required BigQuery columns exist, filling any missing ones.

        Args:
            data(pd.DataFrame): Cleaned sensor data.

        Returns:
            pd.DataFrame: DataFrame formatted and schema-aligned for BigQuery ingestion.
        """
        data["timestamp"] = data["timestamp"].apply(pd.to_datetime)
        big_query_api = BigQueryApi()
        cols = big_query_api.get_columns(table=big_query_api.raw_measurements_table)
        return DataValidationUtils.fill_missing_columns(data=data, cols=cols)
