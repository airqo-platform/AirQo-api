from airflow.decorators import dag, task
import pandas as pd
from typing import Tuple, Generator

from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airflow.exceptions import AirflowFailException
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.airqo_utils import AirQoDataUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.weather_data_utils import WeatherDataUtils
from dag_docs import (
    airqo_realtime_low_cost_measurements_doc,
    airqo_historical_hourly_measurements_doc,
    airqo_gaseous_realtime_low_cost_data_doc,
    airqo_historical_raw_low_cost_measurements_doc,
    stream_old_data_doc,
    re_calibrate_missing_calibrated_data_doc,
    daily_data_checks_doc,
    airqo_api_missing_temp_measurements_fix_doc,
)
from task_docs import (
    extract_raw_airqo_data_doc,
    clean_data_raw_data_doc,
    send_raw_measurements_to_bigquery_doc,
    extract_raw_airqo_gaseous_data_doc,
    extract_historical_device_measurements_doc,
    extract_hourly_old_historical_data_doc,
    extract_devices_missing_calibrated_data_doc,
)
from airqo_etl_utils.constants import DeviceNetwork, DeviceCategory, Frequency, DataType
from datetime import datetime, timedelta
from airqo_etl_utils.date import date_to_str_hours


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule="0 0 * * *",
    doc_md=airqo_historical_hourly_measurements_doc,
    catchup=False,
    tags=["airqo", "hourly", "historical", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_historical_hourly_measurements():
    @task(
        doc_md=extract_historical_device_measurements_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_device_measurements(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=3, **kwargs
        )

        raw_hourly_data = DataUtils.extract_data_from_bigquery(
            DataType.RAW,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
            device_category=DeviceCategory.GENERAL,
            dynamic_query=True,
        )

        exclude_cols = [
            raw_hourly_data.device_number.name,
            raw_hourly_data.latitude.name,
            raw_hourly_data.longitude.name,
            raw_hourly_data.network.name,
        ]
        return DataUtils.remove_duplicates(
            raw_hourly_data,
            timestamp_col=raw_hourly_data.timestamp.name,
            id_col=raw_hourly_data.device_id.name,
            group_col=raw_hourly_data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_weather_data(**kwargs):
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return WeatherDataUtils.extract_weather_data(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            remove_outliers=False,
        )

    @task()
    def merge_data(
        device_measurements: pd.DataFrame, weather_data: pd.DataFrame
    ) -> pd.DataFrame:
        return AirQoDataUtils.merge_aggregated_weather_data(
            device_measurements, weather_data=weather_data
        )

    @task(retries=2, retry_delay=timedelta(minutes=2))
    def calibrate_data(measurements: pd.DataFrame) -> pd.DataFrame:
        return AirQoDataUtils.calibrate_data(data=measurements, groupby="country")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(data: pd.DataFrame) -> None:

        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(dataframe=data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame, **kwargs) -> None:
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:

            data = DataUtils.process_data_for_api(
                airqo_data, frequency=Frequency.HOURLY
            )

            data_api = DataApi()
            data_api.save_events(measurements=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_message_broker(
        data: pd.DataFrame, **kwargs
    ) -> None:
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        data = DataUtils.process_data_for_message_broker(
            data=data,
        )

        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)

    extracted_device_measurements = extract_device_measurements()
    extracted_weather_data = extract_weather_data()
    merged_data = merge_data(
        device_measurements=extracted_device_measurements,
        weather_data=extracted_weather_data,
    )
    calibrated_data = calibrate_data(merged_data)
    load(calibrated_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)


@dag(
    "AirQo-Historical-Raw-Low-Cost-Measurements",
    doc_md=airqo_historical_raw_low_cost_measurements_doc,
    schedule="0 4 * * *",
    catchup=False,
    tags=["airqo", "raw", "historical", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_historical_raw_measurements():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs):
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=2, **kwargs
        )

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOWCOST,
            resolution=Frequency.DAILY,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOWCOST, data_type=DataType.RAW
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_device_deployment_logs():
        return AirQoDataUtils.extract_devices_deployment_logs()

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):
        return AirQoDataUtils.map_site_ids_to_historical_data(
            data=airqo_data, deployment_logs=deployment_logs
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load_data(airqo_data: pd.DataFrame):

        data, table = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = map_site_ids(
        airqo_data=clean_data, deployment_logs=device_logs
    )
    load_data(data_with_site_ids)


@dag(
    "Cleanup-AirQo-Measurements",
    schedule="*/45 * * * *",
    catchup=False,
    tags=["airqo", "cleanup"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_cleanup_measurements():
    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            hours=2, **kwargs
        )

        return DataUtils.extract_data_from_bigquery(
            DataType.RAW,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
            device_category=DeviceCategory.GENERAL,
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=5, **kwargs
        )

        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )
        return DataValidationUtils.remove_outliers_fix_types(data)

    @task()
    def remove_duplicated_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task()
    def remove_duplicated_hourly_data(data: pd.DataFrame) -> pd.DataFrame:
        exclude_cols = [
            data.device_number.name,
            data.latitude.name,
            data.longitude.name,
            data.network.name,
        ]
        return DataUtils.remove_duplicates(
            data=data,
            timestamp_col=data.timestamp.name,
            id_col=data.device_id.name,
            group_col=data.site_id.name,
            exclude_cols=exclude_cols,
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def load_raw_data(data: pd.DataFrame):

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.raw_measurements_table
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def load_hourly_data(data: pd.DataFrame):

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.hourly_measurements_table
        )

    raw_data = extract_raw_data()
    hourly_data = extract_hourly_data()
    clean_raw_data = remove_duplicated_raw_data(raw_data)
    clean_hourly_data = remove_duplicated_hourly_data(hourly_data)
    load_raw_data(data=clean_raw_data)
    load_hourly_data(data=clean_hourly_data)


@dag(
    "AirQo-Realtime-Low-Cost-Measurements",
    schedule="10 * * * *",
    catchup=False,
    doc_md=airqo_realtime_low_cost_measurements_doc,
    tags=["airqo", "hourly", "realtime", "raw", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_realtime_measurements():
    @task(
        doc_md=extract_raw_airqo_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        execution_date = kwargs["dag_run"].execution_date
        hour_of_day = execution_date - timedelta(hours=1)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOWCOST,
            resolution=Frequency.RAW_LOW_COST,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.clean_low_cost_sensor_data(
            data=data,
            device_category=DeviceCategory.LOWCOST,
            data_type=DataType.RAW,
            frequency=Frequency.HOURLY,
        )

    @task()
    # TODO : Needs review. If properly executed could ease identification of data issues
    def save_test_data(data: pd.DataFrame):
        from airqo_etl_utils.utils import Utils
        from airqo_etl_utils.config import Config

        bucket_name = Config.BUCKET_NAME_AIRQO
        file_path = Config.FILE_PATH_AIRQO
        return Utils.test_data(
            data=data, bucket_name=bucket_name, destination_file=file_path
        )

    @task()
    def aggregate(data: pd.DataFrame):
        return DataUtils.aggregate_low_cost_sensors_data(data=data)

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_weather_data(**kwargs):
        execution_date = kwargs["dag_run"].execution_date
        hour_of_day = execution_date - timedelta(hours=1)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        weather_data = WeatherDataUtils.extract_weather_data(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            remove_outliers=False,
        )
        return weather_data

    @task()
    def merge_data(averaged_hourly_data: pd.DataFrame, weather_data: pd.DataFrame):
        return AirQoDataUtils.merge_aggregated_weather_data(
            averaged_hourly_data, weather_data=weather_data
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def save_merged_data(merged_air_weather_data: pd.DataFrame):
        data, table = DataUtils.format_data_for_bigquery(
            merged_air_weather_data,
            DataType.AVERAGED,
            DeviceCategory.GENERAL,
            Frequency.RAW,
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=table)

    @task()
    def calibrate(data: pd.DataFrame):
        return AirQoDataUtils.calibrate_data(data=data, groupby="country")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(data: pd.DataFrame):
        data = DataUtils.process_data_for_api(data, frequency=Frequency.HOURLY)

        data_api = DataApi()
        data_api.save_events(measurements=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        data = DataUtils.process_data_for_message_broker(data=data)

        if data.empty:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_bigquery(data: pd.DataFrame):
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_raw_measurements_to_bigquery(data: pd.DataFrame):

        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def update_latest_data_topic(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils

        data = AirQoDataUtils.process_latest_data(
            data=data, device_category=DeviceCategory.LOWCOST
        )
        data = DataUtils.process_data_for_message_broker(
            data=data,
        )

        if data.empty:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(
            topic=Config.AVERAGED_HOURLY_MEASUREMENTS_TOPIC, data=data
        )

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    save_test_data(clean_data)

    averaged_airqo_data = aggregate(clean_data)
    send_raw_measurements_to_bigquery(clean_data)
    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        averaged_hourly_data=averaged_airqo_data, weather_data=extracted_weather_data
    )
    save_merged_data(merged_data)
    calibrated_data = calibrate(merged_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)
    update_latest_data_topic(calibrated_data)


@dag(
    "AirQo-Raw-Data-Low-Cost-Measurements",
    schedule="*/10 * * * *",
    catchup=False,
    tags=["airqo", "raw", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_raw_data_measurements():
    @task(
        doc_md=extract_raw_airqo_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs):

        execution_time = kwargs["dag_run"].execution_date
        hour_of_day = execution_time - timedelta(minutes=30)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOWCOST,
        )

    @task(
        doc_md=clean_data_raw_data_doc,
    )
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOWCOST, data_type=DataType.RAW
        )

    @task(
        doc_md=send_raw_measurements_to_bigquery_doc,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):

        data, table = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=table)

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    send_raw_measurements_to_bigquery(clean_data)


@dag(
    "AirQo-Raw-Gaseous-Low-Cost-Measurements",
    schedule="10 * * * *",
    catchup=False,
    doc_md=airqo_gaseous_realtime_low_cost_data_doc,
    tags=["airqo", "gaseous", "raw", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_gaseous_realtime_measurements():
    @task(
        doc_md=extract_raw_airqo_gaseous_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs) -> pd.DataFrame:

        execution_date = kwargs["dag_run"].execution_date
        hour_of_day = execution_date - timedelta(hours=1)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")
        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.GAS,
            device_network=DeviceNetwork.AIRQO,
        )

    @task(
        doc_md=clean_data_raw_data_doc,
    )
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.GAS, data_type=DataType.RAW
        )

    @task(
        doc_md=send_raw_measurements_to_bigquery_doc,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):

        data, table = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=table)

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    send_raw_measurements_to_bigquery(clean_data)


@dag(
    "Stream-Old-Data",
    schedule="*/25 * * * *",
    catchup=False,
    doc_md=stream_old_data_doc,
    tags=["old", "hourly-data", "bigquery", "api"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_bigquery_data_measurements_to_api():
    from airflow.models import Variable

    @task(
        doc_md=extract_hourly_old_historical_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        # Only used the first time
        start = kwargs.get("params", {}).get("start_date", "2021-01-01T01:00:00Z")
        end = kwargs.get("params", {}).get("end_date", "2021-12-31T23:59:59Z")
        end = datetime.strptime(end, "%Y-%m-%dT%H:%M:%SZ")

        previous_date = Variable.get("new_date_2021", default_var=start)
        if previous_date == start:
            Variable.set("new_date_2021", previous_date)

        hour_of_day = datetime.strptime(previous_date, "%Y-%m-%dT%H:%M:%SZ")
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        if hour_of_day > end or (hour_of_day + timedelta(hours=1)) > end:
            raise AirflowFailException(f"Run expired on {end}")

        return DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(data: pd.DataFrame, **kwargs):
        data = DataUtils.process_data_for_api(data, frequency=Frequency.HOURLY)

        data_api = DataApi()
        data_api.save_events(measurements=data)
        previous_date = datetime.strptime(
            Variable.get("new_date_2021"), "%Y-%m-%dT%H:%M:%SZ"
        )
        previous_date = date_to_str_hours(previous_date + timedelta(hours=1))
        Variable.set("new_date_2021", previous_date)

    hourly_data = extract_hourly_data()
    send_hourly_measurements_to_api(hourly_data)


@dag(
    "Re-calibrate-missing-calibrated-data",
    schedule="0 0 * * *",
    catchup=False,
    doc_md=re_calibrate_missing_calibrated_data_doc,
    tags=["2025", "hourly-data", "bigquery"],
    default_args=AirflowUtils.dag_default_configs(),
)
def calibrate_missing_measurements():
    @task(
        doc_md=extract_devices_missing_calibrated_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_devices_missing_calibrated_data(**kwargs) -> Tuple[pd.DataFrame, str]:
        start_date, _ = DateUtils.get_dag_date_time_values(days=1)
        start_date = datetime.strptime(start_date, "%Y-%m-%dT%H:%M:%SZ").strftime(
            "%Y-%m-%d"
        )
        devices = AirQoDataUtils.extract_devices_with_missing_data(
            start_date=start_date
        )
        return devices

    @task(retries=3, retry_delay=timedelta(minutes=5), multiple_outputs=True)
    def extract_raw_data(devices: pd.DataFrame) -> dict:
        raw_data, start_date, end_date = AirQoDataUtils.extract_raw_device_data(
            devices=devices
        )
        return {"raw_data": raw_data, "start_date": start_date, "end_date": end_date}

    @task()
    def clean_data_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.clean_low_cost_sensor_data(
            data=data,
            device_category=DeviceCategory.LOWCOST,
            data_type=DataType.RAW,
            frequency=Frequency.HOURLY,
        )

    @task()
    def aggregate(data: pd.DataFrame):
        return DataUtils.aggregate_low_cost_sensors_data(data=data)

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_weather_data(start_date: str, end_date: str, **kwargs):
        start_date_time = DateUtils.format_datetime_by_unit_str(
            start_date, "hours_start"
        )
        end_date_time = DateUtils.format_datetime_by_unit_str(end_date, "hours_end")

        weather_data = WeatherDataUtils.extract_weather_data(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            remove_outliers=False,
        )
        return weather_data

    @task()
    def merge_data(averaged_hourly_data: pd.DataFrame, weather_data: pd.DataFrame):
        return AirQoDataUtils.merge_aggregated_weather_data(
            averaged_hourly_data, weather_data=weather_data
        )

    @task()
    def calibrate(device_data: pd.DataFrame, device_measurements: pd.DataFrame):
        filtered_data = pd.merge(
            device_measurements,
            device_data[["device_id", "timestamp"]],
            on=["device_id", "timestamp"],
            how="inner",
        )
        return AirQoDataUtils.calibrate_data(data=filtered_data, groupby="country")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_bigquery(
        calibrated_data: Generator,
    ) -> None:
        big_query_api = BigQueryApi()
        data, table = DataUtils.format_data_for_bigquery(
            calibrated_data,
            DataType.AVERAGED,
            DeviceCategory.GENERAL,
            Frequency.HOURLY,
        )
        big_query_api.load_data(dataframe=data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_raw_measurements_to_bigquery(data: pd.DataFrame):

        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(calibrated_data: pd.DataFrame) -> None:
        data_api = DataApi()
        data = DataUtils.process_data_for_api(
            calibrated_data, frequency=Frequency.HOURLY
        )
        data_api.save_events(measurements=data)

    devices = extract_devices_missing_calibrated_data()
    raw_data_result = extract_raw_data(devices)
    cleaned_raw_data = clean_data_raw_data(raw_data_result["raw_data"])
    aggregated_data = aggregate(cleaned_raw_data)
    weather_data = extract_hourly_weather_data(
        start_date=raw_data_result["start_date"], end_date=raw_data_result["end_date"]
    )
    merged_data = merge_data(aggregated_data, weather_data)
    calibrated_data = calibrate(devices, merged_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    send_raw_measurements_to_bigquery(cleaned_raw_data)
    send_hourly_measurements_to_api(calibrated_data)


@dag(
    "Run-daily-data-checks",
    schedule="10 0 * * *",
    catchup=False,
    doc_md=daily_data_checks_doc,
    tags=["2025", "hourly-data", "bigquery"],
    default_args=AirflowUtils.dag_default_configs(),
)
def run_daily_data_quality_checks():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def run_checks(**kwargs) -> None:
        DataUtils.execute_data_quality_checks(
            DeviceCategory.LOWCOST, DataType.AVERAGED, frequency=Frequency.HOURLY
        )

    run_checks()


# Temp solution for device registry missing data


@dag(
    "AirQo-API-missing-measurements-fix",
    schedule="*/40 * * * *",
    catchup=False,
    doc_md=airqo_api_missing_temp_measurements_fix_doc,
    default_args=AirflowUtils.dag_default_configs(),
)
def extract_devices_missing_measurements():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_device() -> None:
        return AirQoDataUtils.extract_devices_with_missing_measurements_api()

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_data(devices: pd.DataFrame, **kwargs) -> pd.DataFrame:
        dag_time = kwargs["dag_run"].execution_date
        hour_of_day = dag_time - timedelta(hours=5)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = date_to_str_hours(dag_time)
        if devices.empty:
            raise AirflowFailException("No devices with missing data found")

        return DataUtils.extract_data_from_bigquery(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOWCOST,
            datatype=DataType.AVERAGED,
            frequency=Frequency.HOURLY,
            data_filter={"device_id": devices["device_id"].tolist()},
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_data_to_api(data: pd.DataFrame) -> None:
        data_api = DataApi()
        if not data.empty:
            data = DataUtils.process_data_for_api(data, frequency=Frequency.HOURLY)
            data_api.save_events(measurements=data)

    devices = extract_device()
    data = extract_data(devices)
    send_data_to_api(data)


run_daily_data_quality_checks()
airqo_historical_hourly_measurements()
airqo_realtime_measurements()
airqo_historical_raw_measurements()
airqo_cleanup_measurements()
airqo_raw_data_measurements()
airqo_gaseous_realtime_measurements()
airqo_bigquery_data_measurements_to_api()
calibrate_missing_measurements()
extract_devices_missing_measurements()
