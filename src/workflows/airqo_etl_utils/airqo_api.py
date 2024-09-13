import traceback
from urllib.parse import urlencode

import pandas as pd
import simplejson
import urllib3
from urllib3.util.retry import Retry
from typing import List, Dict, Any

from .config import configuration
from .constants import DeviceCategory, Tenant
from .utils import Utils
import logging

logger = logging.getLogger(__name__)


class AirQoApi:
    def __init__(self) -> None:
        self.CALIBRATION_BASE_URL = configuration.CALIBRATION_BASE_URL
        self.AIRQO_BASE_URL_V2 = Utils.remove_suffix(
            configuration.AIRQO_BASE_URL_V2, suffix="/"
        )
        self.AIRQO_API_KEY = f"JWT {configuration.AIRQO_API_KEY}"
        self.AIRQO_API_TOKEN = configuration.AIRQO_API_TOKEN

    def save_events(self, measurements: List) -> None:
        #  Temporarily disabling usage of the API to store measurements.
        if "staging" in self.AIRQO_BASE_URL_V2.lower():
            return
        # TODO Findout if there is a bulk post api option greater than 5.
        for i in range(0, len(measurements), int(configuration.POST_EVENTS_BODY_SIZE)):
            data = measurements[i : i + int(configuration.POST_EVENTS_BODY_SIZE)]
            response = self.__request(
                endpoint="devices/events",
                params={"tenant": str(Tenant.AIRQO)},
                method="post",
                body=data,
            )

    def get_maintenance_logs(
        self, tenant: str, device: str, activity_type: str = None
    ) -> List:
        """
        Retrieve devices given a tenant and device category.

        Args:
            - tenant: An Enum that represents site ownership.
            - device: The name of the device.
            - activity_type: Defines if the activity logged is a maintenance or deployment activity. If not supplied returns all activities for the given device.

        Returns:
            List[Dict[str, Any]]: A List of dictionaries containing the maintenance activity information of the device. The dictionary has the following structure.
            [
                {
                    "_id":str,
                    "activity_codes":List[str],
                    "tags":List[str],
                    "device":str,
                    "date": date(str),
                    "description":str,
                    "activityType":str,
                    "site_id":str,
                    "nextMaintenance":date(str),
                    "createdAt":date(str),
                    "updatedAt":date(str)
                }
            ]
        """
        # Why is tenant still a parameter when it is being overriden.
        params = {"tenant": str(Tenant.AIRQO), "device": device}

        if activity_type:
            params["activity_type"] = activity_type

        response = self.__request("devices/activities", params)

        if "site_activities" in response:
            return response["site_activities"]
        elif "device_activities" in response:
            return response["device_activities"]
        return []

    def calibrate_data(self, time: str, data: pd.DataFrame) -> List:
        # TODO Update doc string.
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
            else self.AIRQO_BASE_URL_V2
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
            logger.exception()
            return []

    def get_devices(
        self,
        tenant: Tenant = Tenant.ALL,
        device_category: DeviceCategory = DeviceCategory.NONE,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve devices given a tenant and device category.

        Args:
            - tenant (Tenant, optional): An Enum that represents site ownership. Defaults to `Tenant.ALL` if not supplied.
            - device_category (DeviceCategory, optional): An Enum that represents device category. Defaults to `DeviceCategory.None` if not supplied.

        Returns:
            List[Dict[str, Any]]: A List of dictionaries containing the details of the devices. The dictionary has the following structure.
            [
                {
                    "_id": str,
                    "visibility": bool,
                    "mobility": bool,
                    "height": int,
                    "device_codes": List[str]
                    "status": str,
                    "isPrimaryInLocation": bool,
                    "nextMaintenance": date(str),
                    "category": str,
                    "isActive": bool,
                    "long_name": str,
                    "network": str,
                    "alias": str",
                    "name": str,
                    "createdAt": date(str),
                    "description": str,
                    "latitude": float,
                    "longitude": float,
                    "approximate_distance_in_km": float,
                    "bearing_in_radians": float,
                    "deployment_date": date(str),
                    "mountType": str,
                    "powerType": str,
                    "recall_date": date(str),
                    "previous_sites": List[Dict[str, Any]],
                    "cohorts": List,
                    "site": Dict[str, Any],
                    device_number
                },
            ]
        """
        params = {"tenant": str(Tenant.AIRQO)}
        if configuration.ENVIRONMENT == "production":
            # Query for active devices only when in production
            params["active"] = "yes"

        if tenant != Tenant.ALL:
            params["network"] = str(tenant)

        response = self.__request("devices", params)
        devices = [
            {
                **device,
                "device_number": device.get("device_number"),
                "latitude": device.get("latitude")
                or device.get("approximate_latitude"),
                "longitude": device.get("longitude")
                or device.get("approximate_longitude"),
                "device_id": device.get("name"),
                "device_codes": [str(code) for code in device.get("device_codes", [])],
                "mongo_id": device.get("_id"),
                "site_id": device.get("site", {}).get("_id"),
                "site_location": device.get("site", {}).get("location_name"),
                "device_category": str(
                    DeviceCategory.from_str(device.get("category", ""))
                ),
                "tenant": device.get("network"),
                "device_manufacturer": device.get("device_manufacturer")
                or Tenant.from_str(device.get("network")).device_manufacturer(),
            }
            for device in response.get("devices", [])
        ]

        if device_category != DeviceCategory.NONE:
            devices = [
                device
                for device in devices
                if device["device_category"] == str(device_category)
            ]
        return devices

    def get_thingspeak_read_keys(self, devices: List) -> Dict[int, str]:
        """
        Retrieve read keys from thingspeak given a list of devices.

        Args:
            - tenant (Tenant, optional): An Enum that represents site ownership. Defaults to `Tenant.ALL` if not supplied.
            - device_category (DeviceCategory, optional): An Enum that represents device category. Defaults to `DeviceCategory.None` if not supplied.

        Returns:
            Dict[int, str]: A dictionary containing device decrypted keys. The dictionary has the following structure.
            {
                "device_number":str,
            }
        """

        body: List = []
        decrypted_keys: List[Dict[str, str]] = []
        decrypted_read_keys: Dict[int, str] = {}

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

        if response:
            decrypted_keys = response.get("decrypted_keys", [])
            return {
                int(entry["device_number"]): entry["decrypted_key"]
                for entry in decrypted_keys
            }
        # TODO Find a better way to do better handling vs returning an empty object.
        return decrypted_read_keys

    def get_forecast(self, frequency: str, site_id: str) -> List:
        """
        Retrieve forecast data for a given site for different intervals i.e daily/hourly etc

        Args:
            - Frequency: Time interval i.e daily/hourly for which data is required.
            - Site id: Unique identifier for the specific site whose data is required.

        Returns:
            List[Dict[str, Any]]
            [
                {
                    "pm2_5": float,
                    "time": str #"2024-07-01 00:00:00+00:00"
                },
            ]
        """
        endpoint = f"predict/{frequency}-forecast"
        params = {"site_id": site_id}
        response = self.__request(endpoint=endpoint, params=params, method="get")

        if (
            response is not None
            and "forecasts" in response.keys()
            and len(response["forecasts"]) > 0
        ):
            return response["forecasts"]

        return []

    def get_nearest_weather_stations(
        self, latitude: str, longitude: str
    ) -> List[Dict[str, Any]]:
        """
        Retrieve nearest weather station data given latitude and longitude

        Args:
            - latitude
            - longitude

        Returns:
            List[Dict[str, Any]]: returns a list of dictionaries with the nearest weather stations to the coordinates supplied.
            [
                {
                    "code": str,
                    "country": str, #"UG"
                    "distance": float,
                    "id": int,
                    "latitude": float,
                    "longitude": float,
                    "name": str,
                    "timezone": str, #"Africa/Nairobi"
                    "type": str
                },
            ]
        """
        response = self.__request(
            endpoint="meta-data/nearest-weather-stations",
            params={"latitude": latitude, "longitude": longitude},
            method="get",
        )

        return list(response["weather_stations"]) if response else []

    def get_meta_data(self, latitude: str, longitude: str) -> Dict[str, float]:
        """
        Retrieve meta data given latitude and longitude for updating site distance measures.

        Args:
            - latitude
            - longitude

        Returns:
            Dict[str, float]: Returns a dictionary containing meta data about a given location.
            {
                "bearing_to_kampala_center": float,
                "distance_to_kampala_center": float,
                "landform_90": float,
                "landform_270": float,
                "aspect": float,
                "bearing": float,
                "altitude": float,
                "distance_to_nearest_motorway_road": float,
                "distance_to_nearest_trunk_road": float,
                "distance_to_nearest_tertiary_road": float,
                "distance_to_nearest_primary_road": float,
                "distance_to_nearest_road": float,
                "distance_to_nearest_residential_road": float,
                "distance_to_nearest_secondary_road": float,
                "distance_to_nearest_unclassified_road": float,
            }
        """
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
                logger.exception()

        return meta_data

    def refresh_airqloud(self, airqloud_id: str) -> None:
        # TODO Update doc string.
        query_params = {"tenant": str(Tenant.AIRQO), "id": airqloud_id}

        try:
            self.__request(
                endpoint="devices/airqlouds/refresh", params=query_params, method="put"
            )
        except Exception:
            logger.exception()

    def refresh_grid(self, grid_id: str) -> None:
        # TODO Update doc string.
        query_params = {"tenant": str(Tenant.AIRQO)}

        try:
            response = self.__request(
                endpoint=f"devices/grids/refresh/{grid_id}",
                params=query_params,
                method="put",
            )
        except Exception:
            logger.exception()

    def get_airqlouds(self, tenant: Tenant = Tenant.ALL) -> List[Dict[str, Any]]:
        """
        Retrieve airqlouds given tenant. An airqloud is a logical group of devices or sites. It can be a grid or a cohort.

        Args:
            tenant (Tenant, optional): An Enum that represents grid/cohort ownership. Defaults to `Tenant.ALL` if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the airqloud details.
            [
                {
                    "id": str,
                    "name": str,
                    "tenant": str, #Can be null/None
                    "sites": List[str] #List of site ids.
                }
            ]
        """
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

    def get_favorites(self, user_id: str) -> List:
        # TODO Check if this is working. {"success":true,"message":"no favorites exist","favorites":[]} for ids passed.
        query_params = {"tenant": str(Tenant.AIRQO)}

        response = self.__request(f"users/favorites/users/{user_id}", query_params)

        favorites_with_pm = []
        for favorite in response.get("favorites", []):
            place_id = favorite.get("place_id")
            pm_value = AirQoApi().get_site_measurement(place_id)
            if pm_value is not None:
                favorites_with_pm.append(
                    {
                        "place_id": place_id,
                        "name": favorite.get("name"),
                        "location": favorite.get("location"),
                        "pm_value": pm_value,
                    }
                )

        return favorites_with_pm

    def get_location_history(self, user_id: str) -> List:
        # TODO Check if this is working. {"success":true,"message":"no Location Histories exist","location_histories":[]} for ids passed
        query_params = {"tenant": str(Tenant.AIRQO)}

        response = self.__request(
            f"users/locationHistory/users/{user_id}", query_params
        )

        locations_with_measurements = []
        for location in response.get("location_histories", []):
            place_id = location.get("place_id")
            pm_value = AirQoApi().get_site_measurement(place_id)
            if pm_value is not None:
                locations_with_measurements.append(
                    {
                        "placeId": place_id,
                        "name": location.get("name"),
                        "location": location.get("location"),
                        "pm_value": pm_value,
                    }
                )

        return locations_with_measurements

    def get_search_history(self, user_id: str) -> List:
        # TODO Check if this is working. Currently returns {"success":true,"message":"no Search Histories exist","search_histories":[]} for all ids.
        query_params = {"tenant": str(Tenant.AIRQO)}

        response = self.__request(f"users/searchHistory/users/{user_id}", query_params)

        search_histories_with_measurements = []
        for location in response.get("search_histories", []):
            place_id = location.get("place_id")
            pm_value = AirQoApi().get_site_measurement(place_id)
            if pm_value is not None:
                search_histories_with_measurements.append(
                    {
                        "placeId": place_id,
                        "name": location.get("name"),
                        "location": location.get("location"),
                        "pm_value": pm_value,
                    }
                )

        return search_histories_with_measurements

    def get_site_measurement(self, site_id: str) -> float:
        """
        Retrieve site measurements given a site id.

        Args:
            site_id: The specific site id whose measurements are required.

        Returns:
            # List[Dict[str, Any]]: A list of dictionaries with that specific site's measurements of upto 7 days.
            # [
            #     {
            #         "device":str,
            #         "device_id":str,
            #         "site_id":str,
            #         "time":date(str),
            #         "pm2_5":Dict[str, float],
            #         "pm10":Dict[str, float],
            #         "frequency":str,
            #         "no2":Dict[str, float],
            #         "siteDetails":Dict[str, Any]
            #     },

            # ]
            float: pm2_5 value of the given site.
        """
        try:
            query_params = {"tenant": str(Tenant.AIRQO), "site_id": site_id}

            response = self.__request("devices/measurements", query_params)
            # TODO Is there a cleaner way of doing this? End point returns more data than returned to the user. WHY?
            measurement = response["measurements"][0]["pm2_5"]["value"]
            return measurement
        except Exception:
            logger.exception()
            return None

    def get_grids(self, tenant: Tenant = Tenant.ALL) -> List[Dict[str, Any]]:
        """
        Retrieve grids given a tenant. A grid is a group of sites which are 'usually' in the same geographical boundary.

        Args:
            tenant (Tenant, optional): An Enum that represents grid/cohort ownership. Defaults to `Tenant.ALL` if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the grid details.
            [
                {
                    "id": str,
                    "name": str,
                    "tenant": str,
                    "sites": List[str]
                },
            ]
        """
        query_params = {"tenant": str(Tenant.AIRQO)}

        if tenant != Tenant.ALL:
            query_params["network"] = str(tenant)
        response = self.__request("devices/grids/summary", query_params)

        return [
            {
                "id": grid.get("_id", None),
                "name": grid.get("name", None),
                "tenant": "airqo",
                "sites": [site["_id"] for site in grid.get("sites", [])],
            }
            for grid in response.get("grids", [])
        ]

    def get_cohorts(self, tenant: Tenant = Tenant.ALL) -> List[Dict[str, Any]]:
        """
        Retrieve cohorts given a tenant. A cohort is a group of devices put together based on various criteria.

        Args:
            tenant (Tenant, optional): An Enum that represents grid/cohort ownership. Defaults to `Tenant.ALL` if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the cohort details.
            [
                {
                    "id": str,
                    "name": str,
                    "tenant": str,
                    "devices": List[str]
                },
            ]
        """
        query_params = {"tenant": str(Tenant.AIRQO)}

        if tenant != Tenant.ALL:
            query_params["network"] = str(tenant)
        response = self.__request("devices/cohorts", query_params)

        return [
            {
                "id": cohort.get("_id", None),
                "name": cohort.get("name", None),
                "tenant": "airqo",
                "devices": [device["_id"] for device in cohort.get("devices", [])],
            }
            for cohort in response.get("cohorts", [])
        ]

    def get_sites(self, tenant: Tenant = Tenant.ALL) -> List[Dict[str, Any]]:
        """
        Retrieve sites given a tenant.

        Args:
            tenant (Tenant, optional): An Enum that represents site ownership. Defaults to `Tenant.ALL` if not supplied.

        Returns:
            List[Dict[str, Any]]: A List of dictionaries containing the details of the sites. The dictionary has the following structure.
            [
                {
                    "_id": str,
                    "nearest_tahmo_station": Dict[str, Any]
                    "site_tags": List[str],
                    "city": str,
                    "district": str,
                    "county": str,
                    "region": str,
                    "country": str,
                    "latitude": float,
                    "longitude": float,
                    "name": str,
                    "lat_long": str,
                    "generated_name": str,
                    "bearing_to_kampala_center": float,
                    "altitude": float,
                    "distance_to_kampala_center": float,
                    "aspect": int,
                    "landform_270": int,
                    "landform_90": int,
                    "greenness": int,
                    "distance_to_nearest_unclassified_road": float,
                    "distance_to_nearest_tertiary_road": float,
                    "distance_to_nearest_residential_road": float,
                    "distance_to_nearest_secondary_road": float,
                    "description": str,
                    "createdAt": date(str),
                    "distance_to_nearest_primary_road": float,
                    "distance_to_nearest_road": float,
                    "approximate_latitude": float,
                    "approximate_longitude": float,
                    "weather_stations": List[dict[str, Any]],
                    "devices": List,
                    "airqlouds": List[Dict[str, Any]]
                },
            ]
        """
        query_params = {"tenant": str(Tenant.AIRQO)}

        if tenant != Tenant.ALL:
            query_params["network"] = str(tenant)

        response = self.__request("devices/sites", query_params)

        return [
            {
                **site,
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
                "location_name": site.get("location_name", site.get("location", None)),
            }
            for site in response.get("sites", [])
        ]

    def update_sites(self, updated_sites):
        # TODO Update doc string.
        for i in updated_sites:
            site = dict(i)
            params = {"tenant": str(Tenant.AIRQO), "id": site.pop("site_id")}
            self.__request("devices/sites", params, site, "put")

    def get_tenants(self, data_source: str) -> List[Dict[str, Any]]:
        """
        Retrieve tenants given a data source.

        Args:
            data_source: The source of the tenant's data.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with tenant details.

            [
                {
                    "_id": str,
                    "net_status": str,
                    "net_email": str,
                    "net_phoneNumber": int,
                    "net_category": str,
                    "net_name": str,
                    "net_description": str,
                    "net_website": str,
                    "net_acronym": str,
                    "net_api_key": str,
                    "net_data_source": str,
                    "createdAt": str,
                    "net_users": List[Dict[str,Any]],
                    "net_permissions": List[Dict[str,Any]],
                    "net_roles": List[Dict[str,Any]],
                    "net_groups": List[Dict[str,Any]],
                    "net_departments": List[Dict[str,Any]],
                    "network_id": str,
                    "network": str,
                    "data_source": str,
                    "api_key": str"
                },
            ]
        """
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

    def __request(self, endpoint, params=None, body=None, method="get", base_url=None):
        """
        Executes API request and returns the response.

        Args:
            endpoint: API endpoit with the requeste resources.
            params: API request parameters for filtering/specifying request details.
            body: Payload in cases where data is being sent to the server to create/update a resource.
            method: API request method to specify how the request should interact with the server resources.
            base_url: Url specifying to which system/resources the request should be routed to.

        Returns:
            Response object: The response object is determined by the endpoint to which the request is sent.

        Raises:
            HTTPError if an error occurs when executing the request. The error is logged and None is returned.
        """
        if base_url is None:
            base_url = self.AIRQO_BASE_URL_V2

        headers = {"Authorization": self.AIRQO_API_KEY}
        if params is None:
            params = {}
        params.update({"token": self.AIRQO_API_TOKEN})

        retry_strategy = Retry(
            total=5,
            backoff_factor=5,
        )

        http = urllib3.PoolManager(retries=retry_strategy)

        url = f"{base_url}/{endpoint}"
        try:
            if method == "put" or method == "post":
                headers["Content-Type"] = "application/json"
                encoded_args = urlencode(params)
                url = url + "?" + encoded_args
                if body:
                    response = http.request(
                        method.upper(),
                        url,
                        headers=headers,
                        body=simplejson.dumps(body, ignore_nan=True),
                    )
                else:
                    # TODO Investigate what resource is being created here
                    # This might be redundant but again it could be creating a resource with default arguments or triggering a server-side action.
                    response = http.request(method.upper(), url, headers=headers)
            elif method == "get":
                response = http.request(
                    method.upper(), url, fields=params, headers=headers
                )
            else:
                logger.exception("Method not supported")
                return None

            if response.status == 200 or response.status == 201:
                return simplejson.loads(response.data)
            else:
                Utils.handle_api_error(response)
                return None

        except urllib3.exceptions.HTTPError as ex:
            logger.exception(f"HTTPError: {ex}")
            return None
