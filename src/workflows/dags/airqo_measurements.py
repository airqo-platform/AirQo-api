from airflow.decorators import dag, task

from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airflow.exceptions import AirflowFailException
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.data_validator import DataValidationUtils
from dag_docs import (
    airqo_realtime_low_cost_measurements_doc,
    airqo_historical_hourly_measurements_doc,
    airqo_gaseous_realtime_low_cost_data_doc,
    airqo_historical_raw_low_cost_measurements_doc,
)
from task_docs import (
    extract_raw_airqo_data_doc,
    clean_data_raw_data_doc,
    send_raw_measurements_to_bigquery_doc,
    extract_raw_airqo_gaseous_data_doc,
    extract_historical_device_measurements_doc,
)
from airqo_etl_utils.constants import DeviceNetwork, DeviceCategory, Frequency, DataType
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule="0 0 * * *",
    doc_md=airqo_historical_hourly_measurements_doc,
    catchup=False,
    tags=["airqo", "hourly", "historical", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_historical_hourly_measurements():
    import pandas as pd
    from airqo_etl_utils.airqo_utils import AirQoDataUtils
    from airqo_etl_utils.date import DateUtils

    @task(
        doc_md=extract_historical_device_measurements_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_device_measurements(**kwargs) -> pd.DataFrame:
        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=3, **kwargs
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

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

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
            airqo_data=device_measurements, weather_data=weather_data
        )

    @task(retries=2, retry_delay=timedelta(minutes=2))
    def calibrate_data(measurements: pd.DataFrame) -> pd.DataFrame:
        return AirQoDataUtils.calibrate_data(data=measurements)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load(data: pd.DataFrame) -> None:
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data, table=big_query_api.hourly_measurements_table
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame, **kwargs) -> None:
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            from airqo_etl_utils.airqo_api import AirQoApi

            data = DataUtils.process_data_for_api(
                airqo_data, frequency=Frequency.HOURLY
            )

            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=data)
        else:
            print("The send to API parameter has been set to false")

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_message_broker(
        data: pd.DataFrame, **kwargs
    ) -> None:
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=Config.HOURLY_MEASUREMENTS_TOPIC,
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
    import pandas as pd

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=2, **kwargs
        )
        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
            resolution=Frequency.DAILY,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOW_COST
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_device_deployment_logs():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.extract_devices_deployment_logs()

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.map_site_ids_to_historical_data(
            data=airqo_data, deployment_logs=deployment_logs
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def load_data(airqo_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_measurements_table,
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
    schedule="0 11 * * *",
    catchup=False,
    tags=["airqo", "cleanup"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_cleanup_measurements():
    import pandas as pd

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=1, **kwargs
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
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=3, **kwargs
        )
        data = DataUtils.extract_data_from_bigquery(
            DataType.AVERAGED,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )
        return DataValidationUtils.remove_outliers(data)

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
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.raw_measurements_table
        )

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def load_hourly_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

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
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta, timezone

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
            device_category=DeviceCategory.LOW_COST,
            resolution=Frequency.RAW_LOW_COST,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOW_COST
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
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.aggregate_low_cost_sensors_data(data=data)

    @task(provide_context=True, retries=3, retry_delay=timedelta(minutes=5))
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

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
        return DataUtils.aggregate_weather_data(weather_data)

    @task()
    def merge_data(averaged_hourly_data: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=averaged_hourly_data, weather_data=weather_data
        )

    @task()
    def calibrate(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.calibrate_data(data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_api(data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = DataUtils.process_data_for_api(data, frequency=Frequency.HOURLY)

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_message_broker(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=Config.HOURLY_MEASUREMENTS_TOPIC,
        )

        if not data:
            raise AirflowFailException(
                "Processing for message broker failed. Please check if kafka is up and running."
            )

        broker = MessageBrokerUtils()
        broker.publish_to_topic(topic=Config.HOURLY_MEASUREMENTS_TOPIC, data=data)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_hourly_measurements_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.GENERAL, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.hourly_measurements_table,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def send_raw_measurements_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def update_latest_data_topic(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from datetime import datetime

        now = datetime.now()
        unique_str = str(now.date()) + "-" + str(now.hour)

        data = AirQoDataUtils.process_latest_data(
            data=data, device_category=DeviceCategory.LOW_COST
        )
        data = DataValidationUtils.process_data_for_message_broker(
            data=data,
            caller=kwargs["dag"].dag_id + unique_str,
            topic=Config.AVERAGED_HOURLY_MEASUREMENTS_TOPIC,
        )

        if not data:
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
    # TODO Should calibrated data be merge with non airqo data after calibration
    calibrated_data = calibrate(merged_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)
    update_latest_data_topic(calibrated_data)


@dag(
    "AirQo-Raw-Data-Low-Cost-Measurements",
    schedule="*/5 * * * *",
    catchup=False,
    tags=["airqo", "raw", "low cost"],
    default_args=AirflowUtils.dag_default_configs(),
)
def airqo_raw_data_measurements():
    import pandas as pd

    @task(
        doc_md=extract_raw_airqo_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        execution_time = kwargs["dag_run"].execution_date
        hour_of_day = execution_time - timedelta(minutes=30)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )

    @task(
        doc_md=clean_data_raw_data_doc,
    )
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOW_COST
        )

    @task(
        doc_md=send_raw_measurements_to_bigquery_doc,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

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
    import pandas as pd

    @task(
        doc_md=extract_raw_airqo_gaseous_data_doc,
        provide_context=True,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        execution_date = kwargs["dag_run"].execution_date
        hour_of_day = execution_date - timedelta(hours=1)

        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")
        return DataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST_GAS,
            device_network=DeviceNetwork.AIRQO,
            remove_outliers=False,
        )

    @task(
        doc_md=clean_data_raw_data_doc,
    )
    def clean_data_raw_data(data: pd.DataFrame):
        return DataUtils.clean_low_cost_sensor_data(
            data=data, device_category=DeviceCategory.LOW_COST_GAS
        )

    @task(
        doc_md=send_raw_measurements_to_bigquery_doc,
        retries=3,
        retry_delay=timedelta(minutes=5),
    )
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = DataUtils.format_data_for_bigquery(
            airqo_data, DataType.RAW, DeviceCategory.GENERAL, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    send_raw_measurements_to_bigquery(clean_data)


airqo_historical_hourly_measurements()
airqo_realtime_measurements()
airqo_historical_raw_measurements()
airqo_cleanup_measurements()
airqo_raw_data_measurements()
airqo_gaseous_realtime_measurements()
