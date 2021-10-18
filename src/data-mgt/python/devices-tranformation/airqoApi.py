import json
import os

import requests

from utils import handle_api_error


class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
        self.AIRQO_API_KEY = f"JWT {os.getenv('AIRQO_API_KEY')}"

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

    def get_forecast(self, tenant, longitude, latitude, selected_datetime):
        params = {
            "tenant": tenant,
        }
        body = {
            "longitude": longitude,
            "latitude": latitude,
            "selected_datetime": selected_datetime,
        }
        response = self.__request(endpoint="predict", params=params, body=body, method="post")

        if response is not None and "formatted_results" in response:
            formatted_results = response["formatted_results"]
            return formatted_results["predictions"]

        return []

    def get_airqo_device_current_measurements(self, device_number):
        response = self.__request("data/feeds/transform/recent", {"channel": device_number})
        return response

    def get_sites(self, tenant):
        response = self.__request("devices/sites", {"tenant": tenant})

        if "sites" in response:
            return response["sites"]

        return []

    def update_primary_device(self, tenant, name, primary=False):

        params = {"tenant": tenant, "name": name}
        body = {
            "isPrimaryInLocation": "true" if primary else "false"
        }

        response = self.__request(endpoint="devices", params=params, body=body, method="put")
        print(response)

    def update_sites(self, updated_sites):
        for i in updated_sites:
            site = dict(i)
            params = {"tenant": site.pop("tenant"), "id": site.pop("_id")}

            response = self.__request("devices/sites", params, site, "put")
            print(response)

    def __request(self, endpoint, params, body=None, method=None):

        headers = {'Authorization': self.AIRQO_API_KEY}
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
        elif method == "post":
            headers['Content-Type'] = 'application/json'
            api_request = requests.post(
                '%s%s/' % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        else:
            handle_api_error("Invalid")
            return None

        if api_request.status_code == 200:
            return api_request.json()
        else:
            handle_api_error(api_request)
            return None
