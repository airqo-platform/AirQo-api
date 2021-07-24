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

    def update_sites(self, updated_sites):
        for i in updated_sites:
            site = dict(i)
            params = {"tenant": site.pop("tenant"), "id": site.pop("_id")}

            response = self.__request("devices/sites", params, site, "put")
            print(response)

    def __request(self, endpoint, params, body=None, method=None):

        headers = {'x-api-key': self.AIRQO_API_KEY}
        if method is None:
            api_request = requests.get(
                '%s%s' % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                verify=False,
            )
        elif method == "put":
            headers['Content-Type'] = 'application/json'
            api_request = requests.put(
                '%s%s' % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        else:
            return handle_api_error("Invalid")

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return handle_api_error(api_request)

