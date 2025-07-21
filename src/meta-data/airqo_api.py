import json
import traceback
import requests
from config import Config

class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = Config.AIRQO_BASE_URL.rstrip("/")
        self.API_AUTH_TOKEN = Config.API_AUTH_TOKEN

    def update_site_meta_data(self, site_details: dict):
        params = {"tenant": "airqo", "id": site_details.pop("id")}
        site_details = {k: v for k, v in site_details.items() if v is not None}
        self.__request("devices/sites", params=params, body=site_details, method="PUT")

    def __request(self, endpoint, params=None, body=None, method=None):
        try:
            headers = {"Content-Type": "application/json"}
            params = {**params, 'token': self.API_AUTH_TOKEN} if params else {'token': self.API_AUTH_TOKEN}
            url = f"{self.AIRQO_BASE_URL}/{endpoint}"
            api_request = requests.request(method, url, params=params, headers=headers, data=json.dumps(body), verify=False)
            print(f"Request Url : {api_request.request.url}")
            print(f"Request Body : {api_request.request.body}")
            if api_request.status_code in [200, 201]:
                print(f"Request Response : {api_request.json()}")
            else:
                self.handle_api_error(api_request)
        except Exception as ex:
            print(ex)
            traceback.print_exc()

    @staticmethod
    def handle_api_error(api_request):
        try:
            print(api_request.request.url)
            print(api_request.request.body)
        except Exception as ex:
            print(ex)
        finally:
            print(api_request.content)
            print(f"API request failed with status code {api_request.status_code}")
