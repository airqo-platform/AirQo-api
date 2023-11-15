import random

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.config import twitter_client


class AirQoTweetsUtils:
    @staticmethod
    def select_sites_for_forecast(sites):
        sites_for_forecast = random.sample(sites, 7)
        sites_dict = {}
        for site in sites_for_forecast:
            sites_dict[site["search_name"]] = site["_id"]
        return sites_dict

    @staticmethod
    def fetch_site_forecasts(sites_dict):
        all_site_forecasts = {}
        for site_name, site_id in sites_dict.items():
            try:
                site_forecast = AirQoApi().get_forecast(frequency="daily", site_id=site_id)[0]
            except IndexError:
                continue
            all_site_forecasts[site_name] = site_forecast
        return all_site_forecasts

    @staticmethod
    def create_tweet(site_forecasts):
        message = "Air quality PM2.5 forecasts for today: \n"
        for site_name, site_forecast in site_forecasts.items():
            message += f"{site_name}: {round(site_forecast['pm2_5'], ndigits=2)} ug/m3, \n"

        ## TODO: Disabling for now, starting off with basic functionality
        # get the first health tip for the first site
        # random_site = random.choice(list(site_forecasts.keys()))
        # random_site_healthtip = site_forecasts[random_site]["health_tips"][0]
        # message += f"\nHealth tip: {random_site_healthtip}"

        twitter_client.create_tweet(text=message)
