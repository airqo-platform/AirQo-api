# implement the openweather api
import logging

from airqo_etl_utils.config import configuration
from airqo_etl_utils.http_client import HttpClient
from airqo_etl_utils.utils import Utils


class OpenWeatherApi:
    BASE_URL = configuration.OPENWEATHER_BASE_URL
    API_KEY = configuration.OPENWEATHER_API_KEY

    @staticmethod
    def get_current_weather_for_each_site(site_coordinates: tuple) -> dict:
        """Fetch current weather from OpenWeather for a single site coordinate.

        Args:
            site_coordinates (tuple): ``(latitude, longitude)`` pair.

        Returns:
            dict: Parsed OpenWeather JSON response, or ``{}`` on error.
        """
        latitude, longitude = site_coordinates
        params = {
            "lat": latitude,
            "lon": longitude,
            "appid": OpenWeatherApi.API_KEY,
            "units": "metric",
        }
        try:
            return HttpClient().get_json(OpenWeatherApi.BASE_URL, params=params)
        except Exception as e:
            logging.error(
                f"Error getting current weather for site {latitude}, {longitude}: {e}"
            )
            return {}
