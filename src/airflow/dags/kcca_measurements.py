from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


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
        from airqo_etl_utils.kcca_utils import KccaUtils
        from airqo_etl_utils.date import date_to_str_hours
        from datetime import datetime, timedelta

        hour_of_day = datetime.utcnow() - timedelta(hours=1)
        start_date_time = date_to_str_hours(hour_of_day)
        end_date_time = datetime.strftime(hour_of_day, "%Y-%m-%dT%H:59:59Z")

        return KccaUtils.extract_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import KccaUtils

        return KccaUtils.transform_data(data)

    @task()
    def send_to_api(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import KccaUtils
        from airqo_etl_utils.airqo_api import AirQoApi

        kcca_data = KccaUtils.transform_data_for_api(data)

        airqo_api = AirQoApi()
        airqo_api.save_events(measurements=kcca_data, tenant="kcca")

    @task()
    def send_to_message_broker(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import KccaUtils
        from airqo_etl_utils.config import configuration
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.message_broker import KafkaBrokerClient

        kcca_restructured_data = KccaUtils.transform_data_for_message_broker(data=data)

        info = {
            "data": kcca_restructured_data,
            "action": "insert",
            "tenant": str(Tenant.KCCA),
        }

        kafka = KafkaBrokerClient()
        kafka.send_data(info=info, topic=configuration.HOURLY_MEASUREMENTS_TOPIC)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        table = big_query_api.hourly_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, tenant=Tenant.KCCA, table=table
        )
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    @task()
    def update_latest_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.kcca_utils import KccaUtils
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant

        data = KccaUtils.process_latest_data(data=data)

        big_query_api = BigQueryApi()
        table = big_query_api.latest_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, table=table, tenant=Tenant.KCCA
        )

        big_query_api.update_data(data, table=table)

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    send_to_message_broker(transformed_data)
    send_to_api(transformed_data)
    update_latest_data(transformed_data)
    send_to_bigquery(transformed_data)


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
        from airqo_etl_utils.date import DateUtils
        from airqo_etl_utils.kcca_utils import KccaUtils

        start_date_time, end_date_time = DateUtils.get_dag_date_time_values(**kwargs)
        return KccaUtils.extract_data(
            start_date_time=start_date_time, end_date_time=end_date_time
        )

    @task()
    def transform(data: pd.DataFrame):
        from airqo_etl_utils.kcca_utils import KccaUtils

        return KccaUtils.transform_data(data)

    @task()
    def send_to_bigquery(data: pd.DataFrame):
        from airqo_etl_utils.data_validator import DataValidationUtils
        from airqo_etl_utils.constants import Tenant
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        table = big_query_api.hourly_measurements_table

        data = DataValidationUtils.process_for_big_query(
            dataframe=data, tenant=Tenant.KCCA, table=table
        )
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    extracted_data = extract()
    transformed_data = transform(extracted_data)
    send_to_bigquery(transformed_data)


hourly_measurements_etl_dag = hourly_measurements_etl()
historical_hourly_measurements_etl_dag = historical_hourly_measurements_etl()
