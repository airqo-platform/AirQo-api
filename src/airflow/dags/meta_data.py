from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "Update-BigQuery-Sites-AirQlouds-And-Devices",
    schedule="*/15 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "sites", "devices", "airqlouds"],
)
def update_big_query_airqlouds_sites_and_devices():
    import pandas as pd

    @task()
    def extract_airqlouds() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_airqlouds_from_api()

    @task()
    def load_airqlouds(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        BigQueryApi().update_airqlouds(data)

    @task()
    def update_airqloud_sites_table(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        data = MetaDataUtils.merge_airqlouds_and_sites(data)
        BigQueryApi().update_airqlouds_sites_table(data)

    @task()
    def extract_sites() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_sites_from_api()

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
    def extract_sites_meta_data() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_sites_meta_data_from_api()

    @task()
    def load_sites_meta_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        BigQueryApi().update_sites_meta_data(dataframe=data)

    @task()
    def extract_devices():
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_devices_from_api()

    @task()
    def load_devices(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_sites_and_devices(
            dataframe=data,
            table=big_query_api.devices_table,
            component="devices",
        )

    airqlouds = extract_airqlouds()
    load_airqlouds(airqlouds)
    update_airqloud_sites_table(airqlouds)
    devices = extract_devices()
    load_devices(devices)
    sites = extract_sites()
    load_sites(sites)
    sites_meta_data = extract_sites_meta_data()
    load_sites_meta_data(sites_meta_data)

@dag(
    "Update-BigQuery-Sites-Grids-And-Devices",
    schedule="*/15 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "sites", "devices", "grids"],
)
def update_big_query_grids_cohorts_sites_and_devices():
    import pandas as pd

    @task()
    def extract_grids() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_grids_from_api()

    @task()
    def load_grids(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        BigQueryApi().update_grids(data)

    @task()
    def extract_cohorts() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_cohorts_from_api()

    @task()
    def load_cohorts(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        BigQueryApi().update_cohorts(data)

    
    @task()
    def update_grid_sites_table(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        data = MetaDataUtils.merge_grids_and_sites(data)
        BigQueryApi().update_grids_sites_table(data)

    @task()
    def update_cohort_devices_table(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        data = MetaDataUtils.merge_cohorts_and_devices(data)
        BigQueryApi().update_cohorts_devices_table(data)

    @task()
    def extract_sites() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_sites_from_api()

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
    def extract_sites_meta_data() -> pd.DataFrame:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_sites_meta_data_from_api()

    @task()
    def load_sites_meta_data(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        BigQueryApi().update_sites_meta_data(dataframe=data)

    @task()
    def extract_devices():
        from airqo_etl_utils.meta_data_utils import MetaDataUtils

        return MetaDataUtils.extract_devices_from_api()

    @task()
    def load_devices(data: pd.DataFrame):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.update_sites_and_devices(
            dataframe=data,
            table=big_query_api.devices_table,
            component="devices",
        )

    grids = extract_grids()
    load_grids(grids)
    cohorts = extract_cohorts()
    load_cohorts(cohorts)
    update_grid_sites_table(grids)
    update_cohort_devices_table(cohorts)
    devices = extract_devices()
    load_devices(devices)
    sites = extract_sites()
    load_sites(sites)
    sites_meta_data = extract_sites_meta_data()
    load_sites_meta_data(sites_meta_data)


@dag(
    "Update-Grids-And-Sites-Meta-Data",
    schedule="@daily",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["daily", "sites", "meta-data", "airqlouds"],
)
def meta_data_update_microservice_sites_meta_data():
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
    def refresh_airqlouds() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils
        from airqo_etl_utils.constants import Tenant

        MetaDataUtils.refresh_airqlouds(tenant=Tenant.ALL)

    @task()
    def refresh_grids() -> None:
        from airqo_etl_utils.meta_data_utils import MetaDataUtils
        from airqo_etl_utils.constants import Tenant

        MetaDataUtils.refresh_grids(tenant=Tenant.ALL)

    update_nearest_weather_stations()
    update_distance_measures()
    refresh_airqlouds()
    refresh_grids()


update_big_query_airqlouds_sites_and_devices()
update_big_query_grids_cohorts_sites_and_devices()
meta_data_update_microservice_sites_meta_data()
