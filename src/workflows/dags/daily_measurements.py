from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.daily_data_utils import DailyDataUtils
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.datautils import DataUtils
from datetime import timedelta
from dag_docs import (
    daily_measurements_clean_up_doc,
    daily_devices_measurements_realtime_doc,
    daily_devices_measurements_historical_doc,
)
from airqo_etl_utils.constants import Frequency, DataType, DeviceCategory


@dag(
    "Cleanup-Daily-Measurements",
    schedule="0 11 * * *",
    doc_md=daily_measurements_clean_up_doc,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "cleanup"],
)
def cleanup_measurements():
    import pandas as pd

    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=10),
    )
    def extract(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )

        return DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.GENERAL,
            frequency=Frequency.DAILY,
        )

    @task(retries=3, retry_delay=timedelta(minutes=10))
    def cleanup_and_load(data: pd.DataFrame):
        DailyDataUtils.cleanup_and_reload(data=data)

    daily_data = extract()
    cleanup_and_load(data=daily_data)


@dag(
    "Realtime-Daily-Measurements",
    schedule="50 * * * *",
    doc_md=daily_devices_measurements_realtime_doc,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["realtime", "daily"],
)
def realtime_daily_measurements():
    import pandas as pd

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract(**kwargs):
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.GENERAL,
            frequency=Frequency.HOURLY,
        )

    @task()
    def resample(data: pd.DataFrame):
        return DailyDataUtils.average_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(data: pd.DataFrame):
        DailyDataUtils.save_data(data=data)

    daily_data = extract()
    resampled_data = resample(daily_data)
    load(resampled_data)


@dag(
    "Historical-Daily-Measurements",
    schedule="0 0 * * *",
    doc_md=daily_devices_measurements_historical_doc,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "historical"],
)
def historical_daily_measurements():
    import pandas as pd

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract(**kwargs):
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )

        return DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.GENERAL,
            frequency=Frequency.HOURLY,
        )

    @task()
    def resample(data: pd.DataFrame):
        return DailyDataUtils.average_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(data: pd.DataFrame):
        DailyDataUtils.save_data(data=data)

    daily_data = extract()
    resampled_data = resample(daily_data)
    load(resampled_data)


historical_daily_measurements()
realtime_daily_measurements()
cleanup_measurements()
