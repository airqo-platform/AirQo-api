from datetime import datetime
from airflow.decorators import dag, task

from airflow_utils.commons import slack_dag_failure_notification


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "historical"],
)
def historical_hourly_measurements_etl():
    @task(multiple_outputs=True)
    def extract_hourly_raw_data(**kwargs):

        from airflow_utils.commons import get_time_values, fill_nan
        from airflow_utils.airqo_utils import (
            extract_airqo_data_from_thingspeak,
            average_airqo_data,
        )

        start_time, end_time = get_time_values(**kwargs)
        raw_airqo_data = extract_airqo_data_from_thingspeak(
            start_time=start_time, end_time=end_time, all_devices=True
        )
        average_data = average_airqo_data(data=raw_airqo_data, frequency="hourly")

        return dict({"data": fill_nan(data=average_data)})

    @task(multiple_outputs=True)
    def extract_device_deployment_logs():

        from airflow_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return dict({"data": logs})

    @task()
    def map_site_ids(airqo_data: dict, deployment_logs: dict):

        from airflow_utils.commons import un_fill_nan, fill_nan
        from airflow_utils.airqo_utils import map_site_ids_to_historical_measurements

        data = un_fill_nan(airqo_data.get("data"))
        logs = deployment_logs.get("data")

        restructured_data = map_site_ids_to_historical_measurements(
            data=data, deployment_logs=logs
        )

        return dict({"data": fill_nan(data=restructured_data)})

    @task(multiple_outputs=True)
    def extract_hourly_weather_data(**kwargs):

        from airflow_utils.commons import get_time_values, fill_nan
        from airflow_utils.airqo_utils import extract_airqo_weather_data_from_tahmo

        start_time, end_time = get_time_values(**kwargs)
        airqo_weather_data = extract_airqo_weather_data_from_tahmo(
            start_time=start_time, end_time=end_time, frequency="hourly"
        )
        return dict({"data": fill_nan(data=airqo_weather_data)})

    @task(multiple_outputs=True)
    def merge_data(averaged_airqo_data: dict, weather_data: dict):

        from airflow_utils.commons import un_fill_nan, fill_nan
        from airflow_utils.airqo_utils import merge_airqo_and_weather_data

        hourly_airqo_data = un_fill_nan(averaged_airqo_data.get("data"))
        hourly_weather_data = un_fill_nan(weather_data.get("data"))

        merged_measurements = merge_airqo_and_weather_data(
            airqo_data=hourly_airqo_data, weather_data=hourly_weather_data
        )

        return dict({"data": fill_nan(data=merged_measurements)})

    @task(multiple_outputs=True)
    def calibrate(inputs: dict):

        from airflow_utils.commons import un_fill_nan, fill_nan
        from airflow_utils.airqo_utils import calibrate_hourly_airqo_measurements

        data = un_fill_nan(inputs.get("data"))

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return dict({"data": fill_nan(data=airqo_calibrated_data)})

    @task()
    def load(airqo_data: dict, **kwargs):

        from airflow_utils.commons import (
            un_fill_nan,
            save_measurements_to_bigquery,
        )
        from airflow_utils.airqo_api import AirQoApi
        from airflow_utils.airqo_utils import (
            restructure_airqo_data,
            restructure_airqo_data_for_api,
        )
        from airflow_utils.config import configuration
        from airflow_utils.message_broker import KafkaBrokerClient

        data = un_fill_nan(airqo_data.get("data"))

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            airqo_restructured_data = restructure_airqo_data(
                data=data, destination="bigquery"
            )
            table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
            save_measurements_to_bigquery(
                measurements=airqo_restructured_data, table_id=table_id
            )

        elif destination == "message-broker":
            airqo_restructured_data = restructure_airqo_data_for_api(data)

            info = {
                "data": airqo_restructured_data,
                "action": "New",
            }
            kafka = KafkaBrokerClient()
            kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)
        else:
            airqo_restructured_data = restructure_airqo_data_for_api(data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    extracted_airqo_data = extract_hourly_raw_data()
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = map_site_ids(
        airqo_data=extracted_airqo_data, deployment_logs=device_logs
    )

    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        averaged_airqo_data=data_with_site_ids, weather_data=extracted_weather_data
    )
    calibrated_data = calibrate(merged_data)

    load(calibrated_data)


