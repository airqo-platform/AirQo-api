import pandas as pd
from airflow.decorators import dag, task
from airflow.utils.dates import days_ago
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from datetime import timedelta
from airqo_etl_utils.config import configuration as Config
from airflow.exceptions import AirflowFailException


@dag(
    dag_id="Airnow-Historical-Bam-Data",
    schedule_interval=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    start_date=days_ago(1),
    tags=["bam", "airnow", "historical"],
)
def airnow_bam_historical_data():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def process_data(data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.process_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_message_broker(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=Config.HOURLY_MEASUREMENTS_TOPIC,
        )
        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.hourly_measurements_table

        processed_data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table
        )
        big_query_api.load_data(dataframe=processed_data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_api(data: pd.DataFrame, **kwargs):
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            from airqo_etl_utils.data_validator import DataValidationUtils
            from airqo_etl_utils.airqo_api import AirQoApi

            data = DataValidationUtils.process_data_for_api(data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=data)
        else:
            print("The send to API parameter has been set to false")

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_message_broker(processed_bam_data)
    send_to_bigquery(processed_bam_data)
    send_to_api(processed_bam_data)


@dag(
    dag_id="Airnow-Realtime-Bam-Data",
    schedule_interval="30 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    start_date=days_ago(1),
    tags=["bam", "airnow", "realtime"],
)
def airnow_bam_realtime_data():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        start_date_time, end_date_time = DateUtils.get_query_date_time_values(**kwargs)
        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def process_data(data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.process_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_message_broker(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=Config.HOURLY_MEASUREMENTS_TOPIC,
        )

        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.hourly_measurements_table

        processed_data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table
        )
        big_query_api.load_data(dataframe=processed_data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_api(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.airqo_api import AirQoApi

        data = DataValidationUtils.process_data_for_api(data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=data)

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_message_broker(processed_bam_data)
    send_to_bigquery(processed_bam_data)
    send_to_api(processed_bam_data)


airnow_bam_realtime_data()
airnow_bam_historical_data()
