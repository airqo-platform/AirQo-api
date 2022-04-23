from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "Data-Warehouse-ETL",
    schedule_interval="@weekly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "data-warehouse"],
)
def data_warehouse_etl():
    @task(multiple_outputs=True)
    def extract_hourly_measurements(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import (
            query_hourly_measurements,
        )
        from airqo_etl_utils.commons import get_date_time_values, fill_nan

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        hourly_device_measurements = query_hourly_measurements(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return dict({"data": fill_nan(data=hourly_device_measurements)})

    @task(multiple_outputs=True)
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import (
            query_hourly_weather_data,
        )
        from airqo_etl_utils.commons import get_date_time_values, fill_nan

        start_date_time, end_date_time = get_date_time_values(
            **kwargs, interval_in_days=7
        )
        hourly_weather_measurements = query_hourly_weather_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

        return dict({"data": fill_nan(data=hourly_weather_measurements)})

    @task()
    def extract_sites_meta_data():
        from airqo_etl_utils.commons import fill_nan
        from airqo_etl_utils.data_warehouse_utils import (
            extract_sites_meta_data,
        )

        sites_data = extract_sites_meta_data()

        return dict({"data": fill_nan(data=sites_data)})

    @task(multiple_outputs=True)
    def merge_data(measurements_data: dict, weather_data: dict, sites_data: dict):
        from airqo_etl_utils.commons import un_fill_nan, fill_nan

        from airqo_etl_utils.data_warehouse_utils import (
            merge_measurements_weather_sites,
        )

        hourly_device_measurements = un_fill_nan(measurements_data.get("data"))
        hourly_weather_measurements = un_fill_nan(weather_data.get("data"))
        sites = un_fill_nan(sites_data.get("data"))
        data = merge_measurements_weather_sites(
            measurements_data=hourly_device_measurements,
            weather_data=hourly_weather_measurements,
            sites=sites,
        )

        return dict({"data": fill_nan(data=data)})

    @task()
    def load(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import un_fill_nan

        data = un_fill_nan(inputs.get("data"))

        big_query_api = BigQueryApi()
        big_query_api.save_data(data=data, table=big_query_api.analytics_table)

    hourly_measurements = extract_hourly_measurements()
    hourly_weather_data = extract_hourly_weather_data()
    sites_meta_data = extract_sites_meta_data()
    merged_data = merge_data(
        measurements_data=hourly_measurements,
        weather_data=hourly_weather_data,
        sites_data=sites_meta_data,
    )
    load(merged_data)


data_warehouse_etl_dag = data_warehouse_etl()
