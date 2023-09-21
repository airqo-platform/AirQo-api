import json
import traceback

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
        self.AIRQO_BASE_URL = AirQoApi.remove_suffix(
            Config.AIRQO_BASE_URL, "/")
        self.API_AUTH_TOKEN = Config.API_AUTH_TOKEN

    def update_site_meta_data(self, site_details: dict):

        params = {"tenant": "airqo", "id": site_details.pop("id")}

        for key, value in site_details.copy().items():
            if value is None:
                site_details.pop(key)

        self.__request(
            endpoint="devices/sites", params=params, body=site_details, method="put"
        )

    def __request(self, endpoint, params=None, body=None, method=None):

        try:
            headers = {"Content-Type": "application/json"}
            if method == "put":
                api_request = requests.put(
                    "%s/%s" % (self.AIRQO_BASE_URL, endpoint),
                    params={
                        **params, 'token': self.API_AUTH_TOKEN} if params else {'token': self.API_AUTH_TOKEN},
                    headers=headers,
                    data=json.dumps(body),
                    verify=False,
                )
            elif method == "post":
                api_request = requests.post(
                    "%s/%s" % (self.AIRQO_BASE_URL, endpoint),
                    params={
                        **params, 'token': self.API_AUTH_TOKEN} if params else {'token': self.API_AUTH_TOKEN},
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
        except Exception as ex:
            print(ex)
            traceback.print_exc()
            return None


def handle_api_error(api_request):
    try:
        print(api_request.request.url)
        print(api_request.request.body)
    except Exception as ex:
        print(ex)
    finally:
        print(api_request.content)
        print("API request failed with status code %s" %
              api_request.status_code)
