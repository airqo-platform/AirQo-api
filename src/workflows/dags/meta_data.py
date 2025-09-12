from airflow.decorators import dag, task
import pandas as pd
from datetime import timedelta

from airqo_etl_utils.meta_data_utils import MetaDataUtils
from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.bigquery_api import BigQueryApi
from dag_docs import (
    extract_store_devices_data_in_temp_store,
    extract_store_sites_data_in_temp_store,
    compute_store_devices_metadata_doc,
    compute_store_devices_baseline_doc,
)
from airqo_etl_utils.constants import (
    MetaDataType,
    DeviceNetwork,
    Frequency,
    DeviceCategory,
    DataType,
)
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.commons import upload_dataframe_to_gcs


@dag(
    "Update-BigQuery-Sites-AirQlouds-And-Devices",
    schedule="*/15 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["hourly", "sites", "devices", "airqlouds"],
)
def update_big_query_airqlouds_sites_and_devices():
    @task()
    def extract_airqlouds() -> pd.DataFrame:
        return MetaDataUtils.extract_airqlouds_from_api()

    @task()
    def load_airqlouds(data: pd.DataFrame):
        bigq_api = BigQueryApi()
        bigq_api.update_meta_data(
            data, bigq_api.airqlouds_table, MetaDataType.AIRQLOUDS
        )

    @task()
    def update_airqloud_sites_table(data: pd.DataFrame):
        data = MetaDataUtils.merge_airqlouds_and_sites(data)
        BigQueryApi().update_airqlouds_sites_table(data)

    @task()
    def extract_sites() -> pd.DataFrame:
        return MetaDataUtils.extract_sites()

    @task()
    def load_sites(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.sites_table,
            component=MetaDataType.SITES,
        )

    @task()
    def extract_sites_meta_data() -> pd.DataFrame:
        return MetaDataUtils.extract_sites_meta_data()

    @task()
    def load_sites_meta_data(data: pd.DataFrame):
        BigQueryApi().update_sites_meta_data(dataframe=data)

    @task()
    def extract_devices():
        return MetaDataUtils.extract_devices()

    @task()
    def load_devices(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.devices_table,
            component=MetaDataType.DEVICES,
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
    @task()
    def extract_grids() -> pd.DataFrame:
        return MetaDataUtils.extract_grids_from_api()

    @task()
    def load_grids(data: pd.DataFrame):
        bigq_api = BigQueryApi()
        bigq_api.update_meta_data(data, bigq_api.grids_table, MetaDataType.GRIDS)

    @task()
    def extract_cohorts() -> pd.DataFrame:
        return MetaDataUtils.extract_cohorts_from_api()

    @task()
    def load_cohorts(data: pd.DataFrame):
        bigq_api = BigQueryApi()
        bigq_api.update_meta_data(data, bigq_api.cohorts_table, MetaDataType.COHORTS)

    @task()
    def update_grid_sites_table(data: pd.DataFrame):
        data = MetaDataUtils.merge_grids_and_sites(data)
        BigQueryApi().update_grids_sites_table(data)

    @task()
    def update_cohort_devices_table(data: pd.DataFrame):
        data = MetaDataUtils.merge_cohorts_and_devices(data)
        BigQueryApi().update_cohorts_devices_table(data)

    @task()
    def extract_sites() -> pd.DataFrame:
        return MetaDataUtils.extract_sites()

    @task()
    def load_sites(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.sites_table,
            component=MetaDataType.SITES,
        )

    @task()
    def extract_sites_meta_data() -> pd.DataFrame:
        return MetaDataUtils.extract_sites_meta_data()

    @task()
    def load_sites_meta_data(data: pd.DataFrame):
        BigQueryApi().update_sites_meta_data(dataframe=data)

    @task()
    def extract_devices():
        return MetaDataUtils.extract_devices()

    @task()
    def load_devices(data: pd.DataFrame):
        big_query_api = BigQueryApi()
        big_query_api.update_meta_data(
            dataframe=data,
            table=big_query_api.devices_table,
            component=MetaDataType.DEVICES,
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
        MetaDataUtils.update_nearest_weather_stations()

    @task()
    def update_distance_measures() -> None:
        MetaDataUtils.update_sites_distance_measures()

    @task()
    def refresh_airqlouds() -> None:
        MetaDataUtils.refresh_airqlouds(DeviceNetwork.AIRQO)

    @task()
    def refresh_grids() -> None:
        MetaDataUtils.refresh_grids(DeviceNetwork.AIRQO)

    update_nearest_weather_stations()
    update_distance_measures()
    refresh_airqlouds()
    refresh_grids()


@dag(
    "AirQo-devices-to-temp-store-pipeline",
    schedule="0 */3 * * *",
    doc_md=extract_store_devices_data_in_temp_store,
    catchup=False,
    tags=["devices", "store"],
    default_args=AirflowUtils.dag_default_configs(),
)
def cache_devices_data():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_devices() -> pd.DataFrame:
        return MetaDataUtils.extract_transform_and_decrypt_metadata(
            MetaDataType.DEVICES
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def store_devices(devices: pd.DataFrame) -> None:
        if not devices.empty:
            return upload_dataframe_to_gcs(
                bucket_name=Config.AIRFLOW_XCOM_BUCKET,
                contents=devices,
                destination_file="devices.csv",
            )

    extracted_devices = extract_devices()
    store_devices(extracted_devices)


@dag(
    "AirQo-devices-computed-metadata",
    schedule="0 0 * * *",
    doc_md=compute_store_devices_metadata_doc,
    catchup=False,
    tags=["devices", "computed", "metadata"],
    default_args=AirflowUtils.dag_default_configs(),
)
def compute_store_devices_metadata():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_compute_devices_metadata() -> pd.DataFrame:
        return MetaDataUtils.compute_device_site_metadata(
            DataType.AVERAGED,
            DeviceCategory.LOWCOST,
            MetaDataType.DEVICES,
            Frequency.HOURLY,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def store_computed_metadata(data: pd.DataFrame) -> None:
        if not data.empty:
            data, table = DataUtils.format_data_for_bigquery(
                data,
                DataType.EXTRAS,
                DeviceCategory.LOWCOST,
                Frequency.HOURLY,
                device_network=DeviceNetwork.AIRQO,
                extra_type=MetaDataType.DEVICES,
            )
            big_query_api = BigQueryApi()
            big_query_api.load_data(
                dataframe=data,
                table=table,
            )

    extracted_devices = extract_compute_devices_metadata()
    store_computed_metadata(extracted_devices)


@dag(
    "AirQo-devices-computed-store-device-baseline-weekly",
    schedule="0 0 * * *",
    doc_md=compute_store_devices_baseline_doc,
    catchup=False,
    tags=["devices", "weekly", "computed", "metadata", "baselines"],
    default_args=AirflowUtils.dag_default_configs(),
)
def compute_store_devices_baseline_weekly():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_compute_devices_baeline() -> pd.DataFrame:
        return MetaDataUtils.compute_device_site_baseline(
            DataType.AVERAGED,
            Frequency.WEEKLY,
            DeviceCategory.GENERAL,
            DeviceNetwork.AIRQO,
        )

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def store_computed_baseline_data(data: pd.DataFrame) -> None:
        if not data.empty:
            data, table = DataUtils.format_data_for_bigquery(
                data,
                DataType.EXTRAS,
                DeviceCategory.LOWCOST,
                Frequency.WEEKLY,
                device_network=DeviceNetwork.AIRQO,
                extra_type=MetaDataType.DATAQUALITYCHECKS,
            )
            big_query_api = BigQueryApi()
            big_query_api.load_data(dataframe=data, table=table)

    extracted_devices = extract_compute_devices_baeline()
    store_computed_baseline_data(extracted_devices)


@dag(
    "AirQo-sites-to-temp-store-pipeline",
    schedule="0 */3 * * *",
    doc_md=extract_store_sites_data_in_temp_store,
    catchup=False,
    tags=["sites", "store"],
    default_args=AirflowUtils.dag_default_configs(),
)
def cache_sites_data():
    @task(retries=3, retry_delay=timedelta(minutes=5))
    def extract_sites() -> pd.DataFrame:
        return MetaDataUtils.extract_transform_and_decrypt_metadata(MetaDataType.SITES)

    @task(retries=3, retry_delay=timedelta(minutes=5))
    def store_sites(sites: pd.DataFrame) -> None:

        if not sites.empty:
            return upload_dataframe_to_gcs(
                bucket_name=Config.AIRFLOW_XCOM_BUCKET,
                contents=sites,
                destination_file="sites.csv",
            )

    extracted_sites = extract_sites()
    store_sites(extracted_sites)


cache_devices_data()
update_big_query_airqlouds_sites_and_devices()
update_big_query_grids_cohorts_sites_and_devices()
meta_data_update_microservice_sites_meta_data()
cache_sites_data()
compute_store_devices_metadata()
compute_store_devices_baseline_weekly()
