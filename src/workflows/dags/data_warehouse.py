from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "Consolidated-Data-ETL",
    schedule="0 0 * * */3",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "consolidated data"],
)
def data_warehouse_consolidated_data():
    import pandas as pd

    @task()
    def extract_hourly_low_cost_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=4, kwargs=kwargs
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
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.consolidated_data_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        big_query_api.load_data(
            dataframe=data,
            table=table,
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
    schedule="0 0 * * */4 ",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["consolidated data", "cleanup"],
)
def data_warehouse_cleanup_consolidated_data():
    import pandas as pd

    @task()
    def extract_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=5, kwargs=kwargs
        )

        return DataWarehouseUtils.extract_data_from_big_query(
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


@dag(
    "Historical-Consolidated-Data-ETL",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "consolidated data", "historical"],
)
def data_warehouse_historical_consolidated_data():
    import pandas as pd

    @task()
    def extract_hourly_low_cost_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_hourly_bam_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
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
        from airqo_etl_utils.data_validator import DataValidationUtils

        big_query_api = BigQueryApi()
        table = big_query_api.consolidated_data_table
        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=table,
        )

        big_query_api.load_data(
            dataframe=data,
            table=table,
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
    "Historical-Cleanup-Consolidated-Data",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["consolidated data", "cleanup", "historical"],
)
def data_warehouse_historical_cleanup_consolidated_data():
    import pandas as pd

    @task()
    def extract_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_data_from_big_query(
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


data_warehouse_consolidated_data()
data_warehouse_cleanup_consolidated_data()
data_warehouse_historical_consolidated_data()
data_warehouse_historical_cleanup_consolidated_data()
