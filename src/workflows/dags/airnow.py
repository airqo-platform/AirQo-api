import pandas as pd
from airflow.decorators import dag, task
from airflow.utils.dates import days_ago
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.airnow_utils import AirnowDataUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from datetime import timedelta


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
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)
        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def process_data(data: pd.DataFrame):
        return AirnowDataUtils.process_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_message_broker(data: pd.DataFrame, **kwargs):
        return AirnowDataUtils.send_to_broker(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_bigquery(data: pd.DataFrame):
        return AirnowDataUtils.send_to_bigquery(data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_api(data: pd.DataFrame, **kwargs):
        return AirnowDataUtils.send_to_api(data, kwargs)

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
        start_date_time, end_date_time = DateUtils.get_query_date_time_values(**kwargs)
        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def process_data(data: pd.DataFrame):
        return AirnowDataUtils.process_bam_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_message_broker(data: pd.DataFrame):
        return AirnowDataUtils.send_to_broker(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_bigquery(data: pd.DataFrame):
        return AirnowDataUtils.send_to_bigquery(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_to_api(data: pd.DataFrame, **kwargs):
        return AirnowDataUtils.send_to_api(data=data)

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_message_broker(processed_bam_data)
    send_to_bigquery(processed_bam_data)
    send_to_api(processed_bam_data)


airnow_bam_realtime_data()
airnow_bam_historical_data()
