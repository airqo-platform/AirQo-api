from datetime import timedelta, datetime

from airflow.decorators import dag, task


@dag(
    "Historical-Raw-Weather-Measurements",
    schedule_interval=None,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "raw"],
)
def historical_raw_weather_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        return WeatherDataUtils.query_raw_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.transform_raw_data(data=data)

    @task()
    def save_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        bigquery_data = WeatherDataUtils.transform_for_bigquery(data=data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data, table=big_query_api.raw_weather_table
        )

    extracted_raw_data = extract()
    transformed_data = transform(extracted_raw_data)
    save_to_bigquery(transformed_data)


@dag(
    "Historical-Hourly-Weather-Measurements",
    schedule_interval=None,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "hourly"],
)
def historical_hourly_weather_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        return WeatherDataUtils.extract_raw_data_from_bigquery(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def average(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.resample_station_data(data=data)

    @task()
    def save_to_bigquery(weather_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=weather_data, table=big_query_api.hourly_weather_table
        )

    extracted_data = extract()
    averaged_data = average(extracted_data)
    save_to_bigquery(averaged_data)


@dag(
    "Weather-Measurements",
    schedule_interval="40 * * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "hourly", "raw"],
)
def weather_measurements_etl():
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

        return WeatherDataUtils.resample_station_data(data=data)

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


historical_raw_weather_measurements_etl_dag = historical_raw_weather_measurements_etl()
historical_hourly_weather_measurements_etl_dag = (
    historical_hourly_weather_measurements_etl()
)
weather_measurements_etl_dag = weather_measurements_etl()
