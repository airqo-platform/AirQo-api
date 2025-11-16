import pandas as pd
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
from airflow.exceptions import AirflowFailException
from airqo_etl_utils.constants import Frequency, DataType, DeviceCategory

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

    @staticmethod
    def send_to_bigquery(data: pd.DataFrame) -> None:
        """
        Sends the provided DataFrame to BigQuery after processing.

        Args:
            data (pd.DataFrame): The DataFrame containing data to be sent to BigQuery.

        Returns:
            None
        """
        big_query_api = BigQueryApi()
        processed_data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.HOURLY
        )
        big_query_api.load_data(dataframe=processed_data, table=table)

    @staticmethod
    def send_to_api(data: pd.DataFrame, **kwargs) -> None:
        """
        Sends the provided DataFrame to the api after processing.

        Args:
            data (pd.DataFrame): The DataFrame containing data to be sent to BigQuery.

        Returns:
            None
        """
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            data = DataUtils.process_data_for_api(data, Frequency.HOURLY)
            data_api = DataApi()
            data_api.save_events(measurements=data)

    @staticmethod
    def send_to_broker(data: pd.DataFrame) -> None:
        """
        Sends the provided DataFrame to kafka after processing.

        Args:
            data (pd.DataFrame): The DataFrame containing data to be sent to BigQuery.

        Returns:
            None
        """
        data = DataUtils.process_data_for_message_broker(data=data)
        if not isinstance(data, pd.DataFrame):
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)
