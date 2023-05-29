from datetime import timedelta, datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Historical-Raw-Weather-Measurements",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "historical", "raw"],
)
def weather_data_historical_raw_measurements():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True,days=7, **kwargs
        )
        return WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.transform_raw_data(data=data)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        bigquery_data = WeatherDataUtils.transform_for_bigquery(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.raw_weather_table
        )

    extracted_raw_data = extract()
    transformed_data = transform(extracted_raw_data)
    load(transformed_data)


@dag(
    "Historical-Hourly-Weather-Measurements",
    schedule="0 6 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "historical", "hourly"],
)
def weather_data_historical_hourly_measurements():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=7, **kwargs
        )
        return WeatherDataUtils.extract_raw_data_from_bigquery(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def average(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.aggregate_data(data=data)

    @task()
    def load(weather_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=weather_data, table=big_query_api.hourly_weather_table
        )

    extracted_data = extract()
    averaged_data = average(extracted_data)
    load(averaged_data)


@dag(
    "Cleanup-Weather-Measurements",
    schedule="0 11 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "cleanup"],
)
def weather_data_cleanup_measurements():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return WeatherDataUtils.extract_raw_data_from_bigquery(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def remove_duplicated_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.remove_duplicates(data=data)

    @task()
    def remove_duplicated_hourly_data(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.remove_duplicates(data=data)

    @task()
    def load_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.reload_data(dataframe=data, table=big_query_api.raw_weather_table)

    @task()
    def load_hourly_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.hourly_weather_table
        )

    raw_data = extract_raw_data()
    hourly_data = extract_hourly_data()
    clean_raw_data = remove_duplicated_raw_data(raw_data)
    clean_hourly_data = remove_duplicated_hourly_data(hourly_data)
    load_raw_data(data=clean_raw_data)
    load_hourly_data(data=clean_hourly_data)


@dag(
    "Weather-Measurements",
    schedule="40 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "hourly", "raw"],
)
def weather_data_realtime():
    import pandas as pd

    @task()
    def extract() -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import date_to_str_hours

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.transform_raw_data(data=data)

    @task()
    def save_raw_data_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        bigquery_data = WeatherDataUtils.transform_for_bigquery(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.raw_weather_table
        )

    @task()
    def average_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.aggregate_data(data=data)

    @task()
    def save_hourly_data_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        bigquery_data = WeatherDataUtils.transform_for_bigquery(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.hourly_weather_table
        )

    raw_data = extract()
    transformed_data = transform(raw_data)
    save_raw_data_to_bigquery(transformed_data)
    averaged_data = average_raw_data(transformed_data)
    save_hourly_data_to_bigquery(averaged_data)


weather_data_historical_raw_measurements()
weather_data_historical_hourly_measurements()
weather_data_realtime()
weather_data_cleanup_measurements()
