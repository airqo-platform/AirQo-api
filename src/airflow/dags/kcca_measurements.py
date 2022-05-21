from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "KCCA-Hourly-Measurements",
    schedule_interval="30 * * * *",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly"],
)
def hourly_measurements_etl():
    import pandas as pd

    @task()
    def extract():
        from airqo_etl_utils.date import date_to_str_hours
        from airqo_etl_utils.kcca_utils import extract_kcca_measurements
        from datetime import datetime, timedelta

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        kcca_data = extract_kcca_measurements(
            start_time=start_date_time, end_time=end_date_time, freq="hourly"
        )

        return kcca_data

    @task()
    def send_hourly_measurements_to_api(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import transform_kcca_measurements_for_api
        from airqo_etl_utils.airqo_api import AirQoApi

        kcca_data = transform_kcca_measurements_for_api(data)

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    @task()
    def send_hourly_measurements_to_message_broker(kcca_data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import transform_kcca_data_for_message_broker
        from airqo_etl_utils.config import configuration
        from airqo_etl_utils.message_broker import KafkaBrokerClient

        kcca_restructured_data = transform_kcca_data_for_message_broker(
            data=kcca_data, frequency="hourly"
        )

        info = {"data": kcca_restructured_data, "action": "insert", "tenant": "kcca"}

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_hourly_measurements_to_bigquery(kcca_data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import transform_kcca_data_for_bigquery
        from airqo_etl_utils.bigquery_api import BigQueryApi

        kcca_restructured_data = transform_kcca_data_for_bigquery(kcca_data)

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=kcca_restructured_data,
            table=big_query_api.hourly_measurements_table,
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
    import pandas as pd

    @task()
    def extract():
        from airqo_etl_utils.kcca_utils import extract_kcca_measurements
        from airqo_etl_utils.date import date_to_str
        from datetime import datetime, timedelta

        start_time = date_to_str(datetime.utcnow() - timedelta(hours=1))
        end_time = date_to_str(datetime.utcnow())

        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="raw"
        )

        return kcca_data

    @task()
    def transform(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import transform_kcca_data_for_bigquery

        cleaned_data = transform_kcca_data_for_bigquery(data)
        return cleaned_data

    @task()
    def load(kcca_data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=kcca_data,
            table=big_query_api.raw_measurements_table,
        )

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
    import pandas as pd

    @task()
    def extract():
        from airqo_etl_utils.date import date_to_str_days
        from airqo_etl_utils.kcca_utils import extract_kcca_measurements
        from datetime import datetime, timedelta

        start_time = date_to_str_days(datetime.utcnow() - timedelta(days=3))
        end_time = date_to_str_days(datetime.utcnow())

        daily_kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="daily"
        )

        return daily_kcca_data

    @task()
    def send_to_api(kcca_data: pd.DataFrame):
        from airqo_etl_utils.airqo_api import AirQoApi
        from airqo_etl_utils.kcca_utils import transform_kcca_measurements_for_api

        cleaned_data = transform_kcca_measurements_for_api(kcca_data)
        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=cleaned_data, tenant="kcca")

    extracted_data = extract()
    send_to_api(extracted_data)


@dag(
    "Kcca-Historical-Hourly-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "hourly", "historical"],
)
def historical_hourly_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs):

        from airqo_etl_utils.kcca_utils import extract_kcca_measurements
        from airqo_etl_utils.commons import get_date_time_values

        start_time, end_time = get_date_time_values(**kwargs)
        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="hourly"
        )

        return kcca_data

    @task()
    def load(kcca_data: pd.DataFrame, **kwargs):

        from airqo_etl_utils.kcca_utils import (
            transform_kcca_measurements_for_api,
            transform_kcca_data_for_bigquery,
            transform_kcca_data_for_message_broker,
        )

        from airqo_etl_utils.config import configuration

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":
            from airqo_etl_utils.bigquery_api import BigQueryApi

            kcca_transformed_data = transform_kcca_data_for_bigquery(kcca_data)

            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=kcca_transformed_data,
                table=big_query_api.hourly_measurements_table,
            )

        elif destination == "message-broker":

            from airqo_etl_utils.message_broker import KafkaBrokerClient

            kcca_transformed_data = transform_kcca_data_for_message_broker(
                data=kcca_data, frequency="hourly"
            )

            info = {"data": kcca_transformed_data, "action": "insert", "tenant": "kcca"}

            kafka = KafkaBrokerClient()
            kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

        elif destination == "api":
            from airqo_etl_utils.airqo_api import AirQoApi

            kcca_transformed_data = transform_kcca_measurements_for_api(kcca_data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=kcca_transformed_data, tenant="kcca")

        else:
            raise Exception(
                "Invalid data destination. Valid values are bigquery, message-broker and api"
            )

    extract_data = extract()
    load(extract_data)


@dag(
    "Kcca-Historical-Raw-Measurements",
    schedule_interval=None,
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["kcca", "raw", "historical"],
)
def historical_raw_measurements_etl():
    import pandas as pd

    @task()
    def extract(**kwargs):

        from airqo_etl_utils.kcca_utils import extract_kcca_measurements
        from airqo_etl_utils.commons import get_date_time_values

        start_time, end_time = get_date_time_values(**kwargs)
        kcca_data = extract_kcca_measurements(
            start_time=start_time, end_time=end_time, freq="raw"
        )

        return kcca_data

    @task()
    def load(kcca_data: pd.DataFrame, **kwargs):

        from airqo_etl_utils.kcca_utils import (
            transform_kcca_measurements_for_api,
            transform_kcca_data_for_bigquery,
            transform_kcca_data_for_message_broker,
        )

        from airqo_etl_utils.config import configuration

        try:
            dag_run = kwargs.get("dag_run")
            destination = dag_run.conf["destination"]
        except KeyError:
            destination = "bigquery"

        if destination == "bigquery":

            from airqo_etl_utils.bigquery_api import BigQueryApi

            kcca_transformed_data = transform_kcca_data_for_bigquery(kcca_data)

            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=kcca_transformed_data,
                table=big_query_api.raw_measurements_table,
            )

        elif destination == "message-broker":

            from airqo_etl_utils.message_broker import KafkaBrokerClient

            kcca_transformed_data = transform_kcca_data_for_message_broker(
                data=kcca_data, frequency="raw"
            )

            info = {"data": kcca_transformed_data, "action": "insert", "tenant": "kcca"}

            kafka = KafkaBrokerClient()
            kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

        elif destination == "api":
            from airqo_etl_utils.airqo_api import AirQoApi

            kcca_transformed_data = transform_kcca_measurements_for_api(kcca_data)
            airqo_api = AirQoApi()
            airqo_api.save_events(measurements=kcca_transformed_data, tenant="kcca")

        else:
            raise Exception(
                "Invalid data destination. Valid values are bigquery, message-broker and api"
            )

    extract_data = extract()
    load(extract_data)


raw_measurements_etl_dag = raw_measurements_etl()
historical_raw_measurements_etl_dag = historical_raw_measurements_etl()
hourly_measurements_etl_dag = hourly_measurements_etl()
daily_measurements_etl_dag = daily_measurements_etl()
historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
