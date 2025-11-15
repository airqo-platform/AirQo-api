from datetime import timedelta, datetime
import pandas as pd
from airflow.decorators import dag, task

from airqo_etl_utils.constants import DataType, Frequency
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.weather_data_utils import WeatherDataUtils


@dag(
    "Historical-Raw-Weather-Measurements",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "historical", "raw"],
)
def weather_data_historical_raw_measurements():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )

        return WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.transform_weather_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(data: pd.DataFrame):
        bigquery_data = DataUtils.transform_for_bigquery_weather(data=data)

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
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )

        return WeatherDataUtils.extract_weather_data(
            DataType.RAW,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
            remove_outliers=False,
        )

    @task()
    def average(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.aggregate_weather_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(weather_data: pd.DataFrame):
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
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )

        return WeatherDataUtils.extract_weather_data(
            DataType.RAW,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
            remove_outliers=False,
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return WeatherDataUtils.extract_weather_data(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            remove_outliers=False,
        )

    @task()
    def remove_duplicated_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [data.station_code.name]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.station_code.name,
            group_col=data.station_code.name,
            exclude_cols=exclude_cols,
        )

    @task()
    def remove_duplicated_hourly_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [data.station_code.name]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.station_code.name,
            group_col=data.station_code.name,
            exclude_cols=exclude_cols,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load_raw_data(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        big_query_api.reload_data(dataframe=data, table=big_query_api.raw_weather_table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load_hourly_data(data: pd.DataFrame):
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
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.date import date_to_str

        execution_date = kwargs["dag_run"].execution_date
        hour_of_day = execution_date - timedelta(hours=1)
        start_date_time = date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:00:00Z")
        end_date_time = date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:59:59Z")

        return WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.transform_weather_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_raw_data_to_bigquery(data: pd.DataFrame):
        bigquery_data = DataUtils.transform_for_bigquery_weather(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.raw_weather_table
        )

    @task()
    def average_raw_data(data: pd.DataFrame) -> pd.DataFrame:

        return DataUtils.aggregate_weather_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_hourly_data_to_bigquery(data: pd.DataFrame):
        bigquery_data = DataUtils.transform_for_bigquery_weather(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.hourly_weather_table
        )

    raw_data = extract()
    transformed_data = transform(raw_data)
    save_raw_data_to_bigquery(transformed_data)
    averaged_data = average_raw_data(transformed_data)
    save_hourly_data_to_bigquery(averaged_data)


@dag(
    "OpenWeatherMap-Weather-Measurements",
    schedule="0 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["weather", "openweathermap"],
)
def openweathermap_data():
    @task()
    def retrieve_sites():
        return DataUtils.get_sites()

    @task()
    def retrieve_weather_data(sites):
        return WeatherDataUtils.fetch_openweathermap_data_for_sites(sites=sites)

    @task()
    def save_weather_data(data):
        bigquery_api = BigQueryApi()
        bigquery_api.load_data(dataframe=data, table=bigquery_api.openweathermap_table)

    sites = retrieve_sites()
    weather_data = retrieve_weather_data(sites=sites)
    save_weather_data(data=weather_data)


weather_data_historical_raw_measurements()
weather_data_historical_hourly_measurements()
weather_data_realtime()
weather_data_cleanup_measurements()
openweathermap_data()
