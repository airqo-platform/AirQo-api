from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "Nasa-Historical-Raw-Data",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["raw", "nasa", "historical"],
)
def nasa_historical_data():
    import pandas as pd

    @task()
    def extract_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )
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
    schedule="30 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["raw", "nasa", "realtime"],
)
def nasa_realtime_data():
    import pandas as pd

    @task()
    def extract_data():
        from airqo_etl_utils.purple_air_utils import PurpleDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_query_date_time_values()

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


nasa_realtime_data()
nasa_historical_data()
