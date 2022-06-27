from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Data-Warehouse-ETL",
    schedule_interval="@weekly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "data-warehouse"],
)
def data_warehouse_etl():
    import pandas as pd

    @task()
    def extract_hourly_measurements(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import (
            query_hourly_measurements,
        )
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(
            **kwargs, interval_in_days=7
        )

        hourly_device_measurements = query_hourly_measurements(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return hourly_device_measurements

    @task()
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import (
            query_hourly_weather_data,
        )
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(
            **kwargs, interval_in_days=7
        )
        hourly_weather_measurements = query_hourly_weather_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return hourly_weather_measurements

    @task()
    def extract_sites_meta_data():
        from airqo_etl_utils.data_warehouse_utils import (
            extract_sites_meta_data,
        )

        sites_data = extract_sites_meta_data()

        return sites_data

    @task()
    def merge_data(
        measurements_data: pd.DataFrame,
        weather_data: pd.DataFrame,
        sites_data: pd.DataFrame,
    ):
        from airqo_etl_utils.data_warehouse_utils import (
            merge_measurements_weather_sites,
        )

        data = merge_measurements_weather_sites(
            measurements_data=measurements_data,
            weather_data=weather_data,
            sites=sites_data,
        )

        return data

    @task()
    def reload(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(
            **kwargs, interval_in_days=7
        )

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data,
            table=big_query_api.analytics_table,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            tenant="airqo",
        )

    hourly_measurements = extract_hourly_measurements()
    hourly_weather_data = extract_hourly_weather_data()
    sites_meta_data = extract_sites_meta_data()
    merged_data = merge_data(
        measurements_data=hourly_measurements,
        weather_data=hourly_weather_data,
        sites_data=sites_meta_data,
    )
    reload(merged_data)


data_warehouse_etl_dag = data_warehouse_etl()
