from datetime import datetime, timedelta

from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils

from airqo_etl_utils.config import configuration


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
        from airqo_etl_utils.satellite_utils import SatelliteUtils
        from airqo_etl_utils.constants import satellite_cities, satellite_collections

        return SatelliteUtils.extract_satellite_data(
            locations=satellite_cities,
            start_date=datetime.now() - timedelta(days=30),
            end_date=datetime.now(),
            satellite_collections=satellite_collections,
        )

    @task()
    def save_to_bigquery(data):
        from airqo_etl_utils.bigquery_api import BigQueryApi

        big_query_api = BigQueryApi()
        big_query_api.save_data_to_bigquery(
            data, configuration.BIGQUERY_SATELLITE_DATA_TABLE
        )

    data = fetch_data()
    save_to_bigquery(data)


retrieve_satellite_data()
