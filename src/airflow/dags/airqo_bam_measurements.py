from datetime import datetime
from airflow.decorators import dag, task
from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "AirQo-Historical-Bam-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "historical", "bam"],
)
def bam_historical_measurements_etl():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_time, end_time = get_date_time_values(**kwargs)
        return AirQoDataUtils.extract_bam_data(
            start_date_time=start_time, end_date_time=end_time
        )

    @task()
    def extract_device_deployment_logs():

        from airqo_etl_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return logs

    @task()
    def process_data(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import map_site_ids_to_historical_measurements

        restructured_data = map_site_ids_to_historical_measurements(
            data=airqo_data, deployment_logs=deployment_logs
        )

        return restructured_data

    @task()
    def load(airqo_data: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import restructure_airqo_data

        from airqo_etl_utils.bigquery_api import BigQueryApi

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="bigquery"
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=airqo_restructured_data,
            table=big_query_api.bam_measurements_table,
        )

    extracted_airqo_data = extract_raw_data()
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = process_data(
        airqo_data=extracted_airqo_data, deployment_logs=device_logs
    )
    load(data_with_site_ids)


@dag(
    "AirQo-Realtime-Bam-Measurements",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "bam", "realtime"],
)
def bam_realtime_measurements_etl():
    import pandas as pd
    from airqo_etl_utils.constants import BamDataType

    @task()
    def extract_bam_data():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_realtime_date_time_values()

        return AirQoDataUtils.extract_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform_bam_data(bam_data: pd.DataFrame, data_type: BamDataType):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.process_bam_data(data=bam_data, data_type=data_type)

    @task()
    def load_outliers(bam_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bam_data,
            table=big_query_api.bam_outliers_table,
        )

    @task()
    def load_measurements(bam_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        bam_data = AirQoDataUtils.process_bam_measurements_for_bigquery(data=bam_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bam_data,
            table=big_query_api.bam_measurements_table,
        )

    data = extract_bam_data()
    measurements = transform_bam_data(bam_data=data, data_type=BamDataType.MEASUREMENTS)
    load_measurements(measurements)


realtime_measurements_etl_dag = bam_realtime_measurements_etl()
historical_measurements_etl_dag = bam_historical_measurements_etl()
