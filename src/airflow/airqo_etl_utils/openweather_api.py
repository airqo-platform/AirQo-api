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
        self.BASE_URL = Utils.remove_suffix(configuration.OPEN_WEATHER_BASE_URL, suffix="/")
        self.API_KEY = os.environ.get("OPEN_WEATHER_API_KEY")
        self.API_SECRET = os.environ.get("OPEN_WEATHER_API_SECRET")
        self.DATA_BATCH_SIZE = int(os.environ.get("OPEN_WEATHER_DATA_BATCH_SIZE"))

    @staticmethod
    def get_weather_for_each_site(self) -> pd.DataFrame:
        """
        Get the current weather for each site in the sites dataframe
        :return: dataframe containing the current weather for each site
        """

        def get_current_weather_for_each_site(site_coordinates: tuple):
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
                logging.error(f"Error getting current weather for site {latitude}, {longitude}: {e}")
                return {}

        def process_batch(batch_of_coordinates: list):
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                results = executor.map(get_current_weather_for_each_site, batch_of_coordinates)

            return [
                {
                    # add a key for current timestamp in utc
                    "timestamp": datetime.utcfromtimestamp(result['dt']).strftime('%Y-%m-%d %H:%M:%S'),
                    'latitude': result['coord']['lat'],
                    'longitude': result['coord']['lon'],
                    'temperature': result['main']['temp'],
                    'humidity': result['main']['humidity'],
                    'pressure': result['main']['pressure'],
                    'wind_speed': result['wind']['speed'],
                    'wind_direction': result['wind']['deg'],
                    'wind_gust': result['wind']['gust'],
                    'weather_description': result['weather'][0]['description'],
                    'sea_level': result['main']['sea_level'],
                    'ground_level': result['main']['grnd_level'],
                    'visibility': result['visibility'],
                    'cloudiness': result['clouds']['all'],
                    'rain': result['rain']['1h']

                }
                for result in results if 'main' in result
            ]

        weather_data = []
        sites = AirQoApi().get_sites()
        coordinate_tuples = []
        for site in sites:
            coordinate_tuples.append((site.get("latitude"), site.get("longitude")))
        for i in range(0, len(coordinate_tuples), self.DATA_BATCH_SIZE):
            batch = coordinate_tuples[i:i + self.DATA_BATCH_SIZE]
            weather_data.extend(process_batch(batch))
            if i + self.DATA_BATCH_SIZE < len(coordinate_tuples):
                time.sleep(100)
        return pd.DataFrame(weather_data)
