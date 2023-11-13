import random

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.config import twitter_client


class AirQoTweetsUtils:
    @staticmethod
    def select_sites_for_forecast(sites):
        sites_for_forecast = random.sample(sites, 4)
        sites_dict = {}
        for site in sites_for_forecast:
            sites_dict[site["location_name"]] = site["id"]
        return sites_dict

    @staticmethod
    def fetch_site_forecasts(sites_dict):
        all_site_forecasts = {}
        # sites_dict contains a dictionary of site names and their ids, select a site, get its forecast, using the site_id, as an argument to AirQoApi().get_forecast(site_id), this method will return a list of  dicts, each dictionary containing the `pm2_5` and `health_tips` keys, only slect the first dict, and  return a final dict, of keys being site_names and value being a dict  of the pm2_5 and healthtips for the first forecast in the list of forecasts dicts
        for site_name, site_id in sites_dict.items():
            site_forecast = AirQoApi().get_forecast(site_id)[0]
            all_site_forecasts[site_name] = site_forecast
        return all_site_forecasts

    @staticmethod
    def create_tweet(site_forecasts):
        message = "Air quality PM2.5 forecasts for today: "
        for site_name, site_forecast in site_forecasts.items():
            message += f"{site_name}: {site_forecast['pm2_5']} ug/m3, \n"

        ## TODO: Disabling for now, starting off with basic functionality
        # get the first health tip for the first site
        # random_site = random.choice(list(site_forecasts.keys()))
        # random_site_healthtip = site_forecasts[random_site]["health_tips"][0]
        # message += f"\nHealth tip: {random_site_healthtip}"

        twitter_client.create_tweet(message)
