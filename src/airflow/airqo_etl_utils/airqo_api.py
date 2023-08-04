import traceback

import pandas as pd
import requests
import simplejson

from .config import configuration
from .constants import DeviceCategory, Tenant
from .utils import Utils


class AirQoApi:
    def __init__(self):
        self.CALIBRATION_BASE_URL = configuration.CALIBRATION_BASE_URL
        self.AIRQO_BASE_URL = Utils.remove_suffix(
            configuration.AIRQO_BASE_URL, suffix="/"
        )
        self.AIRQO_BASE_URL_V2 = Utils.remove_suffix(
            configuration.AIRQO_BASE_URL_V2, suffix="/"
        )
        self.AIRQO_API_KEY = f"JWT {configuration.AIRQO_API_KEY}"

    def save_events(self, measurements: list) -> None:
        #  Temporarily disabling usage of the API to store measurements.
        if (
            "staging" in self.AIRQO_BASE_URL.lower()
            or "staging" in self.AIRQO_BASE_URL_V2.lower()
        ):
            return

        for i in range(0, len(measurements), int(configuration.POST_EVENTS_BODY_SIZE)):
            data = measurements[i : i + int(configuration.POST_EVENTS_BODY_SIZE)]
            response = self.__request(
                endpoint="devices/events",
                params={"tenant": str(Tenant.AIRQO)},
                method="post",
                body=data,
            )
            print(response)

    def get_maintenance_logs(
        self, tenant: str, device: str, activity_type: str = None
    ) -> list:
        params = {"tenant": str(Tenant.AIRQO), "device": device}

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

    def get_devices(
        self,
        tenant: Tenant = Tenant.ALL,
        device_category: DeviceCategory = DeviceCategory.NONE,
    ) -> list:
        params = {"tenant": str(Tenant.AIRQO)}
        if tenant != Tenant.ALL:
            params["network"] = str(tenant)

        response = self.__request("devices", params)

        devices = [
            {
                **device,
                **{
                    "device_number": device.get("device_number", None),
                    "approximate_latitude": device.get(
                        "approximate_latitude", device.get("latitude", None)
                    ),
                    "approximate_longitude": device.get(
                        "approximate_longitude", device.get("longitude", None)
                    ),
                    "device_id": device.get("name", None),
                    "device_codes": [
                        str(code) for code in device.get("device_codes", [])
                    ],
                    "mongo_id": device.get("_id", None),
                    "site_id": device.get("site", {}).get("_id", None),
                    "site_latitude": device.get("site", {}).get("latitude", None),
                    "site_generated_name": device.get("site", {}).get(
                        "generated_name", None
                    ),
                    "site_longitude": device.get("site", {}).get("longitude", None),
                    "device_category": str(
                        DeviceCategory.from_str(device.get("category", ""))
                    ),
                    "tenant": device.get("network"),
                    "device_manufacturer": device.get(
                        "device_manufacturer",
                        Tenant.from_str(device.get("network")).device_manufacturer(),
                    ),
                },
            }
            for device in response.get("devices", [])
        ]

        if device_category != DeviceCategory.NONE:
            devices = list(
                filter(lambda y: y["device_category"] == str(device_category), devices)
            )

        return devices

    def get_thingspeak_read_keys(self, devices: list) -> dict:
        body = []
        for device in devices:
            read_key = device.get("readKey", None)
            device_number = device.get("device_number", None)
            if read_key and device_number:
                body.append(
                    {
                        "encrypted_key": read_key,
                        "device_number": device_number,
                    }
                )

        response = self.__request("devices/decrypt/bulk", body=body, method="post")

        decrypted_keys = response.get("decrypted_keys", [])

        return {
            int(entry["device_number"]): entry["decrypted_key"]
            for entry in decrypted_keys
        }

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

    def get_meta_data(self, latitude, longitude) -> dict:
        meta_data = {}
        meta_data_mappings = {
            "bearing_to_kampala_center": "",
            "distance_to_kampala_center": "distance_to_kampala_center",
            "landform_90": "landform-90",
            "landform_270": "landform-270",
            "aspect": "aspect",
            "bearing": "bearing",
            "altitude": "altitude",
            "distance_to_nearest_motorway_road": "distance/motorway/road",
            "distance_to_nearest_trunk_road": "distance/trunk/road",
            "distance_to_nearest_tertiary_road": "distance/tertiary/road",
            "distance_to_nearest_primary_road": "distance/primary/road",
            "distance_to_nearest_road": "distance/road",
            "distance_to_nearest_residential_road": "distance/residential/road",
            "distance_to_nearest_secondary_road": "distance/secondary/road",
            "distance_to_nearest_unclassified_road": "distance/unclassified/road",
        }

        for key, endpoint in meta_data_mappings.items():
            try:
                response = self.__request(
                    endpoint=f"meta-data/{endpoint}",
                    params={"latitude": latitude, "longitude": longitude},
                    method="get",
                )

                meta_data[key] = float(response["data"])
            except Exception as ex:
                print(ex)

        return meta_data

    def refresh_airqloud(self, airqloud_id):
        query_params = {"tenant": str(Tenant.AIRQO), "id": airqloud_id}

        try:
            response = requests.put(
                url=f"{self.AIRQO_BASE_URL}/devices/airqlouds/refresh",
                params=query_params,
            )

            print(response.json())
        except Exception as ex:
            print(ex)

    def get_airqlouds(self, tenant: Tenant = Tenant.ALL) -> list:
        query_params = {"tenant": str(Tenant.AIRQO)}

        if tenant != Tenant.ALL:
            query_params["network"] = str(tenant)
        response = self.__request("devices/airqlouds/dashboard", query_params)

        return [
            {
                "id": airqloud.get("_id", None),
                "name": airqloud.get("name", None),
                "tenant": airqloud.get("network", airqloud.get("tenant", None)),
                "sites": [site["_id"] for site in airqloud.get("sites", [])],
            }
            for airqloud in response.get("airqlouds", [])
        ]

    def get_sites(self, tenant: Tenant = Tenant.ALL) -> list:
        query_params = {"tenant": str(Tenant.AIRQO)}

        if tenant != Tenant.ALL:
            query_params["network"] = str(tenant)

        response = self.__request("devices/sites", query_params)

        return [
            {
                **site,
                **{
                    "site_id": site.get("_id", None),
                    "tenant": site.get("network", site.get("tenant", None)),
                    "location": site.get("location", None),
                    "approximate_latitude": site.get(
                        "approximate_latitude", site.get("latitude", None)
                    ),
                    "approximate_longitude": site.get(
                        "approximate_longitude", site.get("longitude", None)
                    ),
                    "search_name": site.get("search_name", site.get("name", None)),
                    "location_name": site.get(
                        "location_name", site.get("location", None)
                    ),
                },
            }
            for site in response.get("sites", [])
        ]

    def update_sites(self, updated_sites):
        for i in updated_sites:
            site = dict(i)
            params = {"tenant": str(Tenant.AIRQO), "id": site.pop("site_id")}
            response = self.__request("devices/sites", params, site, "put")
            print(response)

    def get_tenants(self, data_source) -> list:
        response = self.__request("users/networks")

        return [
            {
                **network,
                **{
                    "network_id": network.get("_id", None),
                    "network": network.get("net_name", None),
                    "data_source": network.get("net_data_source", None),
                    "api_key": network.get("net_api_key", None),
                },
            }
            for network in response.get("networks", [])
            if network.get("net_data_source") == str(data_source)
        ]

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
                "%s/%s" % (base_url, endpoint),
                params=params,
                headers=headers,
                verify=False,
            )
        elif method == "put":
            headers["Content-Type"] = "application/json"
            api_request = requests.put(
                "%s/%s" % (base_url, endpoint),
                params=params,
                headers=headers,
                data=simplejson.dumps(body, ignore_nan=True),
                verify=False,
            )
        elif method == "post":
            headers["Content-Type"] = "application/json"
            api_request = requests.post(
                "%s/%s" % (base_url, endpoint),
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
