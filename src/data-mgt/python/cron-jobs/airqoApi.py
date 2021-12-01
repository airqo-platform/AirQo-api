import json
import traceback

import requests

from config import configuration
from utils import to_double


class AirQoApi:
    def __init__(self):
        self.airqo_base_url = configuration.AIRQO_BASE_URL
        self.calibrate_url = configuration.CALIBRATE_BASE_URL
        self.airqo_api_key = f"JWT {configuration.AIRQO_API_KEY}"
        self.request_body_size = configuration.REQUEST_BODY_SIZE
        self.timeout = configuration.REQUEST_TIMEOUT

    def get_events(self, tenant, start_time, end_time, frequency, device=None):
        headers = {'Authorization': self.airqo_api_key}

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

        api_request = requests.get(
            '%s%s' % (self.airqo_base_url, 'devices/events'),
            params=params,
            headers=headers,
            verify=False,
        )

        if api_request.status_code == 200 and "measurements" in api_request.json():
            return api_request.json()["measurements"]

        print(api_request.request.url)
        print(api_request.request.body)
        print(api_request.content)
        return []

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
                print(json_data)

                response = requests.post(url, json_data, headers=headers, verify=False, timeout=int(self.timeout))

                if response.status_code == 200:
                    print(response.json())
                else:
                    print("Device registry failed to insert values. Status Code : " + str(response.status_code))
                    print(response.content)
                    print(response.request.url)
                    print(response.request.body)
            except:
                traceback.print_exc()

    def get_devices(self, tenant):
        headers = {'Authorization': f'JWT {self.airqo_api_key}'}

        params = {
            "tenant": tenant,
            "active": 'yes'
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

    def get_calibrated_values(self, datetime, calibrate_body=None):

        if calibrate_body is None:
            calibrate_body = []
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'JWT {self.airqo_api_key}'
        }

        request_body = dict()
        request_body["datetime"] = datetime
        request_body["raw_values"] = []
        for value in calibrate_body:
            try:
                value_dict = dict(value)
                data = {
                    "device_id": value_dict.get("device"),
                    "sensor1_pm2.5": float(to_double(value_dict.get("s1_pm2_5"))),
                    "sensor2_pm2.5": float(to_double(value_dict.get("s2_pm2_5"))),
                    "sensor1_pm10": float(to_double(value_dict.get("s1_pm10"))),
                    "sensor2_pm10": float(to_double(value_dict.get("s2_pm10"))),
                    "temperature": float(to_double(value_dict.get("temperature"))),
                    "humidity": float(to_double(value_dict.get("humidity"))),
                }

                if data["sensor1_pm2.5"] > 0.0 and data["sensor2_pm2.5"] > 0.0 and data["sensor1_pm10"] > 0.0 and \
                        data["sensor2_pm10"] > 0.0 and data["temperature"] > 0.0 and data["humidity"] > 0.0:
                    request_body["raw_values"].append(data)

            except:
                traceback.print_exc()

        try:
            request_body = json.dumps(request_body)
            api_request = requests.post(
                '%s' % self.calibrate_url,
                data=request_body,
                headers=headers,
                verify=False,
                timeout=180
            )

            if api_request.status_code == 200:
                return api_request.json()

            print(api_request.request.url)
            print(api_request.request.body)
            print(api_request.content)
            return []
        except:
            traceback.print_exc()
            return []
