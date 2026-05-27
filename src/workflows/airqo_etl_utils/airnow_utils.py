import logging

import pandas as pd
from airflow.exceptions import AirflowFailException

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.constants import (
    DataSource,
    DataType,
    DeviceCategory,
    DeviceNetwork,
    Frequency,
)
from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
from airqo_etl_utils.sources import fetch_from_adapter
from airqo_etl_utils.utils import Utils

logger = logging.getLogger("airflow.task")


class AirnowDataUtils:
    @staticmethod
    def extract_bam_data(start_date_time: str, end_date_time: str) -> pd.DataFrame:
        """Extract BAM (Beta Attenuation Monitor) data from the AirNow API.

        Splits the requested range into API-appropriate chunks and queries all
        BAM stations within the configured geographic bounding box. Auth is read
        from ``configuration.INTEGRATION_DETAILS["metone"]``.

        Args:
            start_date_time (str): Start of the date range in ISO 8601 format
                (e.g. ``"2024-03-01T00:00:00Z"``).
            end_date_time (str): End of the date range in ISO 8601 format
                (e.g. ``"2024-03-02T23:59:59Z"``).

        Returns:
            pd.DataFrame: Raw AirNow records with a ``network`` column set to
            ``DeviceNetwork.METONE``. Empty DataFrame when no data is available.

        Raises:
            ValueError: If the date range is empty or invalid.
        """
        raw_dates = Utils.query_dates_array(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            data_source=DataSource.AIRNOW,
        )
        if not raw_dates:
            raise ValueError("Invalid or empty date range provided.")

        dates = [
            (
                DateUtils.str_to_date(s).strftime("%Y-%m-%dT%H:%M:%SZ"),
                DateUtils.str_to_date(e).strftime("%Y-%m-%dT%H:%M:%SZ"),
            )
            for s, e in raw_dates
        ]

        result = fetch_from_adapter(DeviceNetwork.METONE, dates=dates)
        records = (result.data or {}).get("records", [])

        if not records:
            logger.info("No BAM data found for the specified date range.")
            return pd.DataFrame()

        bam_data = pd.DataFrame(records)
        bam_data["network"] = DeviceNetwork.METONE.str
        return bam_data

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
        """Send processed measurements to the AirQo API.

        Only sends when the Airflow param ``send_to_api`` is truthy; otherwise
        this is a no-op.

        Args:
            data (pd.DataFrame): Processed measurements DataFrame.
            **kwargs: Airflow context; reads ``params.send_to_api`` to gate the call.
        """
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            data = DataUtils.process_data_for_api(data, Frequency.HOURLY)
            data_api = DataApi()
            data_api.save_events(measurements=data)

    @staticmethod
    def send_to_broker(data: pd.DataFrame) -> None:
        """Publish processed measurements to the Kafka hourly-measurements topic.

        Args:
            data (pd.DataFrame): Processed measurements DataFrame.

        Raises:
            AirflowFailException: If message-broker processing fails (e.g. Kafka is down).
        """
        data = DataUtils.process_data_for_message_broker(data=data)
        if not isinstance(data, pd.DataFrame):
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)
