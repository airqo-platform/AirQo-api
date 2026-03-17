# implement the openweather api
import logging
import os

import requests

from airqo_etl_utils.config import configuration
from airqo_etl_utils.utils import Utils


class OpenWeatherApi:
    BASE_URL = configuration.OPENWEATHER_BASE_URL
    API_KEY = configuration.OPENWEATHER_API_KEY

    @staticmethod
    def get_current_weather_for_each_site(site_coordinates: tuple) -> dict:
        latitude, longitude = site_coordinates
        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": OpenWeatherApi.API_KEY,
            "units": "metric",
        }
        try:
            response = requests.get(url=OpenWeatherApi.BASE_URL, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logging.error(
                f"Error getting current weather for site {latitude}, {longitude}: {e}"
            )
            return {}
