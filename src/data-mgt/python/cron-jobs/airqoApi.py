import json
import traceback

import requests

from config import configuration


class AirQoApi:
    def __init__(self):
        self.airqo_base_url = configuration.AIRQO_BASE_URL
        self.calibrate_url = configuration.CALIBRATE_BASE_URL
        self.airqo_api_key = f"JWT {configuration.AIRQO_API_KEY}"
        self.request_body_size = configuration.REQUEST_BODY_SIZE
        self.timeout = configuration.REQUEST_TIMEOUT

    def get_events(self, tenant, start_time, end_time, device=None):
        headers = {'Authorization': self.airqo_api_key}

        params = {
            "tenant": tenant,
            "start_time": start_time,
            "end_time": end_time
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
            value_dict = dict(value)
            data = {
                    "device_id": value_dict.get("device"),
                    "sensor1_pm2.5": value_dict.get("pm2_5.value"),
                    "sensor2_pm2.5": value_dict.get("s2_pm2_5.value"),
                    "sensor1_pm10": value_dict.get("pm10.value"),
                    "sensor2_pm10": value_dict.get("s2_pm10.value"),
                    "temperature": value_dict.get("externalTemperature.value"),
                    "humidity": value_dict.get("externalHumidity.value"),
                }

            request_body["raw_values"].append(data)

        try:
            request_body = json.dumps(request_body)
            api_request = requests.post(
                '%s' % self.calibrate_url,
                data=request_body,
                headers=headers,
                verify=False
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
