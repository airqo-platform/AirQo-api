import traceback

import requests
import simplejson

from config import configuration


class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = configuration.AIRQO_BASE_URL
        self.AIRQO_BASE_URL_V2 = configuration.AIRQO_BASE_URL_V2
        self.AIRQO_API_KEY = f"JWT {configuration.AIRQO_API_KEY}"

    def save_events(self, measurements: list, tenant: str) -> None:

        for i in range(0, len(measurements), int(configuration.POST_EVENTS_BODY_SIZE)):
            data = measurements[i:i + int(configuration.POST_EVENTS_BODY_SIZE)]
            response = self.__request(endpoint='devices/events', params={"tenant": tenant},
                                      method='post', body=data)
            print(response)

    def get_calibrated_values(self, time: str, calibrate_body: list) -> list:
        calibrated_data = []
        for i in range(0, len(calibrate_body), int(configuration.CALIBRATE_REQUEST_BODY_SIZE)):
            values = calibrate_body[i:i + int(configuration.CALIBRATE_REQUEST_BODY_SIZE)]

            request_body = dict()
            request_body["datetime"] = time
            request_body["raw_values"] = []

            for value in values:
                try:
                    value_dict = dict(value)
                    data = {
                        "device_id": value_dict.get("device_id"),
                        "sensor1_pm2.5": value_dict.get("s1_pm2_5"),
                        "sensor2_pm2.5": value_dict.get("s2_pm2_5"),
                        "sensor1_pm10": value_dict.get("s1_pm10"),
                        "sensor2_pm10": value_dict.get("s2_pm10"),
                        "temperature": value_dict.get("temperature"),
                        "humidity": value_dict.get("humidity"),
                    }

                    if data["sensor1_pm2.5"] > 0.0 and data["sensor2_pm2.5"] > 0.0 and data["sensor1_pm10"] > 0.0 and \
                            data["sensor2_pm10"] > 0.0 and data["temperature"] > 0.0 and data["humidity"] > 0.0:
                        request_body["raw_values"].append(data)

                except Exception as ex:
                    traceback.print_exc()
                    print(ex)

            endpoint = "calibrate"
            response = self.__request(endpoint=endpoint, method="post", body=request_body)

            if response is not None:
                calibrated_data.extend(response)

        return calibrated_data

    def get_devices(self, tenant, active=True, all_devices=False) -> list:
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

    def get_read_keys(self, devices: list) -> dict:

        decrypted_keys = dict({})

        for device in devices:
            try:
                read_key = device['readKey']
                body = {"encrypted_key": read_key}
                response = self.__request("devices/decrypt", body=body, method='post')
                decrypted_keys[str(device['device_number'])] = response['decrypted_key']
            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return decrypted_keys

    def get_events(self, tenant, start_time, end_time, frequency, device=None, meta_data=None, recent=None) -> list:
        if recent:
            params = {
                "tenant": tenant,
                "frequency": frequency,
                "recent": "yes",
                "external": "no"
            }
        else:
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

    def get_forecast(self, timestamp, channel_id) -> list:

        endpoint = f"predict/{channel_id}/{timestamp}"
        response = self.__request(endpoint=endpoint, params={}, method="get", version='v2')

        if response is not None and "predictions" in response:
            return response["predictions"]

        return []

    def get_airqo_device_current_measurements(self, device_number):
        response = self.__request(endpoint="data/feeds/transform/recent", params={"channel": device_number})
        return response

    def get_sites(self, tenant) -> list:
        response = self.__request("devices/sites", {"tenant": tenant})

        if "sites" in response:
            return response["sites"]

        return []

    def __request(self, endpoint, params=None, body=None, method=None, version='v1'):

        base_url = self.AIRQO_BASE_URL_V2 if version.lower() == 'v2' else self.AIRQO_BASE_URL

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
                data=simplejson.dumps(body),
                verify=False,
            )
        elif method == "post":
            headers['Content-Type'] = 'application/json'
            api_request = requests.post(
                '%s%s' % (base_url, endpoint),
                params=params,
                headers=headers,
                data=simplejson.dumps(body),
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


def handle_api_error(api_request):
    try:
        print(api_request.request.url)
        print(api_request.request.body)
    except Exception as ex:
        print(ex)
    finally:
        print(api_request.content)
        print('API request failed with status code %s' % api_request.status_code)
