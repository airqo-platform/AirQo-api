from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Cleanup-Forecast-Measurements",
    schedule="30 */4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["forecast", "cleanup"],
)
def cleanup_measurements():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        from airqo_etl_utils.forecast_data_utils import ForecastDataUtils

        return ForecastDataUtils.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def cleanup_and_load(data: pd.DataFrame):
        from airqo_etl_utils.forecast_data_utils import ForecastDataUtils

        ForecastDataUtils.cleanup_and_reload(data=data)

    forecast_data = extract()
    cleanup_and_load(forecast_data)


@dag(
    "Realtime-Forecast-Measurements",
    schedule="0 */4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["realtime", "forecast"],
)
def realtime_forecast_measurements():
    import pandas as pd

    @task()
    def extract():
        from airqo_etl_utils.forecast_data_utils import ForecastDataUtils

        return ForecastDataUtils.extract_data_from_api()

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.forecast_data_utils import ForecastDataUtils

        ForecastDataUtils.save_data(data=data)

    forecast_data = extract()
    load(forecast_data)


realtime_forecast_measurements()
cleanup_measurements()
