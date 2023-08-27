from airflow.decorators import dag, task

from airqo_etl_utils.airflow_custom_utils import AirflowUtils


@dag(
    "AirQo-twitter-forecasts-bot",
    schedule="0 8 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "twitter", "forecasts", "bot"],
)

def tweet_forecasts():
    @task():


