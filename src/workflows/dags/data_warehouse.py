from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from datetime import timedelta
from airqo_etl_utils.constants import Frequency, DataType, DeviceCategory
from airqo_etl_utils.datautils import DataUtils


@dag(
    "Consolidated-Data-ETL",
    schedule="0 0,12 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "consolidated data"],
)
def data_warehouse_consolidated_data():
    import pandas as pd
    from datetime import timedelta

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_low_cost_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=4, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_bam_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )

        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.BAM,
        )

        return DataWarehouseUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_sites_info(**kwargs):
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

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
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
    schedule="0 4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["consolidated data", "cleanup", "daily"],
)
def data_warehouse_cleanup_consolidated_data():
    import pandas as pd

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=5, kwargs=kwargs
        )
        return DataUtils.extract_data_from_bigquery(
            DataType.CONSOLIDATED,
            start_date_time,
            end_date_time,
            Frequency.HOURLY,
            DeviceCategory.GENERAL,
        )

    @task()
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils

        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task(
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
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

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=10),
    )
    def extract_hourly_low_cost_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_low_cost_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_hourly_bam_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_bam_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.data_warehouse_utils import DataWarehouseUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataWarehouseUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task(
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
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

    @task(
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
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

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=10),
    )
    def extract_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return DataUtils.extract_data_from_bigquery(
            DataType.CONSOLIDATED,
            start_date_time,
            end_date_time,
            Frequency.HOURLY,
            DeviceCategory.GENERAL,
        )

    @task()
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=10),
    )
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
