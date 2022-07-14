from datetime import datetime
from airflow.decorators import dag, task
from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "AirQo-Bam-Historical-Measurements",
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
        from airqo_etl_utils.airqo_utils import (
            extract_airqo_bam_data_from_thingspeak,
        )

        start_time, end_time = get_date_time_values(**kwargs)
        return extract_airqo_bam_data_from_thingspeak(
            start_time=start_time, end_time=end_time
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
    "AirQo-Bam-Realtime-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "bam", "realtime"],
)
def bam_realtime_measurements_etl():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_bam_data():
        from airqo_etl_utils.airqo_utils import extract_airqo_bam_data_from_thingspeak

        return extract_airqo_bam_data_from_thingspeak(
            start_time=start_time, end_time=end_time
        )

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

    extracted_data = extract_bam_data()
    load(extracted_data)


realtime_measurements_etl_dag = bam_realtime_measurements_etl()
historical_measurements_etl_dag = bam_historical_measurements_etl()
