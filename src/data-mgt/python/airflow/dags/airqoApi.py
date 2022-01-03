import json

import requests

from config import configuration
from utils import handle_api_error


class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = configuration.AIRQO_BASE_URL
        self.AIRQO_BASE_URL_V2 = configuration.AIRQO_BASE_URL_V2
        self.AIRQO_API_KEY = f"JWT {configuration.AIRQO_API_KEY}"

    def get_devices(self, tenant, active=True, all_devices=False):
        params = {
            "tenant": tenant,
            "active": "yes" if active else "no"
        }
        if all_devices:
            params.pop("active")
        response = self.__request("devices", params)

        if "devices" in response:
            return response["devices"]

        return []

    def get_events(self, tenant, start_time, end_time, frequency, device=None, meta_data=None):
        params = {
            "tenant": tenant,
            "startTime": start_time,
            "endTime": end_time,
            "frequency": frequency,
            "recent": "no",
            "external": "no"
        }
        if device:
            params["device"] = device
        if meta_data:
            params["metadata"] = "site_id" if meta_data == "site" else "device_id"

        endpoint = "devices/events"
        response = self.__request(endpoint=endpoint, params=params, method="get")

        if "measurements" in response:
            return response["measurements"]

        return []

    def get_forecast(self, timestamp, channel_id):

        endpoint = f"predict/{channel_id}/{timestamp}"
        response = self.__request(endpoint=endpoint, params={}, method="get", version='v2')

        if response is not None and "predictions" in response:
            return response["predictions"]

        return []

    def get_airqo_device_current_measurements(self, device_number):
        response = self.__request("data/feeds/transform/recent", {"channel": device_number})
        return response

    def get_sites(self, tenant):
        response = self.__request("devices/sites", {"tenant": tenant})

        if "sites" in response:
            return response["sites"]

        return []

    def __request(self, endpoint, params, body=None, method=None, version='v1'):

        base_url = self.AIRQO_BASE_URL_V2 if version == 'v2' else self.AIRQO_BASE_URL

        headers = {'Authorization': self.AIRQO_API_KEY}
        if method is None or method == "get":
            api_request = requests.get(
                '%s%s' % (base_url, endpoint),
                params=params,
                headers=headers,
                verify=False,
            )
        elif method == "put":
            headers['Content-Type'] = 'application/json'
            api_request = requests.put(
                '%s%s' % (base_url, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        elif method == "post":
            headers['Content-Type'] = 'application/json'
            api_request = requests.post(
                '%s%s/' % (base_url, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        else:
            handle_api_error("Invalid")
            return None

        print(api_request.request.url)

        if api_request.status_code == 200 or api_request.status_code == 201:
            return api_request.json()
        else:
            handle_api_error(api_request)
            return None