@dag(
    "AirQo-Hourly-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "realtime", "raw"],
)
def hourly_measurements_etl():
    from airflow_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task(multiple_outputs=True)
    def extract_raw_data():

        from airflow_utils.airqo_utils import extract_airqo_data_from_thingspeak
        from airflow_utils.commons import fill_nan

        raw_airqo_data = extract_airqo_data_from_thingspeak(
            start_time=start_time, end_time=end_time, all_devices=False
        )
        return dict({"data": fill_nan(data=raw_airqo_data)})

    @task(multiple_outputs=True)
    def average_data_by_hour(raw_data: dict):

        from airflow_utils.airqo_utils import average_airqo_data
        from airflow_utils.commons import fill_nan, un_fill_nan

        raw_airqo_data = un_fill_nan(raw_data.get("data"))
        average_data = average_airqo_data(data=raw_airqo_data, frequency="hourly")

        return dict({"data": fill_nan(data=average_data)})

    @task(multiple_outputs=True)
    def extract_hourly_weather_data():
        from airflow_utils.airqo_utils import extract_airqo_weather_data_from_tahmo
        from airflow_utils.commons import fill_nan

        airqo_weather_data = extract_airqo_weather_data_from_tahmo(
            start_time=start_time, end_time=end_time, frequency="hourly"
        )
        return dict({"data": fill_nan(data=airqo_weather_data)})

    @task(multiple_outputs=True)
    def merge_data(averaged_hourly_data: dict, weather_data: dict):

        from airflow_utils.airqo_utils import merge_airqo_and_weather_data
        from airflow_utils.commons import fill_nan, un_fill_nan

        hourly_airqo_data = un_fill_nan(averaged_hourly_data.get("data"))
        hourly_weather_data = un_fill_nan(weather_data.get("data"))

        merged_measurements = merge_airqo_and_weather_data(
            airqo_data=hourly_airqo_data, weather_data=hourly_weather_data
        )

        return dict({"data": fill_nan(data=merged_measurements)})

    # @task.virtualenv(
    #     task_id="calibrate",
    #     requirements=[
    #         "numpy==1.21.2",
    #         "pandas==1.3.3",
    #         "protobuf==3.15.8",
    #         "pyarrow==3.0.0",
    #         "google-cloud-storage==1.41.1",
    #         "scikit_learn==0.24.1",
    #         "airflow_utils",
    #         "pyarrow==3.0.0"
    #     ],
    #     system_site_packages=True,
    #     multiple_outputs=True,
    #     python_version="3.7",
    # )
    @task(multiple_outputs=True)
    def calibrate(inputs: dict):
        from airflow_utils.commons import (
            fill_nan,
            un_fill_nan,
        )

        from airflow_utils.airqo_utils import calibrate_hourly_airqo_measurements

        data = un_fill_nan(inputs.get("data"))

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return dict({"data": fill_nan(data=airqo_calibrated_data)})

    @task()
    def send_hourly_measurements_to_api(airqo_data: dict):
        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_api import AirQoApi

        from airflow_utils.airqo_utils import restructure_airqo_data_for_api

        data = un_fill_nan(airqo_data.get("data"))

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    @task()
    def send_hourly_measurements_to_message_broker(airqo_data: dict):

        from airflow_utils.commons import un_fill_nan
        from airflow_utils.config import configuration
        from airflow_utils.message_broker import KafkaBrokerClient
        from airflow_utils.airqo_utils import restructure_airqo_data

        data = un_fill_nan(airqo_data.get("data"))
        airqo_restructured_data = restructure_airqo_data(
            data=data, destination="messageBroker"
        )

        info = {
            "data": airqo_restructured_data,
            "action": "new",
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_hourly_measurements_to_bigquery(airqo_data: dict):

        from airflow_utils.commons import un_fill_nan, save_measurements_to_bigquery
        from airflow_utils.config import configuration
        from airflow_utils.airqo_utils import restructure_airqo_data

        data = un_fill_nan(airqo_data.get("data"))
        airqo_restructured_data = restructure_airqo_data(
            data=data, destination="bigquery"
        )
        table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        save_measurements_to_bigquery(
            measurements=airqo_restructured_data, table_id=table_id
        )

    @task()
    def send_raw_measurements_to_bigquery(airqo_data: dict):

        from airflow_utils.commons import un_fill_nan, save_measurements_to_bigquery
        from airflow_utils.config import configuration
        from airflow_utils.airqo_utils import restructure_airqo_data

        data = un_fill_nan(airqo_data.get("data"))
        airqo_restructured_data = restructure_airqo_data(
            data=data, destination="bigquery"
        )
        table_id = configuration.BIGQUERY_RAW_EVENTS_TABLE
        save_measurements_to_bigquery(
            measurements=airqo_restructured_data, table_id=table_id
        )

    @task()
    def send_raw_measurements_to_api(airqo_data: dict):
        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_utils import restructure_airqo_data_for_api
        from airflow_utils.airqo_api import AirQoApi

        data = un_fill_nan(airqo_data.get("data"))

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    extracted_airqo_data = extract_raw_data()
    averaged_airqo_data = average_data_by_hour(extracted_airqo_data)
    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        averaged_hourly_data=averaged_airqo_data, weather_data=extracted_weather_data
    )
    calibrated_data = calibrate(merged_data)
    send_hourly_measurements_to_api(calibrated_data)
    send_hourly_measurements_to_message_broker(calibrated_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    send_raw_measurements_to_api(extracted_airqo_data)
    # send_raw_measurements_to_bigquery(extracted_airqo_data)


@dag(
    "AirQo-Daily-Measurements",
    schedule_interval="0 1 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "daily"],
)
def daily_measurements_etl():
    def time_values(**kwargs):
        from airflow_utils.date import date_to_str_days
        from datetime import datetime, timedelta

        try:
            dag_run = kwargs.get("dag_run")
            start_time = dag_run.conf["startTime"]
            end_time = dag_run.conf["endTime"]
        except KeyError:
            hour_of_day = datetime.utcnow() - timedelta(hours=24)
            start_time = date_to_str_days(hour_of_day)
            end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%23:59:59Z")

        return start_time, end_time

    @task(multiple_outputs=True)
    def extract_airqo_data(**kwargs):

        from airflow_utils.commons import fill_nan
        from airflow_utils.airqo_utils import extract_airqo_hourly_data_from_api

        start_time, end_time = time_values(**kwargs)
        data = extract_airqo_hourly_data_from_api(
            start_time=start_time, end_time=end_time
        )

        return dict({"data": fill_nan(data=data)})

    @task(multiple_outputs=True)
    def average_data(inputs: dict):

        from airflow_utils.commons import un_fill_nan, fill_nan
        from airflow_utils.airqo_utils import average_airqo_measurements

        data = un_fill_nan(inputs.get("data"))
        averaged_data = average_airqo_measurements(data=data, frequency="daily")

        return dict({"data": fill_nan(data=averaged_data)})

    @task(multiple_outputs=True)
    def extract_devices_logs():
        from airflow_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return dict({"data": logs})

    @task()
    def load(airqo_data: dict):

        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_api import AirQoApi
        from airflow_utils.airqo_utils import restructure_airqo_data_for_api

        data = un_fill_nan(airqo_data.get("data"))

        airqo_restructured_data = restructure_airqo_data_for_api(data=data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    hourly_airqo_data = extract_airqo_data()
    averaged_airqo_data = average_data(hourly_airqo_data)
    devices_logs = extract_devices_logs()
    load(airqo_data=averaged_airqo_data, device_logs=devices_logs)


historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
hourly_realtime_measurements_etl_dag = hourly_measurements_etl()
# airqo_daily_measurements_etl_dag = airqo_daily_measurements_etl()
