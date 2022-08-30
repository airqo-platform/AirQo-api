import traceback

import pandas as pd
import requests
import simplejson

from .config import configuration
from .constants import DeviceCategory


class AirQoApi:
    def __init__(self):
        self.AIRQO_BASE_URL = configuration.AIRQO_BASE_URL
        self.CALIBRATION_BASE_URL = configuration.CALIBRATION_BASE_URL
        self.AIRQO_BASE_URL_V2 = configuration.AIRQO_BASE_URL_V2
        self.AIRQO_API_KEY = f"JWT {configuration.AIRQO_API_KEY}"

    def save_events(self, measurements: list, tenant: str) -> None:

        for i in range(0, len(measurements), int(configuration.POST_EVENTS_BODY_SIZE)):
            data = measurements[i : i + int(configuration.POST_EVENTS_BODY_SIZE)]
            response = self.__request(
                endpoint="devices/events",
                params={"tenant": tenant},
                method="post",
                body=data,
            )
            print(response)

    def get_maintenance_logs(
        self, tenant: str, device: str, activity_type: str = None
    ) -> list:
        params = {"tenant": tenant, "device": device}

        if activity_type:
            params["activity_type"] = activity_type

        response = self.__request("devices/activities", params)

        if "site_activities" in response:
            return response["site_activities"]
        elif "device_activities" in response:
            return response["device_activities"]
        return []

    def calibrate_data(self, time: str, data: pd.DataFrame) -> list:
        data = data.copy()
        data = data[
            [
                "device_number",
                "s1_pm2_5",
                "s2_pm2_5",
                "s1_pm10",
                "s2_pm10",
                "temperature",
                "humidity",
            ]
        ]

        data.rename(
            columns={
                "device_number": "device_id",
                "s1_pm2_5": "sensor1_pm2.5",
                "s2_pm2_5": "sensor2_pm2.5",
                "s1_pm10": "sensor1_pm10",
                "s2_pm10": "sensor2_pm10",
                "temperature": "temperature",
                "humidity": "humidity",
            },
            inplace=True,
        )

        request_body = {"datetime": time, "raw_values": data.to_dict("records")}

        base_url = (
            self.CALIBRATION_BASE_URL
            if self.CALIBRATION_BASE_URL
            else self.AIRQO_BASE_URL
        )

        try:
            response = self.__request(
                endpoint="calibrate",
                method="post",
                body=request_body,
                base_url=base_url,
            )
            return response if response else []
        except Exception as ex:
            traceback.print_exc()
            print(ex)
            return []

    def get_devices(self, tenant=None, category: DeviceCategory = None) -> list:

        devices = []

        if tenant:
            params = {"tenant": tenant}
            response = self.__request("devices", params)
            if "devices" in response:
                for device in response["devices"]:
                    device["tenant"] = tenant
                    devices.append(device)
        else:
            for x in ["airqo", "kcca"]:
                params = {"tenant": x}
                response = self.__request("devices", params)
                if "devices" in response:
                    for device in response["devices"]:
                        device["tenant"] = x
                        devices.append(device)

        devices = [
            {
                **device,
                **{
                    "device_id": device.get("name", None),
                    "site_id": device.get("site", {}).get("_id", None),
                    "category": DeviceCategory.from_str(device.get("category", "")),
                },
            }
            for device in devices
        ]

        if category:
            return list(filter(lambda y: y["category"] == category, devices))

        return devices

    def get_thingspeak_read_keys(self, devices: list) -> dict:

        decrypted_keys = dict({})

        for device in devices:
            try:
                read_key = device["readKey"]
                body = {"encrypted_key": read_key}
                response = self.__request("devices/decrypt", body=body, method="post")
                decrypted_keys[device["device_number"]] = response["decrypted_key"]
            except Exception as ex:
                print(ex)

        return decrypted_keys

    def get_app_insights(
        self,
        start_time: str,
        end_time: str,
        frequency: str,
        site_id=None,
        forecast=False,
        empty=False,
        all_data=False,
    ) -> list:
        if all_data:
            params = {
                "startDateTime": start_time,
                "endDateTime": end_time,
            }
        else:
            params = {
                "startDateTime": start_time,
                "endDateTime": end_time,
                "frequency": frequency,
                "empty": empty,
                "forecast": forecast,
            }
        if site_id:
            params["siteId"] = site_id

        endpoint = "view/measurements/app/insights"
        response = self.__request(endpoint=endpoint, params=params, method="get")

        if "data" in response:
            return response["data"]

        return []

    def get_forecast(self, timestamp, channel_id) -> list:

        endpoint = f"predict/{channel_id}/{timestamp}"
        response = self.__request(
            endpoint=endpoint, params={}, method="get", version="v2"
        )

        if response is not None and "predictions" in response:
            return response["predictions"]

        return []

    def get_nearest_weather_stations(self, latitude, longitude) -> list:
        response = self.__request(
            endpoint="meta-data/nearest-weather-stations",
            params={"latitude": latitude, "longitude": longitude},
            method="get",
        )

        return list(response["weather_stations"]) if response else []

    def get_sites(self, tenant=None) -> list:
        if tenant:
            response = self.__request("devices/sites", {"tenant": tenant})
            if "sites" in response:
                sites_with_tenant = []
                for site in response["sites"]:
                    site["tenant"] = tenant
                    sites_with_tenant.append(site)
                return sites_with_tenant
        else:
            sites_with_tenant = []
            for x in ["airqo", "kcca"]:
                response = self.__request("devices/sites", {"tenant": x})
                if "sites" in response:
                    for site in response["sites"]:
                        site["tenant"] = x
                        sites_with_tenant.append(site)
            return sites_with_tenant

    def __request(
        self, endpoint, params=None, body=None, method=None, version="v1", base_url=None
    ):

        if base_url is None:
            base_url = (
                self.AIRQO_BASE_URL_V2
                if version.lower() == "v2"
                else self.AIRQO_BASE_URL
            )

        headers = {"Authorization": self.AIRQO_API_KEY}
        if method is None or method == "get":
            api_request = requests.get(
                "%s%s" % (base_url, endpoint),
                params=params,
                headers=headers,
                verify=False,
            )
        elif method == "put":
            headers["Content-Type"] = "application/json"
            api_request = requests.put(
                "%s%s" % (base_url, endpoint),
                params=params,
                headers=headers,
                data=simplejson.dumps(body, ignore_nan=True),
                verify=False,
            )
        elif method == "post":
            headers["Content-Type"] = "application/json"
            api_request = requests.post(
                "%s%s" % (base_url, endpoint),
                params=params,
                headers=headers,
                data=simplejson.dumps(body, ignore_nan=True),
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
        print("API request failed with status code %s" % api_request.status_code)
