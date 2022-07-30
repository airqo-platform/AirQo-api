from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Nasa-Historical-Raw-Data",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["raw", "nasa", "historical"],
)
def nasa_historical_data_etl():
    import pandas as pd

    @task()
    def extract_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_gad_date_time_values(**kwargs)
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils

        return PurpleDataUtils.extract_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def process_data(data: pd.DataFrame):
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils

        return PurpleDataUtils.process_data(data=data)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils

        bigquery_data = PurpleDataUtils.process_for_bigquery(data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            bigquery_data, table=big_query_api.raw_measurements_table
        )

    extracted_bam_data = extract_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


@dag(
    "Nasa-Realtime-Raw-Data",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["raw", "nasa", "realtime"],
)
def nasa_realtime_data_etl():
    import pandas as pd

    @task()
    def extract_data():
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_realtime_date_time_values()

        return PurpleDataUtils.extract_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def process_data(data: pd.DataFrame):
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils

        return PurpleDataUtils.process_data(data=data)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils

        bigquery_data = PurpleDataUtils.process_for_bigquery(data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            bigquery_data, table=big_query_api.raw_measurements_table
        )

    extracted_bam_data = extract_data()
    processed_bam_data = process_data(extracted_bam_data)
    send_to_bigquery(processed_bam_data)


nasa_realtime_data_etl_dag = nasa_realtime_data_etl()
nasa_historical_data_etl_dag = nasa_historical_data_etl()
