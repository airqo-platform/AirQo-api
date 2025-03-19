import ast
import pandas as pd
from typing import List

from .constants import DataSource, DeviceCategory, Frequency, DeviceNetwork
from .date import str_to_date, date_to_str
from .utils import Utils
from .data_validator import DataValidationUtils
from .datautils import DataUtils
from .config import configuration as Config
import logging

logger = logging.getLogger("airflow.task")


class AirnowDataUtils:
    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        """
        Queries BAM (Beta Attenuation Monitor) data from the AirNow API within the given date range.

        This function converts the input date strings into the required format for the API,
        retrieves air quality data, and returns it as a Pandas DataFrame.

        Args:
            api_key(str): The API key required for authentication with AirNow.
            start_date_time(str): The start datetime in string format (expected format: "YYYY-MM-DD HH:MM").
            end_date_time(str): The end datetime in string format (expected format: "YYYY-MM-DD HH:MM").

        Returns:
            pd.DataFrame: A DataFrame containing the air quality data retrieved from the AirNow API.

        Example:
            >>> df = query_bam_data("your_api_key", "2024-03-01 00:00", "2024-03-02 23:59")
            >>> print(df.head())
        """
        date_format = "%Y-%m-%dT%H:%M"
        start_date_time = date_to_str(
            str_to_date(start_date_time), str_format=date_format
        )
        end_date_time = date_to_str(str_to_date(end_date_time), str_format=date_format)
        data = DataUtils.extract_bam_data_airnow(start_date_time, end_date_time)
        return data

    @staticmethod
    def process_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        """
        Processes raw BAM device data by matching it to corresponding device details and constructing
        a structured DataFrame of air quality measurements.

        Steps:
        1. Maps each device code to its corresponding device details using a device mapping.
        2. Iterates over the input DataFrame, validates the device details, and retrieves pollutant values.
        3. Constructs a list of air quality measurements with relevant device information and pollutant data.
        4. Removes outliers from the processed data.

        Args:
            data(pd.DataFrame): A DataFrame containing raw BAM device data, with columns such as 'FullAQSCode', 'Parameter', 'Value', 'Latitude', 'Longitude', and 'UTC'.

        Returns:
            pd.DataFrame: A cleaned and structured DataFrame containing processed air quality data. The resulting DataFrame includes columns such as 'timestamp', 'network', 'site_id', 'device_id', and pollutant values ('pm2_5', 'pm10', 'no2', etc.).
        """
        return DataUtils.process_bam_data_airnow(data=data)
