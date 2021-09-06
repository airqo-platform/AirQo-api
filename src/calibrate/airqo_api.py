import json
import os
import traceback

import requests


class AirQoApi:
    def __init__(self):
        self.airqo_base_url = os.getenv("AIRQO_BASE_URL")
        self.airqo_api_key = f"JWT {os.getenv('AIRQO_API_KEY')}"
        self.request_body_size = os.getenv("REQUEST_BODY_SIZE")
        self.timeout = os.getenv("TIMEOUT")

    def post_events(self, measurements, tenant):

        for i in range(0, len(measurements), int(self.request_body_size)):
            values = measurements[i:i + int(self.request_body_size)]

            try:
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'JWT {self.airqo_api_key}'
                }
                url = f'{self.airqo_base_url}devices/events?tenant={tenant}'
                json_data = json.dumps(values)

                response = requests.post(url, json_data, headers=headers, verify=False, timeout=int(self.timeout))

                if response.status_code == 200:
                    print(response.json())
                    print(json_data)
                else:
                    print("Device registry failed to insert values. Status Code : " + str(response.status_code))
                    print(response.content)
                    print(response.request.url)
                    print(response.request.body)
            except:
                traceback.print_exc()

    def get_events(self, tenant, start_time, end_time, device):
        headers = {'Authorization': f'JWT {self.airqo_api_key}'}

        params = {
            "tenant": tenant,
            "frequency": 'raw',
            "device": device,
            "metadata": "device",
            "startTime": start_time,
            "endTime": end_time
        }

        try:
            api_request = requests.get(
                '%s%s' % (self.airqo_base_url, 'devices/events'),
                params=params,
                headers=headers,
                verify=False
            )

            if api_request.status_code == 200 and "measurements" in api_request.json():
                return api_request.json()["measurements"]

            print(api_request.request.url)
            print(api_request.request.body)
            print(api_request.content)
            return []
        except:
            traceback.print_exc()
            return []

    def get_devices(self, tenant):
        headers = {'Authorization': f'JWT {self.airqo_api_key}'}

        params = {
            "tenant": tenant,
            "active": 'yes',
        }

        try:
            api_request = requests.get(
                '%s%s' % (self.airqo_base_url, 'devices'),
                params=params,
                headers=headers,
                verify=False
            )

            if api_request.status_code == 200 and "devices" in api_request.json():
                return api_request.json()["devices"]

            print(api_request.request.url)
            print(api_request.request.body)
            print(api_request.content)
            return []
        except:
            traceback.print_exc()
            return []
