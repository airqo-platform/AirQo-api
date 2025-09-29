import random
import pandas as pd

from airqo_etl_utils.data_api import DataApi
from airqo_etl_utils.config import twitter_client

from typing import Dict, Any

import logging

logger = logging.getLogger("airflow.task")


class AirQoTweetsUtils:
    @staticmethod
    def select_sites_for_forecast(sites: pd.DataFrame) -> Dict[str, str]:
        """
        Randomly selects seven sites from the provided DataFrame and returns a dictionary
        mapping each site's search name to its corresponding ID.

        Args:
            sites(pd.DataFrame): A DataFrame containing site data with at least "search_name" and "_id" columns.

        Returns:
            Dict[str, str]: A dictionary where keys are site search names and values are site IDs.
        """
        sites_for_forecast = random.sample(sites.to_dict(orient="records"), 7)
        return {site["search_name"]: site["id"] for site in sites_for_forecast}

    @staticmethod
    def fetch_site_forecasts(sites_dict: Dict[str, str]) -> Dict[str, Any]:
        """
        Fetches daily forecast data for a given set of sites.

        Args:
            sites_dict(Dict[str, str]): A dictionary mapping site names to their corresponding site IDs.

        Returns:
            Dict[str, Any]: A dictionary where keys are site names and values are the corresponding forecast data.

        Notes:
            - If no forecast data is found for a site, it is skipped.
        """
        all_site_forecasts = {}
        for site_name, site_id in sites_dict.items():
            try:
                data_api = DataApi()
                site_forecast = data_api.get_forecast(
                    frequency="daily", site_id=site_id
                )[0]
            except IndexError:
                logger.exception(f"No forecast returned for site {site_name}")
                continue
            else:
                all_site_forecasts[site_name] = site_forecast

        return all_site_forecasts

    @staticmethod
    def create_tweet(site_forecasts: Dict[str, Any]) -> None:
        """
        Composes and posts a tweet with PM2.5 air quality forecasts for multiple sites.

        Args:
            site_forecasts (Dict[str, Any]): A dictionary where keys are site names and values contain forecast data, including 'pm2_5' values.

        Returns:
            None: The function posts a tweet but does not return a value.

        Notes:
            - Assumes `site_forecasts` contains valid data; sites without PM2.5 forecasts may cause issues.
        """
        message = "Air quality PM2.5 forecasts for today: \n"
        for site_name, site_forecast in site_forecasts.items():
            message += (
                f"{site_name}: {round(site_forecast['pm2_5'], ndigits=2)} ug/m3, \n"
            )

        ## TODO: Disabling for now, starting off with basic functionality
        # get the first health tip for the first site
        # random_site = random.choice(list(site_forecasts.keys()))
        # random_site_healthtip = site_forecasts[random_site]["health_tips"][0]
        # message += f"\nHealth tip: {random_site_healthtip}"

        twitter_client.create_tweet(text=message)
