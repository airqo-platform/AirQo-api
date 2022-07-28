from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Airnow-Historical-Bam-Data",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["bam", "airnow", "historical"],
)
def airnow_bam_historical_data_etl():
    import pandas as pd

    @task()
    def extract_bam_data(**kwargs):
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def process_data(airnow_data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.process_bam_data(data=airnow_data)

    @task()
    def send_to_bigquery(airnow_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        bam_data = AirnowDataUtils.process_for_bigquery(airnow_data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(bam_data, table=big_query_api.hourly_measurements_table)

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


@dag(
    "Airnow-Realtime-Bam-Data",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["bam", "airnow", "realtime"],
)
def airnow_bam_realtime_data_etl():
    import pandas as pd

    @task()
    def extract_bam_data():
        from airqo_etl_utils.airnow_utils import AirnowDataUtils
        from datetime import datetime, timedelta

        now = datetime.utcnow()

        start_date_time = datetime.strftime(now, "%Y-%m-%dT%H:00")
        end_date_time = datetime.strftime(now - timedelta(hours=1), "%Y-%m-%dT%H:00")
        return AirnowDataUtils.extract_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def process_data(airnow_data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        return AirnowDataUtils.process_bam_data(data=airnow_data)

    @task()
    def send_to_bigquery(airnow_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airnow_utils import AirnowDataUtils

        bam_data = AirnowDataUtils.process_for_bigquery(airnow_data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(bam_data, table=big_query_api.hourly_measurements_table)

    @task()
    def send_measurements_to_api(airnow_data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import restructure_airnow_data_for_api_storage

        restructured_data = restructure_airnow_data_for_api_storage(data=airnow_data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=restructured_data, tenant="airqo")

    extracted_bam_data = extract_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


airnow_bam_realtime_data_etl_dag = airnow_bam_realtime_data_etl()
airnow_bam_historical_data_etl_dag = airnow_bam_historical_data_etl()
