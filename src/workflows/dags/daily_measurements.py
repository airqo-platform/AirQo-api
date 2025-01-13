from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.daily_data_utils import DailyDataUtils
from datetime import timedelta
from dag_docs import (
    daily_measurements_clean_up_doc,
    daily_devices_measurements_realtime_doc,
    daily_devices_measurements_historical_doc,
)


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
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return DailyDataUtils.query_daily_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
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
    def extract():
        from airqo_etl_utils.date import date_to_str_days
        from datetime import datetime, timezone

        start_date_time = date_to_str_days(datetime.now(timezone.utc))
        end_date_time = datetime.strftime(
            datetime.now(timezone.utc), "%Y-%m-%dT23:00:00Z"
        )

        return DailyDataUtils.query_hourly_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def resample(data: pd.DataFrame):
        return DailyDataUtils.average_data(data=data)

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
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
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=7, **kwargs
        )
        return DailyDataUtils.query_hourly_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
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
