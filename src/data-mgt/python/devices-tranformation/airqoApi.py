import json
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

    def get_sites(self, tenant):
        response = self.__request("devices/sites", {"tenant": tenant})

        if "sites" in response:
            return response["sites"]

        return []

    def update_sites(self, tenant, updated_sites):
        response = self.__request("devices/sites", {"tenant": tenant}, updated_sites)

        if "sites" in response:
            return response["sites"]

        return []

    def __request(self, endpoint, params, body=None):

        headers = {'x-api-key': self.AIRQO_API_KEY}
        if body is None:
            api_request = requests.get(
                '%s%s' % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                verify=False,
            )
        else:
            api_request = requests.post(
                '%s%s' % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                verify=False,
                data=json.dumps(body)
            )

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return handle_api_error(api_request)

