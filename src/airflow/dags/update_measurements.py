from datetime import datetime

from airflow.decorators import dag, task


@dag(
    "Update-Calibrated-Historical-Hourly-Measurements",
    schedule_interval=None,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["calibrated", "historical", "update"],
)
def update_calibrated_historical_hourly_measurements_etl():
    import pandas as pd

    @task()
    def extract_hourly_calibrated_data(**kwargs):

        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.commons import get_date_time_values

        start_date_time, end_date_time = get_date_time_values(**kwargs)
        big_query_api = BigQueryApi()
        calibrated_data = big_query_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=[
                "tenant",
                "device_number",
                "timestamp",
                "pm2_5_calibrated_value",
                "pm10_calibrated_value",
                "temperature",
                "humidity",
            ],
            table=big_query_api.calibrated_hourly_measurements_table,
            tenant="airqo",
        )

        return calibrated_data

    @task()
    def update(calibrated_data: pd.DataFrame):

        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_data(
            updated_data=calibrated_data,
            table=big_query_api.hourly_measurements_table,
        )

    hourly_calibrated_data = extract_hourly_calibrated_data()
    update(hourly_calibrated_data)
