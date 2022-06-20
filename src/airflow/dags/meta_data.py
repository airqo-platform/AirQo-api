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
    def extract_sites(**kwargs) -> pd.DataFrame:
        from airqo_etl_utils.commons import get_tenant
        from airqo_etl_utils.meta_data_utils import extract_meta_data

        tenant = get_tenant(**kwargs)

        sites_data = extract_meta_data(
            component="sites",
            tenant=tenant,
        )

        return sites_data

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import JobAction

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.sites_table,
            job_action=JobAction.OVERWRITE,
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
    def extract_devices(**kwargs):
        from airqo_etl_utils.commons import get_tenant
        from airqo_etl_utils.meta_data_utils import extract_meta_data

        tenant = get_tenant(**kwargs)

        devices_data = extract_meta_data(
            component="devices",
            tenant=tenant,
        )

        return devices_data

    @task()
    def load(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.constants import JobAction

        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=big_query_api.devices_table,
            job_action=JobAction.OVERWRITE,
        )

    devices = extract_devices()
    load(devices)


big_query_update_sites_etl_dag = big_query_update_sites_etl()
big_query_update_devices_etl_dag = big_query_update_devices_etl()
