from datetime import timedelta, datetime

import pandas as pd
from airflow.decorators import dag, task


@dag(
    "Historical-Raw-Weather-Measurements",
    schedule_interval=None,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "historical", "raw"],
)
def historical_raw_weather_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        from airqo_etl_utils.weather_data_utils import (
            extract_weather_data_from_tahmo,
        )
        from airqo_etl_utils.commons import to_xcom_format, get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        weather_data = extract_weather_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time, frequency=None
        )

        return dict({"data": to_xcom_format(data=weather_data)})

    @task()
    def save_to_bigquery(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import from_xcom_format

        from airqo_etl_utils.weather_data_utils import (
            transform_weather_data_for_bigquery,
        )

        weather_data = from_xcom_format(inputs.get("data"))
        bigquery_data = transform_weather_data_for_bigquery(data=weather_data)

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=bigquery_data, table=big_query_api.raw_weather_table
        )

    extracted_raw_data = extract()
    save_to_bigquery(extracted_raw_data)


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
        from airqo_etl_utils.commons import to_xcom_format, get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        weather_data = extract_weather_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return dict({"data": to_xcom_format(data=weather_data)})

    @task()
    def save_to_bigquery(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import from_xcom_format

        from airqo_etl_utils.weather_data_utils import (
            transform_weather_data_for_bigquery,
        )

        weather_data = from_xcom_format(inputs.get("data"))
        bigquery_data = transform_weather_data_for_bigquery(data=weather_data)

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=bigquery_data, table=big_query_api.hourly_weather_table
        )

    extracted_data = extract()
    save_to_bigquery(extracted_data)


@dag(
    "Weather-Measurements",
    schedule_interval="40 * * * *",
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["weather", "hourly", "raw"],
)
def weather_measurements_etl():
    @task()
    def extract_raw_data():
        from airqo_etl_utils.date import date_to_str_hours
        from airqo_etl_utils.weather_data_utils import (
            query_weather_data_from_tahmo,
        )

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        raw_weather_data = query_weather_data_from_tahmo(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

        return raw_weather_data

    @task()
    def create_hourly_data(raw_weather_data: pd.DataFrame):
        from airqo_etl_utils.weather_data_utils import (
            resample_weather_data,
            add_site_info_to_weather_data,
        )

        resampled_weather_data = resample_weather_data(
            data=raw_weather_data,
            frequency="hourly",
        )
        sites_weather_data = add_site_info_to_weather_data(data=resampled_weather_data)

        return sites_weather_data

    @task()
    def format_raw_data(raw_weather_data: pd.DataFrame):
        from airqo_etl_utils.weather_data_utils import (
            resample_weather_data,
            add_site_info_to_weather_data,
        )

        resampled_weather_data = resample_weather_data(
            data=raw_weather_data,
            frequency=None,
        )
        sites_weather_data = add_site_info_to_weather_data(data=resampled_weather_data)

        return sites_weather_data

    @task()
    def save_raw_data_to_bigquery(weather_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.weather_data_utils import (
            transform_weather_data_for_bigquery,
        )

        bigquery_data = transform_weather_data_for_bigquery(data=weather_data)

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            dataframe=bigquery_data, table=big_query_api.raw_weather_table
        )

    @task()
    def save_hourly_data_to_bigquery(weather_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.weather_data_utils import (
            transform_weather_data_for_bigquery,
        )

        bigquery_data = transform_weather_data_for_bigquery(data=weather_data)

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            dataframe=bigquery_data, table=big_query_api.hourly_weather_table
        )

    extracted_raw_data = extract_raw_data()
    raw_data = format_raw_data(extracted_raw_data)
    hourly_data = create_hourly_data(extracted_raw_data)
    save_raw_data_to_bigquery(raw_data)
    save_hourly_data_to_bigquery(hourly_data)


historical_raw_weather_measurements_etl_dag = historical_raw_weather_measurements_etl()
historical_hourly_weather_measurements_etl_dag = (
    historical_hourly_weather_measurements_etl()
)
weather_measurements_etl_dag = weather_measurements_etl()
