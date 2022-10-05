from datetime import timedelta, datetime

from airflow.decorators import dag, task


@dag(
    "Historical-Raw-Weather-Measurements",
    schedule_interval="0 1 * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "raw"],
)
def historical_raw_weather_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
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
    schedule_interval="0 6 * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "hourly"],
)
def historical_hourly_weather_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
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
    schedule_interval="0 11 * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "cleanup"],
)
def cleanup_weather_measurements_etl():
    import pandas as pd
    from airqo_etl_utils.constants import Frequency

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
    def remove_duplicates(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.remove_duplicates(data=data)

    @task()
    def load(data: pd.DataFrame, frequency: Frequency):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()

        if frequency == Frequency.RAW:
            big_query_api.reload_data(
                dataframe=data, table=big_query_api.raw_weather_table
            )
        elif frequency == Frequency.HOURLY:
            big_query_api.reload_data(
                dataframe=data, table=big_query_api.hourly_weather_table
            )

    raw_data = extract_raw_data()
    hourly_data = extract_hourly_data()
    clean_raw_data = remove_duplicates(raw_data)
    clean_hourly_data = remove_duplicates(hourly_data)
    load(data=clean_raw_data, frequency=Frequency.RAW)
    load(data=clean_hourly_data, frequency=Frequency.HOURLY)


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


historical_raw_weather_measurements_etl_dag = historical_raw_weather_measurements_etl()
historical_hourly_weather_measurements_etl_dag = (
    historical_hourly_weather_measurements_etl()
)
weather_measurements_etl_dag = weather_measurements_etl()
cleanup_weather_measurements_etl_dag = cleanup_weather_measurements_etl()
