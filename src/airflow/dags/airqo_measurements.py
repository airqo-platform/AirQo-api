from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification
from airqo_etl_utils.constants import Frequency


@dag(
    "AirQo-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "historical", "low cost"],
)
def historical_hourly_measurements_etl():
    import pandas as pd

    @task()
    def extract_device_measurements(**kwargs):
        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        return AirQoDataUtils.extract_hourly_data(
            start_date_time=start_date_time,
            end_date_time=end_date_time,
        )

    @task()
    def extract_weather_data(**kwargs):
        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.calibration_utils import CalibrationUtils

        start_date_time, end_date_time = get_date_time_values(**kwargs)

        return CalibrationUtils.extract_hourly_weather_data(
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

        return CalibrationUtils.calibrate_airqo_data(measurements=measurements)

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

    extracted_device_measurements = extract_device_measurements()
    extracted_weather_data = extract_weather_data()
    merged_data = merge_data(
        device_measurements=extracted_device_measurements,
        weather_data=extracted_weather_data,
    )
    calibrated_data = calibrate_data(merged_data)
    load(calibrated_data)


@dag(
    "AirQo-Historical-Raw-Low-Cost-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "raw", "historical", "low cost"],
)
def historical_raw_measurements_etl():
    import pandas as pd

    @task()
    def extract_raw_data(**kwargs):

        from airqo_etl_utils.commons import get_date_time_values
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        start_time, end_time = get_date_time_values(**kwargs)
        return AirQoDataUtils.extract_low_cost_sensors_data(
            start_date_time=start_time, end_date_time=end_time
        )

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
    def load(airqo_data: pd.DataFrame):

        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.raw_measurements_table,
        )

    raw_data = extract_raw_data()
    device_logs = extract_device_deployment_logs()
    data_with_site_ids = map_site_ids(airqo_data=raw_data, deployment_logs=device_logs)
    load(data_with_site_ids)


@dag(
    "AirQo-Realtime-Low-Cost-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["airqo", "hourly", "realtime", "raw", "low cost"],
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
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.extract_low_cost_sensors_data(
            start_date_time=start_time, end_date_time=end_time
        )

    @task()
    def aggregate(raw_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        return AirQoDataUtils.aggregate_low_cost_sensors_data(data=raw_data)

    @task()
    def extract_hourly_weather_data():
        from airqo_etl_utils.weather_data_utils import WeatherDataUtils

        return WeatherDataUtils.extract_hourly_data(
            start_date_time=start_time, end_date_time=end_time
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

        return CalibrationUtils.calibrate_airqo_data(measurements=data)

    @task()
    def send_hourly_measurements_to_api(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_data_for_api(
            airqo_data, frequency=Frequency.HOURLY
        )

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=data, tenant="airqo")

    @task()
    def send_hourly_measurements_to_message_broker(airqo_data: pd.DataFrame):
        from airqo_etl_utils.config import configuration
        from airqo_etl_utils.message_broker import KafkaBrokerClient
        from airqo_etl_utils.airqo_utils import AirQoDataUtils

        data = AirQoDataUtils.process_data_for_message_broker(
            data=airqo_data, frequency=Frequency.HOURLY
        )
        info = {"data": data, "action": "insert", "tenant": "airqo"}

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

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
    def update_app_insights(airqo_data: pd.DataFrame):
        from airqo_etl_utils.app_insights_utils import AirQoAppUtils

        insights = AirQoAppUtils.format_data_to_insights(
            data=airqo_data, frequency=Frequency.HOURLY
        )

        AirQoAppUtils.save_insights(insights_data=insights)

    @task()
    def send_raw_measurements_to_bigquery(airqo_data: pd.DataFrame):
        from airqo_etl_utils.airqo_utils import AirQoDataUtils
        from airqo_etl_utils.bigquery_api import BigQueryApi

        data = AirQoDataUtils.process_raw_data_for_bigquery(data=airqo_data)
        big_query_api = BigQueryApi()
        big_query_api.load_data(data, table=big_query_api.raw_measurements_table)

    extracted_airqo_data = extract_raw_data()
    averaged_airqo_data = aggregate(extracted_airqo_data)
    extracted_weather_data = extract_hourly_weather_data()
    merged_data = merge_data(
        averaged_hourly_data=averaged_airqo_data, weather_data=extracted_weather_data
    )
    calibrated_data = calibrate(merged_data)
    send_hourly_measurements_to_api(calibrated_data)
    # send_hourly_measurements_to_message_broker(calibrated_data)
    send_hourly_measurements_to_bigquery(calibrated_data)
    update_app_insights(calibrated_data)
    send_raw_measurements_to_bigquery(extracted_airqo_data)


historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
airqo_realtime_measurements_etl_dag = airqo_realtime_measurements_etl()
historical_raw_measurements_etl_dag = historical_raw_measurements_etl()
