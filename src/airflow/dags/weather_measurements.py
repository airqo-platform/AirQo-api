from datetime import timedelta, datetime

from airflow.decorators import dag, task


@dag(
    "Historical-Hourly-Weather-Measurements",
    schedule_interval=None,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "hourly"],
)
def historical_hourly_weather_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        from airqo_etl_utils.weather_data_utils import (
            extract_weather_data_from_tahmo,
        )
        from airqo_etl_utils.commons import fill_nan, get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        weather_data = extract_weather_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return dict({"data": fill_nan(data=weather_data)})

    @task()
    def load(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import un_fill_nan

        weather_data = un_fill_nan(inputs.get("data"))

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=weather_data, table=big_query_api.hourly_weather_table
        )

    extracted_data = extract()
    load(extracted_data)


@dag(
    "Hourly-Weather-Measurements",
    schedule_interval="40 * * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "hourly"],
)
def hourly_weather_measurements_etl():
    @task(multiple_outputs=True)
    def extract():
        from airqo_etl_utils.date import date_to_str_hours
        from airqo_etl_utils.weather_data_utils import (
            extract_weather_data_from_tahmo,
        )
        from airqo_etl_utils.commons import fill_nan

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        weather_data = extract_weather_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return dict({"data": fill_nan(data=weather_data)})

    @task()
    def load(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import un_fill_nan

        weather_data = un_fill_nan(inputs.get("data"))

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=weather_data, table=big_query_api.hourly_weather_table
        )

    extracted_data = extract()
    load(extracted_data)


historical_weather_measurements_etl_dag = historical_hourly_weather_measurements_etl()
hourly_weather_measurements_etl_dag = hourly_weather_measurements_etl()
