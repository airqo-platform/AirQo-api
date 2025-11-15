from airflow.decorators import dag, task
from datetime import timedelta, datetime
import pandas as pd

from airqo_etl_utils.constants import (
    DeviceCategory,
    Frequency,
    DataType,
)
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.date import date_to_str
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from task_docs import (
    clean_data_raw_data_doc,
)


@dag(
    "AirQo-Raw-Data-Low-Cost-Measurements-Mobile",
    schedule="*/5 * * * *",
    catchup=False,
    tags=["airqo", "raw", "low cost", "mobile"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_raw_data_measurements_mobile():
    @task(
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs):
        execution_time = kwargs["dag_run"].execution_date
        hour_of_day = execution_time - timedelta(minutes=5)

        start_date_time = date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:00:00Z")
        end_date_time = date_to_str(hour_of_day, str_format="%Y-%m-%dT%H:59:59Z")

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.MOBILE,
        )

    @task(
        doc_md=clean_data_raw_data_doc,
    )
    def clean_data_raw_data(data: pd.DataFrame):
        if data.empty:
            # Mark the dag run as successful and exit
            return pd.DataFrame()
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.MOBILE, data_type=DataType.RAW
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_raw_measurements_to_api(data: pd.DataFrame):
        # Pause sending of raw mobile data to api
        # if data.empty:
        # Mark the dag run as successful and exit
        # return
        # data = DataUtils.process_data_for_api(data, frequency=Frequency.RAW)
        # data_api = DataApi()
        # data_api.save_events(measurements=data)
        pass

    @task(
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame, **kwargs):
        if not airqo_data.empty:
            data, table = DataUtils.format_data_for_bigquery(
                airqo_data, DataType.RAW, DeviceCategory.MOBILE, Frequency.RAW
            )
            big_query_api = BigQueryApi()
            big_query_api.load_data(data, table=table)

    raw_data = extract_raw_data()
    cleaned_data = clean_data_raw_data(raw_data)
    send_raw_measurements_to_api(cleaned_data)
    send_raw_measurements_to_bigquery(cleaned_data)


# TODO: Look into these unscheduled dags and see what's required and what's not.
@dag(
    "AirQo-Mobile-Devices-Measurements",
    schedule=None,
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "mobile"],
)
def airqo_mobile_devices_measurements():
    import pandas as pd
    from airqo_etl_utils.constants import Frequency

    @task()
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        dag_run = kwargs.get("dag_run")
        meta_data = AirQoDataUtils.flatten_meta_data(dag_run.conf["meta_data"])

        return AirQoDataUtils.extract_mobile_low_cost_sensors_data(
            meta_data, Frequency.HOURLY
        )

    @task()
    def aggregate_raw_data(raw_data: pd.DataFrame):
        from airqo_etl_utils.datautils import DataUtils

        return DataUtils.aggregate_low_cost_sensors_data(data=raw_data)

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
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.calibrate_data(data=data, groupby="country")

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
airqo_raw_data_measurements_mobile()
