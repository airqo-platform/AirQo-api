from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration
from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from airflow.utils.dates import days_ago
import pandas as pd
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.constants import DeviceCategory, DataType
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from datetime import timedelta
from airflow.exceptions import AirflowFailException


@dag(
    "AirQo-Historical-Bam-Measurements",
    schedule_interval=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "historical", "bam"],
    start_date=days_ago(1),
)
def airqo_bam_historical_measurements():
    from airqo_etl_utils.constants import Frequency

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )
        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
            resolution=Frequency.HISTORICAL,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_unclean_data(data: pd.DataFrame):
        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.UNCLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_bam_measurements_table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame) -> pd.DataFrame:
        return AirQoDataUtils.clean_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_clean_bam_data(data: pd.DataFrame):
        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.CLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.bam_measurements_table,
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
    from airqo_etl_utils.constants import Frequency

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.constants import DeviceCategory

        start_date_time, end_date_time = DateUtils.get_query_date_time_values(**kwargs)

        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.BAM,
            resolution=Frequency.RAW,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_unclean_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.UNCLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_bam_measurements_table,
        )

    @task()
    def clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_clean_bam_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import DataType
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.format_data_for_bigquery(
            data=data, data_type=DataType.CLEAN_BAM_DATA
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.bam_measurements_table,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def update_latest_data_topic(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.constants import DeviceCategory
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = AirQoDataUtils.process_latest_data(
            data=data, device_category=DeviceCategory.BAM
        )
        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=configuration.AVERAGED_HOURLY_MEASUREMENTS_TOPIC,
        )

        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(
            topic=configuration.AVERAGED_HOURLY_MEASUREMENTS_TOPIC, data=data
        )

    unclean_data = extract_bam_data()
    save_unclean_data(unclean_data)
    measurements = clean_bam_data(unclean_data)
    save_clean_bam_data(measurements)
    update_latest_data_topic(measurements)


airqo_bam_realtime_measurements()
airqo_bam_historical_measurements()
