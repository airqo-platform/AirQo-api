from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Data-Warehouse-ETL",
    schedule_interval="@weekly",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["hourly", "data warehouse"],
)
def data_warehouse_etl():
    import pandas as pd

    @task()
    def extract_hourly_low_cost_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, kwargs=kwargs
        )

        return DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_hourly_bam_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, kwargs=kwargs
        )

        return DataWarehouseUtils.extract_hourly_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, kwargs=kwargs
        )

        return DataWarehouseUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_sites_meta_data():
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        return DataWarehouseUtils.extract_sites_meta_data()

    @task()
    def merge_bam_low_cost_and_weather_data(
        low_cost_data, bam_data, weather_data, sites_data
    ):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        return DataWarehouseUtils.merge_bam_low_cost_and_weather_data(
            bam_data=bam_data,
            low_cost_data=low_cost_data,
            weather_data=weather_data,
            sites_data=sites_data,
        )

    @task()
    def load(data: pd.DataFrame, **kwargs):
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
        )

    hourly_low_cost_data = extract_hourly_low_cost_data()
    hourly_bam_data = extract_hourly_bam_data()
    hourly_weather_data = extract_hourly_weather_data()
    sites_meta_data = extract_sites_meta_data()
    merged_data = merge_bam_low_cost_and_weather_data(
        low_cost_data=hourly_low_cost_data,
        bam_data=hourly_bam_data,
        weather_data=hourly_weather_data,
        sites_data=sites_meta_data,
    )
    load(merged_data)


data_warehouse_etl_dag = data_warehouse_etl()
