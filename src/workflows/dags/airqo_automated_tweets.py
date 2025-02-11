from airflow.decorators import dag, task

from airqo_etl_utils.workflows_custom_utils import AirflowUtils
from airqo_etl_utils.airqo_tweets_utils import AirQoTweetsUtils
from airqo_etl_utils.constants import DeviceNetwork
from airqo_etl_utils.datautils import DataUtils


@dag(
    "AirQo-automated-tweets",
    # set the schedule to 7am every day
    schedule_interval="0 7 * * *",
    default_args=AirflowUtils.dag_default_configs(),
    tags=["airqo", "automated-tweets"],
)
def create_forecast_tweets():
    @task()
    def retrieve_sites():
        return DataUtils.get_sites(network=DeviceNetwork.AIRQO)

    @task()
    def select_forecast_sites(sites):
        return AirQoTweetsUtils.select_sites_for_forecast(sites)

    @task()
    def get_site_forecast(sites):
        return AirQoTweetsUtils.fetch_site_forecasts(sites)

    @task()
    def send_tweet(site_forecasts):
        AirQoTweetsUtils.create_tweet(site_forecasts)

    sites = retrieve_sites()
    selected_sites = select_forecast_sites(sites)
    site_forecasts = get_site_forecast(selected_sites)
    send_tweet(site_forecasts)


create_forecast_tweets()
