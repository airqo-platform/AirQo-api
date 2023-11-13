from airflow.decorators import dag

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "AirQo-automated-tweets",
    schedule="0 1 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "automated-tweets"],
)

def create_forecast_tweets():
    @task()
    def select_locations():
        from airqo_etl_utils.air