# implement the openweather api
import concurrent.futures
import logging
import os
import time
from datetime import datetime

import pandas as pd
import requests

from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.config import configuration
from airqo_etl_utils.utils import Utils


class OpenWeatherApi:
    def __init__(self):
        self.BASE_URL = Utils.remove_suffix(
            configuration.OPEN_WEATHER_BASE_URL, suffix="/"
        )
        self.API_KEY = os.environ.get("OPEN_WEATHER_API_KEY")
        self.API_SECRET = os.environ.get("OPEN_WEATHER_API_SECRET")
        self.DATA_BATCH_SIZE = int(os.environ.get("OPEN_WEATHER_DATA_BATCH_SIZE"))

    def get_current_weather_for_each_site(self, site_coordinates: tuple) -> dict:
        latitude, longitude = site_coordinates
        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": self.API_KEY,
        }
        try:
            response = requests.get(self.BASE_URL, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            logging.error(
                f"Error getting current weather for site {latitude}, {longitude}: {e}"
            )
            return {}

