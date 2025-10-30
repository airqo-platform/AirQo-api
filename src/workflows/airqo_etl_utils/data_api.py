from typing import List, Dict, Any, Generator, Tuple, Optional
import pandas as pd
import concurrent.futures
from tenacity import retry, stop_after_attempt, wait_exponential

from urllib.parse import urlencode
import simplejson
import urllib3
from urllib.parse import parse_qs
from urllib3.util.retry import Retry

from .utils import Utils
from .config import configuration
from .constants import DeviceCategory, DeviceNetwork, MetaDataType

import logging

logger = logging.getLogger("airflow.task")

MAX_RETRIES = 2
RETRY_DELAY = 300
max_workers = configuration.MAX_WORKERS


class DataApi:
    def __init__(self) -> None:
        pass

    def send_to_events_api(self, measurements: List) -> None:
        """
        Sends a list of event measurements to the 'devices/events' API endpoint.

        Args:
            measurements (List): A list of event measurement objects to be posted.

        Raises:
            requests.RequestException: If the request fails.
        """
        try:
            self._request(
                endpoint="devices/events",
                method="post",
                body=measurements,
            )
            logger.info(f"{len(measurements)} records sent to the events api")
        except Exception as e:
            logger.exception(f"An error occurred: {e}")

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, max=120),
    )
    def send_to_events_api_with_retry(self, measurements: List):
        """
        Sends event measurements to the 'devices/events' endpoint with retry logic.

        Retries up to MAX_RETRIES times with a delay between attempts in case of failure.

        Args:
            measurements (List): A list of event measurement objects to be posted.
        """
        try:
            self._request(
                endpoint="devices/events",
                method="post",
                body=measurements,
            )
            logger.info(f"{len(measurements)} records sent to the events api")
            return
        except Exception as e:
            logger.exception(f"An error occurred: {e}")

    def save_events(self, measurements: List) -> None:
        """
        Sends event measurements to the API in parallel, batched requests.

        Splits the full list of measurements into chunks defined by POST_EVENTS_BODY_SIZE
        and sends each batch concurrently using ThreadPoolExecutor. Each batch is sent
        with retry logic.

        Args:
            measurements (List): A list of event measurement objects to be posted.
        """
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            for i in range(
                0, len(measurements), int(configuration.POST_EVENTS_BODY_SIZE)
            ):
                data = measurements[i : i + int(configuration.POST_EVENTS_BODY_SIZE)]
                executor.submit(self.send_to_events_api_with_retry, data)

    def get_maintenance_logs(
        self, network: str, device: str, activity_type: str = None
    ) -> List:
        """
        Retrieve devices given a network and device category.

        Args:
            - network: An Enum that represents site ownership.
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
        params = {"network": network, "device": device}

        if activity_type:
            params["activity_type"] = activity_type

        response = self._request("devices/activities", params)

        if "site_activities" in response:
            return response["site_activities"]
        elif "device_activities" in response:
            return response["device_activities"]
        return []

    def get_devices(
        self,
        params: Dict[str, Any] = {},
    ) -> List[Dict[str, Any]]:
        """
        Retrieve devices given a network and device category.

        Args:
            - params: A dictionary of query parameters to be sent with the request. Expected keys include 'status', 'online_status', 'device_network', and 'device_category'.

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
                    "device_number": int
                },
            ]
        """

        if configuration.ENVIRONMENT == "production":
            params["status"] = "deployed"

        params = self.__check_api_params(params)

        devices = [
            {
                "device_id": device.pop("name"),
                "site_id": device.get("site", {}).get("_id", None),
                "site_location": device.pop("site", {}).get("location_name", None),
                "device_category": device.pop("category", ""),
                "device_manufacturer": device.get("network", "airqo"),
                "device_maintenance": self.__get_device_maintenance_activity(device),
                **device,
            }
            for device in self._fetch_metadata(
                "devices/summary", MetaDataType.DEVICES, params
            )
        ]
        return devices

    def __check_api_params(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validates and filters the input parameters to ensure only allowed parameters are included.

        Args:
            params (Dict[str, Any]): A dictionary of input parameters to be validated.

        Returns:
            Dict[str, Any]: A dictionary containing only the allowed parameters.
        """
        valid_params = {
            "status": str,
            "online_status": str,
            "device_network": DeviceNetwork,
            "device_category": DeviceCategory,
        }
        filtered_params = {}
        for key, value in params.items():
            if key in valid_params and isinstance(value, valid_params[key]):
                filtered_params[key] = value if isinstance(value, str) else value.str
            elif key in valid_params:
                logger.warning(
                    f"Parameter '{key}' has an invalid type. Expected {valid_params[key].__name__}, got {type(value).__name__}. It will be ignored."
                )
            else:
                logger.warning(
                    f"Parameter '{key}' is not a valid parameter and will be ignored."
                )
        return filtered_params

    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, max=120),
    )
    def _fetch_metadata(
        self, endpoint: str, metadatatype: MetaDataType, params: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Retrieves a list of devices/sites from the API, handling pagination.
        Args:
            params(Dict[str, Any]): A dictionary of query parameters to be sent with the request. Expected keys include 'limit', 'skip', 'tenant', and 'detailLevel'.
        Returns:
            List[Dict[str, Any]]: A list of dictionaries, where each dictionary represents a device.
        Notes:
            - This method handles pagination by updating the 'params' dictionary with the
              appropriate 'limit', 'skip', 'tenant', and 'detailLevel' values extracted from the
              'nextPage' URL in the API response.
        """
        next_page: Optional[str] = True
        response_data: List[Dict[str, Any]] = []
        i = 0
        while next_page:
            try:
                response = self._request(endpoint, params)
                next_page = response.get("meta", {}).get("nextPage", False)
                response_data.extend(response.get(metadatatype.str, []))
                if next_page:
                    parsed_url = urllib3.util.parse_url(next_page)
                    query_params = parse_qs(parsed_url.query)
                    # Retain original params and update only pagination related params
                    params = {
                        **params,
                        **{
                            k: v[0]
                            for k, v in query_params.items()
                            if k in ["limit", "skip", "tenant", "detailLevel"]
                        },
                    }
            except Exception as e:
                logger.exception(f"Failed to fetch devices: {e}. Params: {params}")
                return []
        logger.info(f"Total devices fetched: {len(response_data)}")
        return response_data

    def get_networks(
        self, net_status: str = "active"
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """
        Retrieve a list of networks.

        Args:
            net_status (str): The status of networks to retrieve. Defaults to "active".

        Returns:
            Tuple[List[Dict[str, Any]], Optional[str]]:
                - List of networks (dictionaries) retrieved from the API.
                - Optional error message if an exception occurs.
        """
        params = {}
        networks: List[Dict[str, Any]] = []
        exception_message: Optional[str] = None

        if configuration.ENVIRONMENT == "production":
            params["net_status"] = net_status

        try:
            response = self._request("users/networks", params)
            networks = response.get("networks", [])
        except Exception as e:
            exception_message = f"Failed to fetch networks: {e}"
            logger.exception(exception_message)

        return networks, exception_message

    def __get_device_maintenance_activity(
        self, device: Dict[str, Any]
    ) -> Optional[str]:
        """
        Retrieve the latest maintenance or deployment activity date for a specific device.

        Args:
            device (Dict[str, Any]): A dictionary representing the device, which includes its latest activities by type.

        Returns:
            Optional[str]: The date of the latest maintenance or deployment activity as a string, or None if no activities are found.

        Notes:
            - The method first checks for maintenance activities. If none are found, it falls back to deployment activities.
            - If no activities are available, the method returns None.
        """
        try:
            activities = device.get("latest_maintenance_activity", {}).get("date")
            if not activities:
                activities = device.get("latest_deployment_activity", {}).get("date")
            return activities if activities else None
        except Exception as e:
            logger.exception(f"Failed to fetch maintenance activities: {e}")
            return None

    def get_thingspeak_read_keys(self, devices: pd.DataFrame) -> Dict[int, str]:
        """
        Retrieve read keys from the AirQo API given a list of devices.

        Args:
            devices (pd.DataFrame): A pandas DataFrame of devices read keys and device numbers.

        Returns:
            Dict[int, str]: A dictionary containing device decrypted keys. The dictionary has the structure {device_number: decrypted_key}.
            There is another version of this method that returns a generator. get_thingspeak_read_keys_generator`
        """
        body: List = []
        decrypted_keys: List[Dict[str, str]] = []
        for _, row in devices.iterrows():
            if pd.notna(row["readKey"]) and pd.notna(row["device_number"]):
                body.append(
                    {
                        "encrypted_key": row["readKey"],
                        "device_number": row["device_number"],
                    }
                )
        try:
            response = self._request("devices/decrypt/bulk", body=body, method="post")
            if response:
                decrypted_keys = response.get("decrypted_keys", [])
                return {
                    int(entry["device_number"]): Utils.encrypt_key(
                        entry["decrypted_key"]
                    )
                    for entry in decrypted_keys
                }
        except Exception as e:
            logger.exception(f"An error occurred while fetching device keys: {e}")
        return None

    def get_thingspeak_read_keys_generator(
        self, devices: pd.DataFrame
    ) -> Generator[Tuple[int, str], None, None]:
        """
        Retrieve read keys from the AirQo API given a list of devices.

        Args:
            devices (pd.DataFrame): A pandas DataFrame of devices read keys and device numbers.

        Returns:
            Generator[Tuple[int, str], None, None]]: A generator yielding (device_number, decrypted_key) when `return_type='yield'`.
        """
        body: List = []
        decrypted_keys: List[Dict[str, str]] = []
        for _, row in devices.iterrows():
            if pd.notna(row["readKey"]) and pd.notna(row["device_number"]):
                body.append(
                    {
                        "encrypted_key": row["readKey"],
                        "device_number": row["device_number"],
                    }
                )
        response = self._request("devices/decrypt/bulk", body=body, method="post")
        if response:
            decrypted_keys = response.get("decrypted_keys", [])
            for entry in decrypted_keys:
                device_number = int(entry["device_number"])
                decrypted_key = entry["decrypted_key"]
                yield device_number, decrypted_key

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
        response = self._request(endpoint=endpoint, params=params, method="get")

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
        response = self._request(
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
                response = self._request(
                    endpoint=f"meta-data/{endpoint}",
                    params={"latitude": latitude, "longitude": longitude},
                    method="get",
                )

                meta_data[key] = float(response["data"])
            except Exception as e:
                logger.exception(f"Failed to fetch location meta data: {e}")

        return meta_data

    def refresh_airqloud(self, airqloud_id: str) -> None:
        """
        Triggers a refresh for a specific AirQloud.

        Args:
            airqloud_id (str): The unique identifier of the AirQloud to be refreshed.

        Raises:
            Exception: Logs an exception if the request fails.

        This function sends a PUT request to refresh the specified AirQloud using the provided ID.
        The request includes query parameters that specify the device network and AirQloud ID.
        """
        # TODO Update doc string.
        query_params = {"network": DeviceNetwork.AIRQO.str, "id": airqloud_id}

        try:
            response = self._request(
                endpoint="devices/airqlouds/refresh", params=query_params, method="put"
            )
            logger.info(f"The request status is: {response.status}")
        except Exception:
            logger.exception("Failed to refresh the airqloud.")

    def refresh_grid(self, grid_id: str) -> None:
        """
        Refreshes a specific grid by triggering an update request.

        Args:
            grid_id (str): The unique identifier of the grid to be refreshed.

        Raises:
            Exception: Logs an exception if the request fails.

        This function sends a PUT request to refresh the specified grid based on the provided grid ID.
        The request includes query parameters that specify the device network.
        """
        query_params = {"network": DeviceNetwork.AIRQO.str}

        try:
            response = self._request(
                endpoint=f"devices/grids/refresh/{grid_id}",
                params=query_params,
                method="put",
            )
            logger.info(f"The request status is: {response.status}")
        except Exception:
            logger.exception("Failed to refresh the grid.")

    def get_airqlouds(self, network: DeviceNetwork = None) -> List[Dict[str, Any]]:
        """
        Retrieve airqlouds given network. An airqloud is a logical group of devices or sites. It can be a grid or a cohort.

        Args:
            network (DeviceNetwork, optional): An Enum that represents grid/cohort ownership. Defaults to None if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the airqloud details.
            [
                {
                    "id": str,
                    "name": str,
                    "network": str, #Can be null/None
                    "sites": List[str] #List of site ids.
                }
            ]
        """
        query_params: Dict = {"network": DeviceNetwork.AIRQO.str}

        if network:
            query_params["network"] = network
        response = self._request("devices/airqlouds/dashboard", query_params)

        return [
            {
                "id": airqloud.get("_id", None),
                "name": airqloud.get("name", None),
                "network": airqloud.get("network"),
                "sites": [site["_id"] for site in airqloud.get("sites", [])],
            }
            for airqloud in response.get("airqlouds", [])
        ]

    def get_favorites(self, user_id: str) -> List:
        """
        Retrieves the list of favorite places for a user and enriches each with PM (Particulate Matter) measurement values.

        Args:
            user_id (str): The unique identifier of the user whose favorites are to be retrieved.

        Returns:
            List[dict]: A list of dictionaries, each representing a favorite place with the following keys:
                - "place_id" (str): The unique identifier of the place.
                - "name" (str): The name of the place.
                - "location" (dict): The geographical details of the place.
                - "pm_value" (float or None): The PM measurement value for the place, or None if unavailable.

        Notes:
            - If no favorites exist for the given user ID, an empty list is returned.
            - The method fetches PM values for each favorite using the `get_site_measurement` method.
            - Ensure that the `DeviceNetwork.AIRQO.str` is correctly set in the query parameters.
        """
        query_params = {"network": DeviceNetwork.AIRQO.str}
        response = self._request(f"users/favorites/users/{user_id}", query_params)
        favorites_with_pm = []
        for favorite in response.get("favorites", []):
            place_id = favorite.get("place_id")
            pm_value = self.get_site_measurement(place_id)
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
        """
        Retrieves the location history for a user and enriches each location with PM (Particulate Matter) measurement values.

        Args:
            user_id (str): The unique identifier of the user whose location history is to be retrieved.

        Returns:
            List[dict]: A list of dictionaries, each representing a location in the user's history with the following keys:
                - "placeId" (str): The unique identifier of the place.
                - "name" (str): The name of the location.
                - "location" (dict): The geographical details of the location.
                - "pm_value" (float or None): The PM measurement value for the location, or None if unavailable.

        Notes:
            - If no location history exists for the given user ID, an empty list is returned.
            - The method fetches PM values for each location using the `get_site_measurement` method.
            - Ensure that the `DeviceNetwork.AIRQO.str` is correctly set in the query parameters.
        """
        query_params = {"network": DeviceNetwork.AIRQO.str}
        response = self._request(f"users/locationHistory/users/{user_id}", query_params)
        locations_with_measurements = []
        for location in response.get("location_histories", []):
            place_id = location.get("place_id")
            pm_value = self.get_site_measurement(place_id)
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
        """
        Retrieves the search history for a given user and enriches it with PM (Particulate Matter)
        measurement values for each location in the history.

        Args:
            user_id (str): The unique identifier of the user whose search history is to be retrieved.

        Returns:
            List[dict]: A list of dictionaries, each representing a location in the user's search history
            with the following keys:
                - "placeId" (str): The unique identifier of the place.
                - "name" (str): The name of the location.
                - "location" (dict): The geographical details of the location.
                - "pm_value" (float or None): The PM measurement value for the location, or None if unavailable.

        Notes:
            - If no search history exists for the given user ID, an empty list is returned.
            - The method fetches PM values for each location using the `get_site_measurement` method.
            - Ensure that the `DeviceNetwork.AIRQO.str` is correctly set in the query parameters.
        """
        # TODO Check if this is working. Currently returns {"success":true,"message":"no Search Histories exist","search_histories":[]} for all ids.
        query_params = {"network": DeviceNetwork.AIRQO.str}

        response = self._request(f"users/searchHistory/users/{user_id}", query_params)

        search_histories_with_measurements = []
        for location in response.get("search_histories", []):
            place_id = location.get("place_id")
            pm_value = self.get_site_measurement(place_id)
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
            query_params = {"network": DeviceNetwork.AIRQO.str, "site_id": site_id}

            response = self._request("devices/measurements", query_params)
            # TODO Is there a cleaner way of doing this? End point returns more data than returned to the user. WHY?
            measurement = response["measurements"][0]["pm2_5"]["value"]
            return measurement
        except Exception:
            logger.exception()
            return None

    def get_grids(
        self, network: Optional[DeviceNetwork] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve grids given a network. A grid is a group of sites which are 'usually' in the same geographical boundary.

        Args:
            network(DeviceNetwork, optional): An Enum that represents grid/cohort ownership. Defaults to None if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the grid details.
            [
                {
                    "id": str,
                    "name": str,
                    "network": str,
                    "sites": List[str]
                },
            ]
        """
        query_params: Dict = {"network": DeviceNetwork.AIRQO.str}

        if network:
            query_params["network"] = network
        response = self._request("devices/grids/summary", query_params)

        return [
            {
                "id": grid.get("_id", None),
                "name": grid.get("name", None),
                "network": "airqo",
                "sites": [site["_id"] for site in grid.get("sites", [])],
            }
            for grid in response.get("grids", [])
        ]

    def get_cohorts(self, network: DeviceNetwork = None) -> List[Dict[str, Any]]:
        """
        Retrieve cohorts given a network. A cohort is a group of devices put together based on various criteria.

        Args:
            network (DeviceNetwork, optional): An Enum that represents grid/cohort ownership. Defaults to `None` if not supplied.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries with the cohort details.
            [
                {
                    "id": str,
                    "name": str,
                    "network": str,
                    "devices": List[str]
                },
            ]
        """
        query_params = {"network": DeviceNetwork.AIRQO.str}

        if network:
            query_params["network"] = network
        response = self._request("devices/cohorts", query_params)

        return [
            {
                "id": cohort.get("_id", None),
                "name": cohort.get("name", None),
                "network": "airqo",
                "devices": [device["_id"] for device in cohort.get("devices", [])],
            }
            for cohort in response.get("cohorts", [])
        ]

    def get_sites(self, network: DeviceNetwork = None) -> List[Dict[str, Any]]:
        """
        Retrieve sites given a network.

        Args:
            network (DeviceNetwork, optional): An Enum that represents site ownership. Defaults to `None` if not supplied.

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
        query_params: Dict[str, Any] = {}

        if network:
            query_params["network"] = network.str

        return [
            {
                **site,
                "approximate_latitude": site.get(
                    "approximate_latitude", site.get("latitude", None)
                ),
                "approximate_longitude": site.get(
                    "approximate_longitude", site.get("longitude", None)
                ),
                "search_name": site.get("search_name", site.get("name", None)),
                "location_name": site.get("location_name", site.get("location", None)),
            }
            for site in self._fetch_metadata(
                "devices/sites", MetaDataType.SITES, query_params
            )
        ]

    def update_sites(self, updated_sites: List[Dict[str, Any]]) -> None:
        """
        Updates site information for a list of sites in the system.

        Args:
            updated_sites (list): A list of dictionaries, where each dictionary contains the details of a site to be updated. Each dictionary must have a "site_id" key.

        Returns:
            None: The function performs the update operations but does not return anything.

        Raises:
            KeyError: If a site dictionary does not contain the 'site_id' key.
        """
        for site_data in updated_sites:
            site = dict(site_data)

            site_id = site.pop("site_id", None)
            if site_id is None:
                raise KeyError("Each site dictionary must contain a 'site_id' key.")
            params = {"network": DeviceNetwork.AIRQO.str, "id": site_id}

            self._request("devices/sites", params, site, "put")

    def get_airnow_data(
        self, start_date_time: str, end_date_time: str
    ) -> List[Dict[str, Any]]:
        """
        Fetches air quality data from the AirNow API within a specified time range.

        Args:
            start_date_time (str): The start date and time in string format.
            end_date_time (str): The end date and time in string format.

        Returns:
            List[Dict[str, Any]]: A list of dictionaries containing air quality data.

        Notes:
            - The function retrieves integration details from the configuration.
            - It formats the date-time inputs to match the API's expected format.
            - The request parameters include spatial and pollutant filters.
            - The API response is fetched using `self._request()`.
        """
        integration = configuration.INTEGRATION_DETAILS.get(
            DeviceNetwork.METONE.str, None
        )
        boundary_box = integration.get("extras", {}).get("boundary_box", "")
        parameters = integration.get("extras", {}).get("parameters", "")
        endpoint = "aq/data"
        params = {
            "startDate": start_date_time,
            "endDate": end_date_time,
            "parameters": parameters,
            "BBOX": boundary_box,
            "format": "application/json",
            "verbose": 1,
            "nowcastonly": 1,
            "includerawconcentrations": 1,
            "dataType": "B",
        }

        params.update(integration.get("auth", None))
        return self._request(endpoint, params, network=DeviceNetwork.METONE)

    def __apply_airqo_auth(
        self, integration: dict, headers: dict, params: dict
    ) -> Tuple[Dict, Dict]:
        """
        Auth handler for DeviceNetwork.AIRQO.
        """
        headers.update(integration.get("auth", {}))
        token = integration.get("secret", {}).get("token")
        if token:
            params["token"] = token
        return headers, params

    def __apply_tahmo_auth(self, integration: dict, headers: dict) -> Tuple[Dict, None]:
        """
        Auth handler for DeviceNetwork.TAHMO.
        """
        api_key = integration.get("auth").get("api_key")
        secret = integration.get("secret").get("secret")

        if api_key and secret:
            headers.update(urllib3.make_headers(basic_auth=f"{api_key}:{secret}"))
        return headers, None

    def __add_auth_headers(
        self,
        network: DeviceNetwork,
        integration: dict,
        headers: dict,
        params: Optional[dict] = None,
    ) -> Tuple[Dict | Any, Any]:
        """
        Updates headers and params based on network-specific authentication requirements.

        Args:
            network (DeviceNetwork): The device network for which to apply auth.
            integration(dict): Integration config containing auth info.
            headers(dict): Request headers to be updated.
            params(dict): Request parameters to be updated.
        """
        if not integration.get("auth"):
            return None, None

        if network == DeviceNetwork.AIRQO:
            return self.__apply_airqo_auth(integration, headers, params)
        elif network == DeviceNetwork.TAHMO:
            return self.__apply_tahmo_auth(integration, headers)

    def get_purpleair_data(
        self,
        start_date_time: str,
        end_date_time: str,
        sensor,
    ) -> dict:
        fields: str = (
            "humidity,humidity_a,humidity_b,temperature,temperature_a,temperature_b,"
        )
        "pressure,pressure_a,pressure_b,pm1.0_atm,pm1.0_atm_a,pm1.0_atm_b,"
        "pm2.5_atm,pm2.5_atm_a,pm2.5_atm_b,pm10.0_atm,pm10.0_atm_a,pm10.0_atm_b,"
        "voc,voc_a,voc_b"
        params = {
            "fields": fields,
            "start_timestamp": start_date_time,
            "end_timestamp": end_date_time,
        }

        response = self._request(
            endpoint=f"/sensors/{sensor}/history",
            params=params,
            network=DeviceNetwork.PURPLEAIR,
        )

        return response if response else {}

    def get_tahmo_data(
        self, start_time: str, end_time: str, stations: List[str]
    ) -> pd.DataFrame:
        """
        Extracts measurement data from the TAHMO API for a list of station codes over a specified time range.
        """
        all_data: List = []
        params = {
            "start": start_time,
            "end": end_time,
        }
        stations = set(stations)
        columns = ["value", "variable", "station", "time"]

        for code in stations:
            try:
                response = self._request(
                    f"/services/measurements/v2/stations/{code}/measurements/controlled",
                    params,
                    network=DeviceNetwork.TAHMO,
                )
                results = response["results"][0].get("series", None)
                if results:
                    values = results[0]["values"]
                    columns = results[0]["columns"]

                    station_measurements = pd.DataFrame(data=values, columns=columns)
                    if not station_measurements.empty:
                        all_data.append(station_measurements)
                else:
                    logger.warning(f"No data returned from stations: {code}")
            except Exception as e:
                logger.exception(
                    f"An exception occurred while retrieving data from station: {code}, Error: {e}"
                )
                continue

        if all_data:
            measurements = pd.concat(all_data, ignore_index=True)
        else:
            measurements = pd.DataFrame(
                columns=["value", "variable", "station", "time"]
            )

        return measurements

    # TODO Make this private after centralizing data ops
    def _request(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = {},
        body: Optional[Dict[str, Any]] = None,
        method: Optional[str] = "get",
        base_url: Optional[str] = None,
        network: Optional[DeviceNetwork] = DeviceNetwork.AIRQO,
    ):
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
        headers: Dict[str, Any] = {}
        params: Dict[str, Any] = params
        integration = configuration.INTEGRATION_DETAILS.get(network.str)

        if not base_url:
            base_url = integration.get("url", "").rstrip("/")

        auth = integration.get("auth", None)

        if auth and network:
            if network == DeviceNetwork.AIRQO:
                headers, params = self.__add_auth_headers(
                    DeviceNetwork.AIRQO, integration, headers, params=params
                )
            elif network == DeviceNetwork.TAHMO:
                headers, _ = self.__add_auth_headers(
                    DeviceNetwork.TAHMO, integration, headers
                )

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

            return Utils.parse_api_response(response, url)

        except urllib3.exceptions.HTTPError as http_err:
            logger.exception(f"Client error: {http_err}")
        except urllib3.exceptions.TimeoutError:
            logger.exception(f"Timeout occurred: {http_err}")
        except Exception as e:
            logger.exception(f"Unexpected error: {e}")

        return None
