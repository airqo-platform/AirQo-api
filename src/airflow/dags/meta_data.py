from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import slack_dag_failure_notification


@dag(
    "Update-BigQuery-Sites",
    schedule_interval="@daily",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["daily", "sites", "bigquery"],
)
def big_query_update_sites_etl():
    import pandas as pd

    @task()
    def extract_sites() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_meta_data(component="sites")

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.sites_table,
            component="sites",
        )

    sites = extract_sites()
    load(sites)


@dag(
    "Update-BigQuery-Devices",
    schedule_interval="@daily",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["daily", "devices", "bigquery"],
)
def big_query_update_devices_etl():
    import pandas as pd

    @task()
    def extract_devices():
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_meta_data(component="devices")

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.devices_table,
            component="devices",
        )

    devices = extract_devices()
    load(devices)


@dag(
    "Update-Sites-Meta-Data",
    schedule_interval="@daily",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["daily", "sites", "meta-data"],
)
def update_sites_meta_data_etl():
    @task()
    def update_nearest_weather_stations() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils
        from airqo_etl_utils.constants import Tenant

        MetaDataUtils.update_nearest_weather_stations(tenant=Tenant.ALL)

    update_nearest_weather_stations()


big_query_update_sites_etl_dag = big_query_update_sites_etl()
big_query_update_devices_etl_dag = big_query_update_devices_etl()
update_sites_meta_data_etl_dag = update_sites_meta_data_etl()
