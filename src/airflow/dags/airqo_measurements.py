from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "historical"],
)
def historical_hourly_measurements_etl():
    import pandas as pd

    @task()
    def extract_hourly_raw_data(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import (
            extract_airqo_data_from_thingspeak,
            average_airqo_data,
        )

        start_time, end_time = get_date_time_values(**kwargs)
        raw_airqo_data = extract_airqo_data_from_thingspeak(
            start_time=start_time, end_time=end_time
        )
        average_data = average_airqo_data(data=raw_airqo_data, frequency="hourly")

        return average_data

    @task()
    def extract_device_deployment_logs():

        from airqo_etl_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return logs

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import map_site_ids_to_historical_measurements

        restructured_data = map_site_ids_to_historical_measurements(
            data=airqo_data, deployment_logs=deployment_logs
        )

        return restructured_data

    @task()
    def extract_hourly_weather_data(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import extract_airqo_weather_data_from_tahmo

        start_time, end_time = get_date_time_values(**kwargs)
        airqo_weather_data = extract_airqo_weather_data_from_tahmo(
            start_time=start_time, end_time=end_time, frequency="hourly"
        )
        return airqo_weather_data

    @task()
    def merge_data(averaged_airqo_data: pd.DataFrame, weather_data: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import merge_airqo_and_weather_data

        merged_measurements = merge_airqo_and_weather_data(
            airqo_data=averaged_airqo_data, weather_data=weather_data
        )

        return merged_measurements

    @task()
    def calibrate(data: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import calibrate_hourly_airqo_measurements

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return airqo_calibrated_data

    @task()
    def load(airqo_data: pd.DataFrame, **kwargs):

        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.config import configuration
        from airqo_etl_utils.message_broker import KafkaBrokerClient

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="bigquery"
            )
            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=airqo_restructured_data,
                table=big_query_api.hourly_measurements_table,
            )

        elif destination == "message-broker":
            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="message-broker"
            )

            info = {
                "data": airqo_restructured_data,
                "action": "insert",
                "tenant": "airqo",
            }
            kafka = KafkaBrokerClient()
            kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)
        elif destination == "api":
            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="api"
            )
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")
        else:
            raise Exception(
                "Invalid data destination. Valid values are bigquery, message-broker and api"
            )

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
    "AirQo-Historical-Data-Calibration",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "calibration", "historical"],
)
def historical_data_calibration_etl():
    @task()
    def extract_hourly_device_measurements(**kwargs):
        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.bigquery_api import BigQueryApi

        bigquery_api = BigQueryApi()

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        measurements = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=[
                "s1_pm2_5",
                "s2_pm2_5",
                "s1_pm10",
                "s2_pm10",
                "timestamp",
                "external_temperature",
                "external_humidity",
                "device_number",
                "site_id",
            ],
            table=bigquery_api.hourly_measurements_table,
            tenant="airqo",
        )

        return measurements

    @task()
    def extract_hourly_weather_data(**kwargs):
        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.bigquery_api import BigQueryApi

        bigquery_api = BigQueryApi()

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        data = bigquery_api.query_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
            columns=["site_id", "timestamp", "temperature", "humidity"],
            table=bigquery_api.hourly_weather_table,
            tenant="airqo",
        )

        return data

    @task()
    def merge_data(hourly_device_measurements, hourly_weather_data):
        import pandas as pd

        measurements = pd.merge(
            left=hourly_device_measurements,
            right=hourly_weather_data,
            how="left",
            on=["site_id", "timestamp"],
        )

        measurements = measurements.dropna(
            subset=[
                "site_id",
                "s1_pm2_5",
                "s2_pm2_5",
                "s1_pm10",
                "s2_pm10",
                "timestamp",
                "device_number",
            ]
        )

        measurements["temperature"] = measurements["temperature"].fillna(
            measurements["external_temperature"]
        )

        measurements["humidity"] = measurements["humidity"].fillna(
            measurements["external_humidity"]
        )

        del measurements["external_humidity"]
        del measurements["external_temperature"]

        measurements = measurements.dropna(subset=["temperature", "humidity"])

        measurements.rename(
            columns={"timestamp": "time", "device_number": "device_id"}, inplace=True
        )

        return measurements

    @task()
    def calibrate_and_save(measurements):
        from airqo_etl_utils.airqo_utils import calibrate_hourly_airqo_measurements
        from airqo_etl_utils.bigquery_api import BigQueryApi

        bigquery_api = BigQueryApi()

        n = 1000
        measurements_list = [
            measurements[i : i + n] for i in range(0, measurements.shape[0], n)
        ]
        for chunk in measurements_list:
            calibrated_data = calibrate_hourly_airqo_measurements(measurements=chunk)
            calibrated_data.rename(
                columns={
                    "time": "timestamp",
                    "device_id": "device_number",
                    "calibrated_pm2_5": "pm2_5_calibrated_value",
                    "calibrated_pm10": "pm10_calibrated_value",
                },
                inplace=True,
            )
            calibrated_data["tenant"] = "airqo"
            bigquery_api.load_data(
                dataframe=calibrated_data,
                table=bigquery_api.calibrated_hourly_measurements_table,
            )

    device_measurements = extract_hourly_device_measurements()
    weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        hourly_device_measurements=device_measurements, hourly_weather_data=weather_data
    )
    calibrate_and_save(merged_data)


