import json

import urllib3
from urllib3.util.retry import Retry

from .config import configuration

from typing import List

from .constants import Tenant, DataSource
from .utils import Utils


class AirNowApi:
    def __init__(self):
        self.AIRNOW_BASE_URL = configuration.AIRNOW_BASE_URL
        self.US_EMBASSY_API_KEY = configuration.US_EMBASSY_API_KEY
        self.AIRNOW_COUNTRIES_METADATA = (
            configuration.AIRNOW_COUNTRIES_METADATA_JSON_FILE
        )

    def get_countries_metadata(self):
        with open(self.AIRNOW_COUNTRIES_METADATA) as file:
            metadata = json.load(file)

        return metadata

    def get_data(
        self,
        start_date_time,
        end_date_time,
        boundary_box,
        api_key,
        parameters="pm25,pm10,ozone,co,no2,so2",
    ) -> list:
        params = {
            "startDate": start_date_time,
            "endDate": end_date_time,
            "parameters": parameters,
            "BBOX": boundary_box,
            "format": "application/json",
            "verbose": 1,
            "nowcastonly": 1,
            "includerawconcentrations": 1,
            "dataType": "B",
        }

        return self.__request(endpoint="/aq/data", params=params, api_key=api_key)

    def __request(self, endpoint, params, api_key):
        params["API_KEY"] = api_key

        url = f"{self.AIRNOW_BASE_URL}{endpoint}"

        retry_strategy = Retry(
            total=5,
            backoff_factor=5,
        )

        http = urllib3.PoolManager(retries=retry_strategy)

        try:
            response = http.request("GET", url, fields=params)
            response_data = response.data
            print(response._request_url)

            if response.status == 200:
                return json.loads(response_data)
            else:
                Utils.handle_api_error(response)
                return None

        except urllib3.exceptions.HTTPError as e:
            print(f"HTTPError: {e}")
            return None
