from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "AirQo-Mobile-Devices-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "mobile"],
)
def airqo_mobile_devices_measurements_etl():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = dag_run.conf["meta_data"]

        return AirQoDataUtils.extract_data_from_thingspeak(
            start_date_time="", end_date_time="", meta_data=meta_data
        )

    @task()
    def aggregate_raw_data(raw_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.aggregate_mobile_devices_data(data=raw_data)

    @task()
    def get_weather_stations(**kwargs):
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = dag_run.conf["meta_data"]

        return WeatherDataUtils.get_nearest_tahmo_stations(coordinates_list=meta_data)

    @task()
    def get_weather_data(stations: pd.DataFrame, **kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = dag_run.conf["meta_data"]

        return AirQoDataUtils.extract_mobile_devices_weather_data(
            stations=stations, meta_data=meta_data
        )

    @task()
    def merge_data(aggregated_measurements: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_mobile_devices_data_and_weather_data(
            measurements=aggregated_measurements, weather_data=weather_data
        )

    @task()
    def calibrate(data: pd.DataFrame):
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        return CalibrationUtils.calibrate_mobile_devices_data(measurements=data)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        bigquery_data = AirQoDataUtils.restructure_airqo_mobile_data_for_bigquery(data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=bigquery_data,
            table=big_query_api.airqo_mobile_measurements_table,
        )

    devices_raw_data = extract_raw_data()
    aggregated_data = aggregate_raw_data(devices_raw_data)

    weather_stations = get_weather_stations()
    weather_stations_data = get_weather_data(stations=weather_stations)

    merged_data = merge_data(
        aggregated_measurements=aggregated_data, weather_data=weather_stations_data
    )
    calibrated_data = calibrate(merged_data)
    load(calibrated_data)


airqo_mobile_devices_measurements_etl_dag = airqo_mobile_devices_measurements_etl()
