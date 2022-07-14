from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Urban-Better-Historical-Raw-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["urban better", "raw", "historical"],
)
def historical_raw_measurements_etl():
    import pandas as pd

    @task()
    def extract_measures(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.urban_better_utils import (
            extract_urban_better_data_from_api,
        )

        start_time, end_time = get_date_time_values(**kwargs)
        raw_data = extract_urban_better_data_from_api(
            start_date_time=start_time, end_date_time=end_time
        )

        return raw_data

    @task()
    def extract_sensor_positions(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.urban_better_utils import (
            extract_urban_better_sensor_positions_from_api,
        )

        start_time, end_time = get_date_time_values(**kwargs)
        sensor_positions = extract_urban_better_sensor_positions_from_api(
            start_date_time=start_time, end_date_time=end_time
        )

        return sensor_positions

    @task()
    def merge_data(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import merge_urban_better_data

        data = merge_urban_better_data(
            measures=devices_measures, sensor_positions=sensor_positions
        )

        return data

    @task()
    def load(urban_better_data: pd.DataFrame, **kwargs):

        from airqo_etl_utils.urban_better_utils import process_for_big_query

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            from airqo_etl_utils.bigquery_api import BigQueryApi

            restructured_data = process_for_big_query(dataframe=urban_better_data)
            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=restructured_data,
                table=big_query_api.raw_mobile_measurements_table,
            )
        else:
            raise Exception(
                "Invalid data destination. Valid values are bigquery, message-broker and api"
            )

    devices_measures_data = extract_measures()
    sensor_positions_data = extract_sensor_positions()
    merged_data = merge_data(
        devices_measures=devices_measures_data, sensor_positions=sensor_positions_data
    )
    load(merged_data)


@dag(
    "Urban-Better-Realtime-Raw-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["urban better", "realtime", "raw"],
)
def realtime_measurements_etl():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_measures():
        from airqo_etl_utils.urban_better_utils import (
            extract_urban_better_data_from_api,
        )

        raw_data = extract_urban_better_data_from_api(
            start_date_time=start_time, end_date_time=end_time
        )

        return raw_data

    @task()
    def extract_sensor_positions():
        from airqo_etl_utils.urban_better_utils import (
            extract_urban_better_sensor_positions_from_api,
        )

        sensor_positions = extract_urban_better_sensor_positions_from_api(
            start_date_time=start_time, end_date_time=end_time
        )

        return sensor_positions

    @task()
    def merge_data(devices_measures: pd.DataFrame, sensor_positions: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import merge_urban_better_data

        data = merge_urban_better_data(
            measures=devices_measures, sensor_positions=sensor_positions
        )

        return data

    @task()
    def load(urban_better_data: pd.DataFrame):

        from airqo_etl_utils.urban_better_utils import process_for_big_query
        from airqo_etl_utils.bigquery_api import BigQueryApi

        restructured_data = process_for_big_query(dataframe=urban_better_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=restructured_data,
            table=big_query_api.raw_mobile_measurements_table,
        )

    devices_measures_data = extract_measures()
    sensor_positions_data = extract_sensor_positions()
    merged_data = merge_data(
        devices_measures=devices_measures_data, sensor_positions=sensor_positions_data
    )
    load(merged_data)


realtime_measurements_etl_dag = realtime_measurements_etl()
historical_raw_measurements_etl_dag = historical_raw_measurements_etl()
