from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Update-BigQuery-Sites-And-Devices",
    schedule_interval="@hourly",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "sites", "devices"],
)
def big_query_update_sites_and_devices_etl():
    import pandas as pd

    @task()
    def extract_sites() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_meta_data(component="sites")

    @task()
    def extract_devices():
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_meta_data(component="devices")

    @task()
    def load_sites(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_sites_and_devices(
            dataframe=data,
            table=big_query_api.sites_table,
            component="sites",
        )

    @task()
    def load_devices(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_sites_and_devices(
            dataframe=data,
            table=big_query_api.devices_table,
            component="devices",
        )

    devices = extract_devices()
    sites = extract_sites()
    load_sites(sites)
    load_devices(devices)


@dag(
    "Update-Sites-Meta-Data",
    schedule_interval="@daily",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "sites", "meta-data"],
)
def update_sites_meta_data_etl():
    @task()
    def update_nearest_weather_stations() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils
        from airqo_etl_utils.constants import Tenant

        MetaDataUtils.update_nearest_weather_stations(tenant=Tenant.ALL)

    @task()
    def update_distance_measures() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils
        from airqo_etl_utils.constants import Tenant

        MetaDataUtils.update_sites_distance_measures(tenant=Tenant.ALL)

    @task()
    def update_bigquery_meta_data() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        MetaDataUtils.update_bigquery_meta_data()

    update_nearest_weather_stations.set_downstream(update_bigquery_meta_data)
    update_distance_measures.set_downstream(update_bigquery_meta_data)


big_query_update_sites_and_devices_etl_dag = big_query_update_sites_and_devices_etl()
update_sites_meta_data_etl_dag = update_sites_meta_data_etl()
