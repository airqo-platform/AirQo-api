from datetime import datetime
from airflow.decorators import dag, task

from airflow_utils.commons import slack_dag_failure_notification


@dag(
    "KCCA-Hourly-Measurements",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly"],
)
def hourly_measurements_etl():
    @task(multiple_outputs=True)
    def extract(**kwargs):
        from airflow_utils.date import date_to_str_hours
        from airflow_utils.kcca_utils import extract_kcca_measurements
        from airflow_utils.commons import fill_nan
        from datetime import datetime, timedelta

        try:
            dag_run = kwargs.get("dag_run")
            frequency = dag_run.conf["frequency"]
            start_time = dag_run.conf["startTime"]
            end_time = dag_run.conf["endTime"]
        except KeyError:
            frequency = "hourly"
            start_time = date_to_str_hours(datetime.utcnow() - timedelta(hours=4))
            end_time = date_to_str_hours(datetime.utcnow())

        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq=frequency
        )

        return dict({"data": fill_nan(kcca_data)})

    @task()
    def send_hourly_measurements_to_api(inputs: dict):

        from airflow_utils.kcca_utils import transform_kcca_measurements_for_api
        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_api import AirQoApi

        data = un_fill_nan(inputs.get("data"))
        kcca_data = transform_kcca_measurements_for_api(data)

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    @task()
    def send_hourly_measurements_to_message_broker(airqo_data: dict):

        from airflow_utils.kcca_utils import transform_kcca_data
        from airflow_utils.commons import un_fill_nan
        from airflow_utils.config import configuration
        from airflow_utils.message_broker import KafkaBrokerClient

        data = un_fill_nan(airqo_data.get("data"))
        kcca_restructured_data = transform_kcca_data(
            data=data, destination="messageBroker", frequency="hourly"
        )

        info = {
            "data": kcca_restructured_data,
            "action": "new",
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_hourly_measurements_to_bigquery(kcca_data: dict):

        from airflow_utils.kcca_utils import transform_kcca_data
        from airflow_utils.commons import un_fill_nan, save_measurements_to_bigquery
        from airflow_utils.config import configuration

        data = un_fill_nan(kcca_data.get("data"))
        kcca_restructured_data = transform_kcca_data(
            data=data, destination="bigquery", frequency="hourly"
        )
        table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
        save_measurements_to_bigquery(
            measurements=kcca_restructured_data, table_id=table_id
        )

    extracted_data = extract()
    send_hourly_measurements_to_message_broker(extracted_data)
    send_hourly_measurements_to_api(extracted_data)
    send_hourly_measurements_to_bigquery(extracted_data)


@dag(
    "KCCA-Raw-Measurements",
    schedule_interval="10 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "raw"],
)
def raw_measurements_etl():
    @task(multiple_outputs=True)
    def extract():

        from airflow_utils.kcca_utils import extract_kcca_measurements
        from airflow_utils.commons import fill_nan
        from airflow_utils.date import date_to_str
        from datetime import datetime, timedelta

        start_time = date_to_str(datetime.utcnow() - timedelta(hours=1))
        end_time = date_to_str(datetime.utcnow())

        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="raw"
        )

        return dict({"data": fill_nan(data=kcca_data)})

    @task(multiple_outputs=True)
    def transform(inputs: dict):

        from airflow_utils.kcca_utils import transform_kcca_measurements_for_api
        from airflow_utils.commons import un_fill_nan, fill_nan

        data = un_fill_nan(inputs.get("data"))

        cleaned_data = transform_kcca_measurements_for_api(data)
        return dict({"data": fill_nan(data=cleaned_data)})

    @task()
    def load(inputs: dict):

        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_api import AirQoApi

        kcca_data = un_fill_nan(inputs.get("data"))

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag(
    "KCCA-Daily-Measurements",
    schedule_interval="0 2 * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "daily"],
)
def daily_measurements_etl():
    @task(multiple_outputs=True)
    def extract():

        from airflow_utils.date import date_to_str_days
        from airflow_utils.kcca_utils import extract_kcca_measurements
        from airflow_utils.commons import fill_nan
        from datetime import datetime, timedelta

        start_time = date_to_str_days(datetime.utcnow() - timedelta(days=3))
        end_time = date_to_str_days(datetime.utcnow())

        daily_kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="daily"
        )

        return dict({"data": fill_nan(data=daily_kcca_data)})

    @task(multiple_outputs=True)
    def transform(inputs: dict):

        from airflow_utils.kcca_utils import transform_kcca_measurements_for_api
        from airflow_utils.commons import un_fill_nan, fill_nan

        data = un_fill_nan(inputs.get("data"))
        cleaned_data = transform_kcca_measurements_for_api(data)

        return dict({"data": fill_nan(data=cleaned_data)})

    @task()
    def load(inputs: dict):

        from airflow_utils.commons import un_fill_nan
        from airflow_utils.airqo_api import AirQoApi

        kcca_data = un_fill_nan(inputs.get("data"))

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    load(transformed_data)


@dag(
    "Kcca-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly", "historical"],
)
def historical_hourly_measurements_etl():
    @task()
    def extract(**kwargs):

        from airflow_utils.kcca_utils import extract_kcca_measurements
        from airflow_utils.commons import fill_nan, get_time_values

        start_time, end_time = get_time_values(**kwargs)
        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="hourly"
        )

        return dict({"data": fill_nan(kcca_data)})

    @task()
    def load(kcca_data: dict, **kwargs):

        from airflow_utils.kcca_utils import (
            transform_kcca_measurements_for_api,
            transform_kcca_data,
        )
        from airflow_utils.commons import un_fill_nan, save_measurements_to_bigquery
        from airflow_utils.airqo_api import AirQoApi
        from airflow_utils.config import configuration

        data = un_fill_nan(kcca_data.get("data"))

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            kcca_transformed_data = transform_kcca_data(
                data=data, destination="bigquery", frequency="hourly"
            )
            table_id = configuration.BIGQUERY_HOURLY_EVENTS_TABLE
            save_measurements_to_bigquery(
                measurements=kcca_transformed_data, table_id=table_id
            )

        else:
            kcca_transformed_data = transform_kcca_measurements_for_api(data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=kcca_transformed_data, tenant="kcca")

    extract_data = extract()
    load(extract_data)


raw_measurements_etl_dag = raw_measurements_etl()
hourly_measurements_etl_dag = hourly_measurements_etl()
daily_measurements_etl_dag = daily_measurements_etl()
historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
