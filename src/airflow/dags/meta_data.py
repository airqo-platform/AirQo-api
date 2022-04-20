from datetime import datetime

from airflow.decorators import dag, task

from airqo_etl_utils.commons import slack_dag_failure_notification


@dag(
    "Update-BigQuery-Sites",
    schedule_interval="@daily",
    on_failure_callback=slack_dag_failure_notification,
    start_date=datetime(2021, 1, 1),
    catchup=False,
    tags=["daily", "sites", "bigquery"],
)
def big_query_update_sites_etl():
    @task(multiple_outputs=True)
    def extract_sites(**kwargs):
        from airqo_etl_utils.commons import get_tenant, fill_nan
        from airqo_etl_utils.meta_data_utils import extract_meta_data

        tenant = get_tenant(**kwargs)

        sites_data = extract_meta_data(
            component="sites",
            tenant=tenant,
        )

        return dict({"data": fill_nan(data=sites_data)})

    @task()
    def load(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi, JobAction
        from airqo_etl_utils.commons import un_fill_nan

        data = un_fill_nan(inputs.get("data"))

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=data,
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
    @task(multiple_outputs=True)
    def extract_devices(**kwargs):
        from airqo_etl_utils.commons import get_tenant, fill_nan
        from airqo_etl_utils.meta_data_utils import extract_meta_data

        tenant = get_tenant(**kwargs)

        devices_data = extract_meta_data(
            component="devices",
            tenant=tenant,
        )

        return dict({"data": fill_nan(data=devices_data)})

    @task()
    def load(inputs: dict):
        from airqo_etl_utils.bigquery_api import BigQueryApi, JobAction
        from airqo_etl_utils.commons import un_fill_nan

        data = un_fill_nan(inputs.get("data"))

        big_query_api = BigQueryApi()
        big_query_api.save_data(
            data=data,
            table=big_query_api.devices_table,
            job_action=JobAction.OVERWRITE,
        )

    devices = extract_devices()
    load(devices)


big_query_update_sites_etl_dag = big_query_update_sites_etl()
big_query_update_devices_etl_dag = big_query_update_devices_etl()
