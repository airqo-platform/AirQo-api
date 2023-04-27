import json

import requests

from .config import configuration


class AirNowApi:
    def __init__(self):
        self.AIRNOW_BASE_URL = configuration.AIRNOW_BASE_URL
        self.AIRNOW_API_KEY = configuration.AIRNOW_API_KEY
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

        return self.__request(endpoint="/aq/data", params=params)

    def __request(self, endpoint, params):
        params["API_KEY"] = self.AIRNOW_API_KEY

        api_request = requests.get(
            "%s%s" % (self.AIRNOW_BASE_URL, endpoint),
            params=params,
            verify=False,
        )

        print(api_request.request.url)

        if api_request.status_code == 200:
            return api_request.json()
        else:
            handle_api_error(api_request)
            return None


def handle_api_error(api_request):
    try:
        print(api_request.request.url)
        print(api_request.request.body)
    except Exception as ex:
        print(ex)
    finally:
        print(api_request.content)
        print("API request failed with status code %s" % api_request.status_code)
