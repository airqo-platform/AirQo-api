from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from airflow.utils.dates import days_ago
import pandas as pd
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from datetime import timedelta
from airflow.exceptions import AirflowFailException
from airqo_etl_utils.constants import Frequency, DeviceNetwork, DeviceCategory, DataType


@dag(
    "AirQo-Historical-Bam-Measurements",
    schedule_interval=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "historical", "bam"],
    start_date=days_ago(1),
)
def airqo_bam_historical_measurements():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
            device_network=DeviceNetwork.AIRQO,
            resolution=Frequency.HISTORICAL,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_unclean_data(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        data = DataUtils.clean_bam_data(
            data=data, datatype=DataType.RAW, frequency=Frequency.RAW
        )
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.BAM, Frequency.RAW
        )
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.clean_bam_data(
            data=data, datatype=DataType.AVERAGED, frequency=Frequency.HOURLY
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_clean_bam_data(data: pd.DataFrame):
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.BAM, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    unclean_data = extract_bam_data()
    save_unclean_data(unclean_data)
    measurements = clean_bam_data(unclean_data)
    save_clean_bam_data(measurements)


airqo_bam_historical_measurements_dag = airqo_bam_historical_measurements()


@dag(
    "AirQo-Realtime-Bam-Measurements",
    schedule="30 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "bam", "realtime"],
)
def airqo_bam_realtime_measurements():
    import pandas as pd

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_query_date_time_values(**kwargs)

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
            device_network=DeviceNetwork.AIRQO,
            resolution=Frequency.RAW,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_unclean_data(data: pd.DataFrame):
        data = DataUtils.clean_bam_data(
            data=data, datatype=DataType.RAW, frequency=Frequency.RAW
        )
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.BAM, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame):
        return DataUtils.clean_bam_data(
            data=data, datatype=DataType.AVERAGED, frequency=Frequency.HOURLY
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_clean_bam_data(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.BAM, Frequency.HOURLY
        )
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def update_latest_data_topic(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        data = AirQoDataUtils.process_latest_data(
            data=data, device_category=DeviceCategory.BAM
        )
        data = DataUtils.process_data_for_message_broker(
            data=data,
        )

        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(
            topic=Config.AVERAGED_HOURLY_MEASUREMENTS_TOPIC, data=data
        )

    unclean_data = extract_bam_data()
    save_unclean_data(unclean_data)
    measurements = clean_bam_data(unclean_data)
    save_clean_bam_data(measurements)
    update_latest_data_topic(measurements)


@dag(
    "AirQo-BAM-Measurements-Cleanup",
    schedule="*/45 * * * *",
    catchup=False,
    tags=["airqo", "bam", "raw", "hourly", "cleanup"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_bam_measurements_cleanup():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=10, **kwargs
        )
        data = DataUtils.extract_data_from_bigquery(
            DataType.RAW,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
            device_category=DeviceCategory.BAM,
        )
        return DataValidationUtils.remove_outliers_fix_types(
            data, remove_outliers=False
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=15, **kwargs
        )
        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.BAM,
        )
        return DataValidationUtils.remove_outliers_fix_types(data)

    @task()
    def remove_duplicated_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task()
    def remove_duplicated_hourly_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def load_raw_data(data: pd.DataFrame):

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.raw_bam_measurements_table
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def load_hourly_data(data: pd.DataFrame):

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.bam_hourly_measurements_table
        )

    raw_data = extract_raw_data()
    hourly_data = extract_hourly_data()
    clean_raw_data = remove_duplicated_raw_data(raw_data)
    clean_hourly_data = remove_duplicated_hourly_data(hourly_data)
    load_raw_data(data=clean_raw_data)
    load_hourly_data(data=clean_hourly_data)


airqo_bam_realtime_measurements()
airqo_bam_historical_measurements()
airqo_bam_measurements_cleanup()