@dag(
    "AirQo-Historical-Raw-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "raw", "historical"],
)
def historical_raw_measurements_etl():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import (
            extract_airqo_data_from_thingspeak,
        )

        start_time, end_time = get_date_time_values(**kwargs)
        raw_airqo_data = extract_airqo_data_from_thingspeak(
            start_time=start_time, end_time=end_time
        )

        return raw_airqo_data

    @task()
    def extract_device_deployment_logs():

        from airqo_etl_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return logs

    @task()
    def map_site_ids(airqo_data: pd.DataFrame, deployment_logs: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import map_site_ids_to_historical_measurements

        restructured_data = map_site_ids_to_historical_measurements(
            data=airqo_data, deployment_logs=deployment_logs
        )

        return restructured_data

    @task()
    def load(airqo_data: pd.DataFrame, **kwargs):

        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.config import configuration

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            from airqo_etl_utils.bigquery_api import BigQueryApi

            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="bigquery"
            )
            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=airqo_restructured_data,
                table=big_query_api.raw_measurements_table,
            )

        elif destination == "message-broker":
            from airqo_etl_utils.message_broker import KafkaBrokerClient

            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="message-broker"
            )

            info = {
                "data": airqo_restructured_data,
                "action": "insert",
                "tenant": "airqo",
            }
            kafka = KafkaBrokerClient()
            kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)
        elif destination == "api":
            from airqo_etl_utils.airqo_api import AirQoApi

            airqo_restructured_data = restructure_airqo_data(
                data=airqo_data, destination="api"
            )
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")
        else:
            raise Exception(
                "Invalid data destination. Valid values are bigquery, message-broker and api"
            )

    extracted_airqo_data = extract_raw_data()
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = map_site_ids(
        airqo_data=extracted_airqo_data, deployment_logs=device_logs
    )
    load(data_with_site_ids)


