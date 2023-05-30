from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Cleanup-Daily-Measurements",
    schedule="0 11 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "cleanup"],
)
def cleanup_measurements():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        return DailyDataUtils.query_daily_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def cleanup_and_load(data: pd.DataFrame):
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        DailyDataUtils.cleanup_and_reload(data=data)

    daily_data = extract()
    cleanup_and_load(data=daily_data)


@dag(
    "Realtime-Daily-Measurements",
    schedule="50 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["realtime", "daily"],
)
def realtime_daily_measurements():
    import pandas as pd

    def extract():
        from airqo_etl_utils.daily_data_utils import DailyDataUtils
        from airqo_etl_utils.date import date_to_str_days
        from datetime import datetime

        start_date_time = date_to_str_days(datetime.utcnow())
        end_date_time = datetime.strftime(datetime.utcnow(), "%Y-%m-%dT23:00:00Z")

        return DailyDataUtils.query_hourly_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def resample(data: pd.DataFrame):
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        return DailyDataUtils.average_data(data=data)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        DailyDataUtils.save_data(data=data)

    daily_data = extract()
    resampled_data = resample(daily_data)
    load(resampled_data)


@dag(
    "Historical-Daily-Measurements",
    schedule="0 0 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "historical"],
)
def historical_daily_measurements():
    import pandas as pd

    @task()
    def extract(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True,days=7, **kwargs
        )
        return DailyDataUtils.query_hourly_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def resample(data: pd.DataFrame):
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        return DailyDataUtils.average_data(data=data)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.daily_data_utils import DailyDataUtils

        DailyDataUtils.save_data(data=data)

    daily_data = extract()
    resampled_data = resample(daily_data)
    load(resampled_data)


historical_daily_measurements()
realtime_daily_measurements()
cleanup_measurements()
