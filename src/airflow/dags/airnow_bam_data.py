from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "Airnow-Bam-Data",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["bam", "airnow"],
)
def airnow_bam_data_etl():
    import pandas as pd
    from datetime import datetime, timedelta

    date_time = datetime.strftime(
        datetime.utcnow() - timedelta(hours=1), "%Y-%m-%dT%H:00"
    )

    @task()
    def extract_usa_embassies_bam_data():
        from airqo_etl_utils.airnow_utils import extract_airnow_data_from_api

        return extract_airnow_data_from_api(
            start_date_time=date_time, end_date_time=date_time
        )

    @task()
    def process_data(airnow_data: pd.DataFrame):
        from airqo_etl_utils.airnow_utils import process_airnow_data

        return process_airnow_data(data=airnow_data)

    @task()
    def send_to_bigquery(airnow_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            airnow_data, table=big_query_api.hourly_measurements_table
        )

    extracted_bam_data = extract_usa_embassies_bam_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


airnow_bam_data_etl_dag = airnow_bam_data_etl()
