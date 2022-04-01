import traceback

import requests
import simplejson

from airqo_etl_utils.config import configuration


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

    def get_calibrated_values(self, time: str, calibrate_body: list) -> list:
        calibrated_data = []
        base_url = (
            self.CALIBRATION_BASE_URL
            if self.CALIBRATION_BASE_URL
            else self.AIRQO_BASE_URL
        )
        endpoint = "calibrate"
        for i in range(
            0, len(calibrate_body), int(configuration.CALIBRATE_REQUEST_BODY_SIZE)
        ):
            values = calibrate_body[
                i : i + int(configuration.CALIBRATE_REQUEST_BODY_SIZE)
            ]

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

                    if (
                        data["sensor1_pm2.5"] > 0.0
                        and data["sensor2_pm2.5"] > 0.0
                        and data["sensor1_pm10"] > 0.0
                        and data["sensor2_pm10"] > 0.0
                        and data["temperature"] > 0.0
                        and data["humidity"] > 0.0
                    ):
                        request_body["raw_values"].append(data)

                except Exception as ex:
                    traceback.print_exc()
                    print(ex)

            try:
                response = self.__request(
                    endpoint=endpoint,
                    method="post",
                    body=request_body,
                    base_url=base_url,
                )

                if response is not None:
                    calibrated_data.extend(response)
            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return calibrated_data

    def get_devices(self, tenant, all_devices=True) -> list:
        params = {
            "tenant": tenant,
        }
        if not all_devices:
            params["active"] = "yes"
        response = self.__request("devices", params)

        if "devices" in response:
            return response["devices"]

        return []

    def get_read_keys(self, devices: list) -> dict:

        decrypted_keys = dict({})

        for device in devices:
            try:
                read_key = device["readKey"]
                body = {"encrypted_key": read_key}
                response = self.__request("devices/decrypt", body=body, method="post")
                decrypted_keys[str(device["device_number"])] = response["decrypted_key"]
            except Exception as ex:
                traceback.print_exc()
                print(ex)

        return decrypted_keys

    def get_events(
        self,
        tenant,
        start_time,
        end_time,
        frequency,
        device=None,
        meta_data=None,
        recent=None,
    ) -> list:
        if recent:
            params = {
                "tenant": tenant,
                "frequency": frequency,
                "recent": "yes",
                "external": "no",
            }
        else:
            params = {
                "tenant": tenant,
                "startTime": start_time,
                "endTime": end_time,
                "frequency": frequency,
                "recent": "no",
                "external": "no",
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

    def get_airqo_device_current_measurements(self, device_number):
        response = self.__request(
            endpoint="data/feeds/transform/recent", params={"channel": device_number}
        )
        return response

    def get_sites(self, tenant=None) -> list:
        if tenant:
            response = self.__request("devices/sites", {"tenant": tenant})
            if "sites" in response:
                sites = response["sites"]
                sites_with_tenant = []
                for site in sites:
                    site["tenant"] = tenant
                    sites_with_tenant.append(site)
                return sites_with_tenant
        else:
            sites_with_tenant = []
            for x in ["airqo", "kcca"]:
                response = self.__request("devices/sites", {"tenant": x})
                if "sites" in response:
                    sites = response["sites"]
                    for site in sites:
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
                data=simplejson.dumps(body),
                verify=False,
            )
        elif method == "post":
            headers["Content-Type"] = "application/json"
            api_request = requests.post(
                "%s%s" % (base_url, endpoint),
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
        print("API request failed with status code %s" % api_request.status_code)
