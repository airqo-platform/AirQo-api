import os

import requests

from utils import handle_api_error


class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
        self.AIRQO_API_KEY = os.getenv("AIRQO_API_KEY")

    def get_devices(self, tenant):
        response = self.__request("devices", {"tenant": tenant})

        if "devices" in response:
            return response["devices"]

        return []

    def __request(self, endpoint, params):

        headers = {'x-api-key': self.AIRQO_API_KEY}
        api_request = requests.get(
            '%s%s' % (self.AIRQO_BASE_URL, endpoint),
            params=params,
            headers=headers,
            verify=False,
        )

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return handle_api_error(api_request)

