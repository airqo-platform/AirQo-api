from airflow.decorators import dag, task
from datetime import datetime , timedelta
from airqo_etl_utils.workflows_custom_utils import AirflowUtils


@dag(
    "Satellite-Data",
    schedule="0 0 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    catchup=False,
    tags=["satellite", "data"],
)
def retrieve_satellite_data():

    @task()
    def fetch_data():
        from airqo_etl_utils.satellite_utils import SatelliteUtils
        from airqo_etl_utils.constants import satellite_cities, satellite_collections

        return SatelliteUtils.extract_satellite_data(locations=satellite_cities,start_date=datetime.now() - timedelta(days=30), end_date=datetime.now(), satellite_collections=satellite_collections)



