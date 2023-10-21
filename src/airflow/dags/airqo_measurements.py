from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.constants import Frequency
from dag_docs import airqo_realtime_low_cost_measurements_doc
from task_docs import (
    extract_raw_airqo_data_doc,
    clean_data_raw_data_doc,
    send_raw_measurements_to_bigquery_doc,
)


@dag(
    "Calibrate-AirQo-Measurements",
    schedule="0 0 * * 6",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "calibrate"],
)
def airqo_calibrate_measurements():
    import pandas as pd

    @task()
    def extract_uncalibrated_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=7, **kwargs
        )
        return AirQoDataUtils.extract_uncalibrated_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def extract_weather_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        return WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def merge_data(
        device_measurements: pd.DataFrame, hourly_weather_data: pd.DataFrame
    ):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=device_measurements,
            weather_data=hourly_weather_data,
        )

    @task()
    def calibrate_data(measurements: pd.DataFrame):
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        return CalibrationUtils.calibrate_airqo_data(data=measurements)

    @task()
    def load(data: pd.DataFrame, **kwargs):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.constants import Tenant

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)

        bigquery_api = BigQueryApi()
        data["tenant"] = str(Tenant.AIRQO)

        data = DataValidationUtils.process_for_big_query(
            dataframe=data,
            table=bigquery_api.hourly_measurements_table,
        )

        bigquery_api.reload_data(
            tenant=Tenant.AIRQO,
            table=bigquery_api.hourly_measurements_table,
            null_cols=["pm2_5_calibrated_value"],
            dataframe=data,
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    uncalibrated_data = extract_uncalibrated_data()
    weather_data = extract_weather_data()
    merged_data = merge_data(
        device_measurements=uncalibrated_data,
        hourly_weather_data=weather_data,
    )
    calibrated_data = calibrate_data(merged_data)
    load(calibrated_data)


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule="0 0 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "hourly", "historical", "low cost"],
)
def airqo_historical_hourly_measurements():
    import pandas as pd

    @task()
    def extract_device_measurements(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=7, **kwargs
        )
        return AirQoDataUtils.extract_aggregated_raw_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def extract_weather_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, **kwargs
        )

        return WeatherDataUtils.extract_hourly_weather_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def merge_data(device_measurements: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=device_measurements, weather_data=weather_data
        )

    @task()
    def calibrate_data(measurements: pd.DataFrame):
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        return CalibrationUtils.calibrate_airqo_data(data=measurements)

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_aggregated_data_for_bigquery(data=data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.hourly_measurements_table,
        )

    @task()
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame, **kwargs):
        send_to_api_param = kwargs.get("params", {}).get("send_to_api")
        if send_to_api_param:
            from airqo_etl_utils.airqo_api import AirQoApi
            from airqo_etl_utils.airqo_utils import AirQoDataUtils

            data = AirQoDataUtils.process_data_for_api(
                airqo_data, frequency=Frequency.HOURLY
            )

            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=data)
        else:
            print("The send to API parameter has been set to false")

    extracted_device_measurements = extract_device_measurements()
    extracted_weather_data = extract_weather_data()
    merged_data = merge_data(
        device_measurements=extracted_device_measurements,
        weather_data=extracted_weather_data,
    )
    calibrated_data = calibrate_data(merged_data)
    load(calibrated_data)
    send_hourly_measurements_to_api(calibrated_data)


