import json

import requests

from config import Config


class AirQoApi:
    @staticmethod
    def remove_suffix(string: str, suffix):
        if string.endswith(suffix):
            return string[: -len(suffix)]
        else:
            return string[:]

    def __init__(self):
        self.AIRQO_BASE_URL = AirQoApi.remove_suffix(Config.AIRQO_BASE_URL, "/")
        self.AIRQO_API_KEY = Config.AIRQO_API_KEY

    def update_site_meta_data(self, site_details: dict):

        params = {"tenant": "airqo", "id": site_details.pop("id")}

        for key, value in site_details.copy().items():
            if value is None:
                site_details.pop(key)

        self.__request(
            endpoint="devices/sites", params=params, body=site_details, method="put"
        )

    def __request(self, endpoint, params=None, body=None, method=None):

        headers = {"Authorization": f"JWT {self.AIRQO_API_KEY}"}
        if method == "put":
            headers["Content-Type"] = "application/json"
            api_request = requests.put(
                "%s/%s" % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        elif method == "post":
            headers["Content-Type"] = "application/json"
            api_request = requests.post(
                "%s/%s" % (self.AIRQO_BASE_URL, endpoint),
                params=params,
                headers=headers,
                data=json.dumps(body),
                verify=False,
            )
        else:
            handle_api_error("Invalid")
            return None

        print(f"Request Url : {api_request.request.url}")
        print(f"Request Body : {api_request.request.body}")

        if api_request.status_code == 200 or api_request.status_code == 201:
            print(f"Request Response : {api_request.json()}")
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