@dag(
    "AirQo-Realtime-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "realtime", "raw"],
)
def airqo_realtime_measurements_etl():
    import pandas as pd

    from airqo_etl_utils.date import date_to_str_hours
    from datetime import datetime, timedelta

    hour_of_day = datetime.utcnow() - timedelta(hours=1)
    start_time = date_to_str_hours(hour_of_day)
    end_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

    @task()
    def extract_raw_data():
        from airqo_etl_utils.airqo_utils import extract_airqo_data_from_thingspeak

        raw_airqo_data = extract_airqo_data_from_thingspeak(
            start_time=start_time, end_time=end_time
        )
        return raw_airqo_data

    @task()
    def average_data_by_hour(raw_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import average_airqo_data

        average_data = average_airqo_data(data=raw_data, frequency="hourly")

        return average_data

    @task()
    def extract_hourly_weather_data():
        from airqo_etl_utils.airqo_utils import extract_airqo_weather_data_from_tahmo

        airqo_weather_data = extract_airqo_weather_data_from_tahmo(
            start_time=start_time, end_time=end_time, frequency="hourly"
        )
        return airqo_weather_data

    @task()
    def merge_data(averaged_hourly_data: pd.DataFrame, weather_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import merge_airqo_and_weather_data

        merged_measurements = merge_airqo_and_weather_data(
            airqo_data=averaged_hourly_data, weather_data=weather_data
        )

        return merged_measurements

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
        from airqo_etl_utils.airqo_utils import calibrate_hourly_airqo_measurements

        airqo_calibrated_data = calibrate_hourly_airqo_measurements(measurements=data)

        return airqo_calibrated_data

    @task()
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import restructure_airqo_data

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="api"
        )
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    @task()
    def send_hourly_measurements_to_message_broker(airqo_data: pd.DataFrame):
        from airqo_etl_utils.config import configuration
        from airqo_etl_utils.message_broker import KafkaBrokerClient
        from airqo_etl_utils.airqo_utils import restructure_airqo_data

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="message-broker"
        )

        info = {"data": airqo_restructured_data, "action": "insert", "tenant": "airqo"}

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_hourly_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.bigquery_api import BigQueryApi

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="bigquery"
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=airqo_restructured_data,
            table=big_query_api.hourly_measurements_table,
        )

    @task()
    def update_app_insights(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.app_insights_utils import save_insights_data

        insights_data = restructure_airqo_data(
            data=airqo_data, destination="app-insights"
        )
        save_insights_data(insights_data=insights_data, partition=0)

    @task()
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.bigquery_api import BigQueryApi

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="bigquery"
        )

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            airqo_restructured_data, table=big_query_api.raw_measurements_table
        )

    @task()
    def send_raw_measurements_to_api(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import restructure_airqo_data
        from airqo_etl_utils.airqo_api import AirQoApi

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="api"
        )
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
    update_app_insights(calibrated_data)
    send_raw_measurements_to_bigquery(extracted_airqo_data)

    # Temporarily disabling sanding raw data device registry API
    # send_raw_measurements_to_api(extracted_airqo_data)


@dag(
    "AirQo-Daily-Measurements",
    schedule_interval="0 1 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "daily"],
)
def daily_measurements_etl():
    import pandas as pd

    def time_values(**kwargs):
        from airqo_etl_utils.date import date_to_str_days
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

    @task()
    def extract_airqo_data(**kwargs):

        from airqo_etl_utils.airqo_utils import extract_airqo_hourly_data_from_api

        start_time, end_time = time_values(**kwargs)
        data = extract_airqo_hourly_data_from_api(
            start_time=start_time, end_time=end_time
        )

        return data

    @task()
    def average_data(data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import average_airqo_measurements

        averaged_data = average_airqo_measurements(data=data, frequency="daily")

        return averaged_data

    @task()
    def extract_devices_logs():
        from airqo_etl_utils.airqo_utils import extract_airqo_devices_deployment_history

        logs = extract_airqo_devices_deployment_history()

        return logs

    @task()
    def load(airqo_data: pd.DataFrame):

        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import restructure_airqo_data

        airqo_restructured_data = restructure_airqo_data(
            data=airqo_data, destination="api"
        )
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=airqo_restructured_data, tenant="airqo")

    hourly_airqo_data = extract_airqo_data()
    averaged_airqo_data = average_data(hourly_airqo_data)
    devices_logs = extract_devices_logs()
    load(airqo_data=averaged_airqo_data, device_logs=devices_logs)


historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
airqo_realtime_measurements_etl_dag = airqo_realtime_measurements_etl()
historical_raw_measurements_etl_dag = historical_raw_measurements_etl()
historical_data_calibration_etl_dag = historical_data_calibration_etl()
# airqo_daily_measurements_etl_dag = airqo_daily_measurements_etl()
