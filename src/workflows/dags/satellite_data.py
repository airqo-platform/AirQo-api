from datetime import datetime, timedelta
from airflow.decorators import dag, task
import concurrent.futures

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.satellite_utils import SatelliteUtils
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.data_sources import DataSourcesApis
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import DataType, DeviceCategory, Frequency
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.commons import delete_old_files


@dag(
    dag_id="Satellite-Data",
    schedule="0 0 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["satellite", "data"],
)
def retrieve_satellite_data():
    @task()
    def fetch_data():
        # TODO: Break this down into smaller tasks, challenge is xcom support only df & json atm
        return SatelliteUtils.extract_satellite_data(
            locations=Config.satellite_cities,
            start_date=datetime.now() - timedelta(days=30),
            end_date=datetime.now(),
            satellite_collections=Config.satellite_collections,
        )

    @task()
    def save_to_bigquery(data):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.load_data(data, Config.BIGQUERY_SATELLITE_DATA_TABLE)

    data = fetch_data()
    save_to_bigquery(data)


@dag(
    "Copernicus-Climate-measurements",
    schedule="10 * * * *",
    catchup=False,
    tags=["hourly", "raw", "satellite", "Copernicus"],
    default_args=AirflowUtils.dag_default_configs(),
)
def copernicus_hourly_measurements():
    import pandas as pd

    @task(
        provide_context=True,
        retries=2,
        retry_delay=timedelta(minutes=5),
    )
    def extract_data(**kwargs) -> pd.DataFrame:
        data_to_download = {
            "particulate_matter_10um": "/tmp/pm10_download.zip",
            "particulate_matter_2.5um": "/tmp/pm25_download.zip",
        }
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            for variable, destination in data_to_download.items():
                SatelliteUtils.retrieve_cams_variable(variable, destination)

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def clean_data(**kwargs) -> pd.DataFrame:
        data_to_read = {
            "pm10": "/tmp/pm10_download.zip",
            "pm2p5": "/tmp/pm25_download.zip",
        }
        files_to_delete = []
        dfs: list[pd.DataFrame] = []
        for variable, destination in data_to_read.items():
            dfs.append(SatelliteUtils.process_netcdf(destination, variable))
            files_to_delete.append(destination)

        merged_df = SatelliteUtils.clean_netcdf_data(dfs)
        if not merged_df.empty:
            delete_old_files(files_to_delete)
        return merged_df

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def store_data(data, **kwargs) -> pd.DataFrame:
        formated_data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.SATELLITE, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(formated_data, table=table)

    extraction = extract_data()
    cleaned = clean_data().set_upstream(extraction)
    store_data(cleaned)


@dag(
    "NOMADS-measurements",
    schedule="0 0,12 * * *",
    catchup=False,
    tags=["daily", "raw", "satellite", "NOMADS"],
    default_args=AirflowUtils.dag_default_configs(),
)
def NOMADS_daily_measurements():
    import pandas as pd
    from airflow.models import Variable

    @task(
        provide_context=True,
        retries=2,
        retry_delay=timedelta(minutes=5),
    )
    def extract_data(**kwargs) -> None:
        data_source = DataSourcesApis()
        file = data_source.nomads()
        Variable.set("nomads_file_path", file)
        return

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def clean_data(file, **kwargs) -> pd.DataFrame:
        file = Variable.get(
            "nomads_file_path", default_var="/tmp/gdas.t00z.pgrb2.0p25.f000"
        )
        clean_data = SatelliteUtils.process_nomads_data_files(file)
        if not clean_data.empty:
            delete_old_files([file])
        return clean_data

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def store_data(data, **kwargs) -> pd.DataFrame:
        formated_data, table = DataUtils.format_data_for_bigquery(
            data, DataType.RAW, DeviceCategory.SATELLITE, Frequency.RAW
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(formated_data, table=table)

    file = extract_data()
    cleaned = clean_data(file)
    store_data(cleaned)


copernicus_hourly_measurements()
NOMADS_daily_measurements()
retrieve_satellite_data()
