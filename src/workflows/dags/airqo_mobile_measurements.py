from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "AirQo-Mobile-Devices-Measurements",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "mobile"],
)
def airqo_mobile_devices_measurements():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = AirQoDataUtils.flatten_meta_data(dag_run.conf["meta_data"])

        return AirQoDataUtils.extract_mobile_low_cost_sensors_data(meta_data=meta_data)

    @task()
    def aggregate_raw_data(raw_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.aggregate_low_cost_sensors_data(data=raw_data)

    @task()
    def extract_weather_stations(**kwargs):
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = AirQoDataUtils.flatten_meta_data(dag_run.conf["meta_data"])

        return WeatherDataUtils.get_weather_stations(meta_data=meta_data)

    @task()
    def aggregate_weather_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.extract_aggregated_mobile_devices_weather_data(data=data)

    @task()
    def merge_data(aggregated_measurements: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_mobile_devices_data_and_weather_data(
            measurements=aggregated_measurements, weather_data=weather_data
        )

    @task()
    def calibrate(data: pd.DataFrame):
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        return CalibrationUtils.calibrate_airqo_data(data=data)

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
    weather_stations = extract_weather_stations()
    aggregated_weather_data = aggregate_weather_data(weather_stations)

    merged_data = merge_data(
        aggregated_measurements=aggregated_data, weather_data=aggregated_weather_data
    )
    calibrated_data = calibrate(merged_data)
    load(calibrated_data)


airqo_mobile_devices_measurements()
