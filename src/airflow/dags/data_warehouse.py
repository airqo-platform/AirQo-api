from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Consolidated-Data-ETL",
    schedule_interval="0 1 * * 1",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["hourly", "consolidated data"],
)
def consolidated_data_etl():
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
    def extract_sites_info():
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        return DataWarehouseUtils.extract_sites_meta_data()

    @task()
    def merge_datasets(low_cost_data, bam_data, weather_data, sites_data):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        return DataWarehouseUtils.merge_datasets(
            bam_data=bam_data,
            low_cost_data=low_cost_data,
            weather_data=weather_data,
            sites_info=sites_data,
        )

    @task()
    def load(data: pd.DataFrame):

        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.analytics_table,
        )

    hourly_low_cost_data = extract_hourly_low_cost_data()
    hourly_bam_data = extract_hourly_bam_data()
    hourly_weather_data = extract_hourly_weather_data()
    sites_info = extract_sites_info()
    merged_data = merge_datasets(
        low_cost_data=hourly_low_cost_data,
        bam_data=hourly_bam_data,
        weather_data=hourly_weather_data,
        sites_data=sites_info,
    )
    load(merged_data)


@dag(
    "Cleanup-Consolidated-Data",
    schedule_interval="0 4 * * 1",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["consolidated data", "cleanup"],
)
def cleanup_consolidated_data_etl():
    import pandas as pd

    @task()
    def extract_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, kwargs=kwargs
        )

        return DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        return DataWarehouseUtils.remove_duplicates(data=data)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.consolidated_data_table
        )

    consolidated_data = extract_data()
    clean_consolidated_data = remove_duplicates(consolidated_data)
    load(clean_consolidated_data)


consolidated_data_etl_dag = consolidated_data_etl()
cleanup_consolidated_data_etl_dag = cleanup_consolidated_data_etl()
