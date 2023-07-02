import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()


class Events:
    def __init__(self):
        super().__init__()

    AIRQO_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
    TENANT = 'airqo'
    MAX_RETRIES = 3

    @staticmethod
    def fetch_sites():
        retries = 0
        sites_url = f"{Events.AIRQO_BASE_URL}api/v1/devices/sites"
        params = {"tenant": Events.TENANT}

        while True:
            response = requests.get(sites_url, params=params)
            if response.ok:
                data = response.json()
                return data['sites']
            else:
                retries += 1
                if retries > Events.MAX_RETRIES:
                    raise requests.exceptions.HTTPError(f"Failed to fetch sites: {response.status_code}")
                else:
                    print(f"Failed to fetch sites: {response.status_code}. Retrying...")

    @staticmethod
    def fetch_forecasts(site_id, frequency="daily"):
        retries = 0
        url = "api/v2/predict/daily-forecast" if frequency == "daily" else "api/v2/predict/hourly-forecast"
        forecasts_url = Events.AIRQO_BASE_URL + url
        params = {"site": site_id}

        while True:
            response = requests.get(forecasts_url, params=params)
            if response.ok:
                data = response.json()
                forecasts = data['forecasts']
                return forecasts
            else:
                retries += 1
                if retries > Events.MAX_RETRIES:
                    raise requests.exceptions.HTTPError(f"Failed to fetch forecasts: {response.status_code}")
                else:
                    print(f"Failed to fetch forecasts: {response.status_code}. Retrying...")
