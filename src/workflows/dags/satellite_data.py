from datetime import datetime, timedelta
from airflow.decorators import dag, task
import pandas as pd
from pathlib import Path
from airflow.exceptions import AirflowSkipException

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.satellite_utils import SatelliteUtils
from airqo_etl_utils.date import DateUtils
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.sources.nomads_adapter import NomadsAdapter
from airqo_etl_utils.sources.cams_cds_adapter import CAMSAdapter, CAMS_VARIABLES
from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.constants import DataType, DeviceCategory, Frequency
from airqo_etl_utils.config import configuration as Config
from airqo_etl_utils.utils import delete_old_files
from dag_docs import satellite_data_location_approximations_doc


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
    @task(
        provide_context=True,
        retries=2,
        retry_delay=timedelta(minutes=5),
    )
    def extract_data(**kwargs) -> pd.DataFrame:
        adapter = CAMSAdapter()
        result = adapter.fetch()
        if result.error:
            raise RuntimeError(f"CAMS download failed: {result.error}")

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def clean_data(**kwargs) -> pd.DataFrame:
        data_to_read = {
            short_name: meta["default_path"]
            for short_name, meta in CAMS_VARIABLES.items()
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

    extract = extract_data()
    cleaned = clean_data()
    extract >> cleaned
    store_data(cleaned)


@dag(
    "NOMADS-measurements",
    schedule="0 0,12 * * *",
    catchup=False,
    tags=["daily", "raw", "satellite", "NOMADS"],
    default_args=AirflowUtils.dag_default_configs(),
)
def NOMADS_daily_measurements():
    from airflow.models import Variable

    @task(
        provide_context=True,
        retries=2,
        retry_delay=timedelta(minutes=5),
    )
    def extract_data(**kwargs) -> str:
        adapter = NomadsAdapter()
        res = adapter.fetch()
        file = None
        if res and res.error is None:
            file = res.data.get("meta", {}).get("file", {})
            if file:
                old_file = Variable.get("nomads_file_path", default_var=None)
                if old_file and old_file == file:
                    raise AirflowSkipException(
                        f"File {file} has not changed. Skipping workflow."
                    )
        Variable.set("nomads_file_path", file)

        return file

    @task(
        provide_context=True,
        retries=1,
        retry_delay=timedelta(minutes=5),
    )
    def clean_data(file, **kwargs) -> pd.DataFrame:
        if not file or not Path(file).exists():
            raise AirflowSkipException(
                f"File {file} does not exist. Skipping workflow."
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


@dag(
    dag_id="Satellite-Data-Location-Approximations",
    schedule="20 * * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    doc_md=satellite_data_location_approximations_doc,
    tags=["satellite", "data", "main"],
)
def satellite_data_location_approximations():
    from airqo_etl_utils.storage import get_configured_storage

    @task(provide_context=True, retries=1, retry_delay=timedelta(minutes=5))
    def approximate_locations(**kwargs) -> pd.DataFrame:
        execution_date = kwargs["dag_run"].execution_date
        hour_of_day: datetime = execution_date - timedelta(hours=1)
        # TODO: Periodically review data sources for more accurate satellite data and or forecast data.
        # Pass only dates since most satellite data only have date with times set to 00:00:00,
        # so we approximate the satellite data locations for the whole day of the execution date, which is the previous day of the current date.
        start_date_time = DateUtils.date_to_str(hour_of_day, str_format="%Y-%m-%d")
        end_date_time = DateUtils.date_to_str(hour_of_day, str_format="%Y-%m-%d")
        return SatelliteUtils.approximate_satellite_data_locations_for_airquality_measurements(
            start_date=start_date_time, end_date=end_date_time
        )

    @task(provide_context=True, retries=1, retry_delay=timedelta(minutes=5))
    def load_to_bigquery(data):
        data, table = DataUtils.format_data_for_bigquery(
            data, DataType.AVERAGED, DeviceCategory.SATELLITE, Frequency.HOURLY
        )
        big_query_api = BigQueryApi()
        big_query_api.load_data(
            dataframe=data,
            table=table,
        )

    data = approximate_locations()
    load_to_bigquery(data)


satellite_data_location_approximations()
copernicus_hourly_measurements()
NOMADS_daily_measurements()
retrieve_satellite_data()