@dag(
    "AirQo-Historical-Raw-Low-Cost-Measurements",
    schedule="0 4 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "raw", "historical", "low cost"],
)
def airqo_historical_raw_measurements():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.constants import DeviceCategory

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            historical=True, days=2, **kwargs
        )
        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_low_cost_sensor_data(data=data)

    @task()
    def extract_device_deployment_logs():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.extract_devices_deployment_logs()

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.map_site_ids_to_historical_data(
            data=airqo_data, deployment_logs=deployment_logs
        )

    @task()
    def load_data(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)

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
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "cleanup"],
)
def airqo_cleanup_measurements():
    import pandas as pd
    from airqo_etl_utils.constants import Frequency

    @task()
    def extract_raw_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return AirQoDataUtils.extract_data_from_bigquery(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.RAW,
        )

    @task()
    def extract_hourly_data(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.date import DateUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(
            days=14, **kwargs
        )
        return AirQoDataUtils.extract_data_from_bigquery(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            frequency=Frequency.HOURLY,
        )

    @task()
    def remove_duplicated_raw_data(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.remove_duplicates(data=data)

    @task()
    def remove_duplicated_hourly_data(data: pd.DataFrame) -> pd.DataFrame:
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.remove_duplicates(data=data)

    @task()
    def load_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.reload_data(
            dataframe=data, table=big_query_api.raw_measurements_table
        )

    @task()
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
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    doc_md=airqo_realtime_low_cost_measurements_doc,
    tags=["airqo", "hourly", "realtime", "raw", "low cost"],
)
def airqo_realtime_measurements():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_date_time = date_to_str_hours(hour_of_day)
    end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task(
        doc_md=extract_raw_airqo_data_doc,
    )
    def extract_raw_data():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.constants import DeviceCategory

        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )

    @task()
    def clean_data_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_low_cost_sensor_data(data=data)

    @task()
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

    @task()
    def extract_hourly_weather_data():
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.extract_hourly_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def merge_data(averaged_hourly_data: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.merge_aggregated_weather_data(
            airqo_data=averaged_hourly_data, weather_data=weather_data
        )

    # @task.virtualenv(
    #     task_id="calibrate",
    #     requirements=[
    #         "numpy==1.21.2",
    #         "pandas==1.3.3",
    #         "protobuf==3.15.8",
    #         "pyarrow==3.0.0",
    #         "google-cloud-storage==1.41.1",
    #         "scikit_learn==0.24.1",
    #         "apache-airflow",
    #         "airqo_etl_utils",
    #         "pyarrow==3.0.0"
    #     ],
    #     system_site_packages=True,
    #     multiple_outputs=True,
    #     python_version="3.7",
    # )
    @task()
    def calibrate(data: pd.DataFrame):
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        return CalibrationUtils.calibrate_airqo_data(data=data)

    @task()
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_data_for_api(
            airqo_data, frequency=Frequency.HOURLY
        )

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=data)

    @task()
    def send_hourly_measurements_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant

        data = DataValidationUtils.process_for_message_broker(
            data=data, tenant=Tenant.AIRQO
        )
        MessageBrokerUtils.update_hourly_data_topic(data=data)

    @task()
    def send_hourly_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_aggregated_data_for_bigquery(data=airqo_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.hourly_measurements_table,
        )

    @task()
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

    @task()
    def update_latest_data_topic(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.message_broker_utils import MessageBrokerUtils
        from airqo_etl_utils.constants import DeviceCategory

        data = AirQoDataUtils.process_latest_data(
            data=data, device_category=DeviceCategory.LOW_COST
        )
        MessageBrokerUtils.update_hourly_data_topic(data=data)

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    test_data = save_test_data(clean_data)
    averaged_airqo_data = aggregate(clean_data)
    send_raw_measurements_to_bigquery(clean_data)
    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        averaged_hourly_data=averaged_airqo_data, weather_data=extracted_weather_data
    )
    calibrated_data = calibrate(merged_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    update_latest_data_topic(calibrated_data)


@dag(
    "AirQo-Raw-Data-Low-Cost-Measurements",
    schedule="*/5 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["airqo", "raw", "low cost"],
)
def airqo_raw_data_measurements():
    import pandas as pd

    @task(
        doc_md=extract_raw_airqo_data_doc,
    )
    def extract_raw_data():
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.constants import DeviceCategory
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        hour_of_day = datetime.utcnow() - timedelta(minutes=30)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return AirQoDataUtils.extract_devices_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            device_category=DeviceCategory.LOW_COST,
        )

    @task(doc_md=clean_data_raw_data_doc)
    def clean_data_raw_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.clean_low_cost_sensor_data(data=data)

    @task(doc_md=send_raw_measurements_to_bigquery_doc)
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

    raw_data = extract_raw_data()
    clean_data = clean_data_raw_data(raw_data)
    send_raw_measurements_to_bigquery(clean_data)


airqo_historical_hourly_measurements()
airqo_realtime_measurements()
airqo_historical_raw_measurements()
airqo_calibrate_measurements()
airqo_cleanup_measurements()
airqo_raw_data_measurements()
