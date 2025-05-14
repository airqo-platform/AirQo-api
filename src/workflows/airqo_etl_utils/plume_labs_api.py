from datetime import datetime
import json

from .config import configuration as Config
from .constants import DeviceNetwork
from .data_api import DataApi

from typing import Optional


class PlumeLabsApi:
    # TODO Seems not to be active at the moment. Needs some reworking.
    def __init__(self):
        self.PLUME_LABS_BASE_URL = Config.PLUME_LABS_BASE_URL
        self.PLUME_LABS_ORGANISATIONS_CRED = Config.PLUME_LABS_ORGANISATIONS_CRED

    def __get_network_credentials(self):
        """
        Loads Plume Labs network credentials from a JSON file.

        The JSON file is expected to contain a dictionary where:
            - Keys are network IDs or organization identifiers.
            - Values are corresponding access tokens or API keys.

        Returns:
            dict: A dictionary mapping network IDs to their access tokens.

        Raises:
            FileNotFoundError: If the credentials file does not exist.
            json.JSONDecodeError: If the file is not valid JSON.
        """
        with open(self.PLUME_LABS_ORGANISATIONS_CRED) as file:
            credentials = json.load(file)
        return credentials

    def __get_network_meta_data(self, network: DeviceNetwork) -> dict:
        """
        Retrieves metadata for a specified device network, including network ID, access token, and a list of sensors associated with the network.

        This method assumes that `__get_network_credentials()` returns a dictionary with a single key-value pair where:
            - the key is the network ID
            - the value is the authentication token

        Args:
            network(DeviceNetwork): The device network for which metadata is requested.

        Returns:
            dict: A dictionary containing the following keys:
                - "id": Network ID.
                - "token": Authentication token for accessing the network.
                - "network": Network name as a string.
                - "sensors": A list of sensors registered under the network.
        """
        data_api = DataApi()
        network = network.str
        credentials = dict(self.__get_network_credentials())
        network_id, token = next(iter(credentials.items()))
        sensors_response = data_api.__request(
            endpoint=f"/organizations/{network_id}/sensors/list",
            params={"token": token},
        )

        return {
            "id": network_id,
            "token": token,
            "network": network,
            "sensors": sensors_response["sensors"],
        }

    def __query_sensor_measures(
        self,
        start_timestamp: int,
        end_timestamp: int,
        sensor_id: str,
        token: str,
        organization_id: str,
        offset: Optional[int] = None,
    ) -> list:
        """
        Recursively queries sensor measurement data from the Plume Labs API within a given time range.

        This function handles pagination by checking the 'more' field in the API response and recursively fetching additional pages using the provided offset.

        Args:
            start_timestamp(int): Start of the time range (Unix timestamp or ISO string, depending on API spec).
            end_timestamp(int): End of the time range (Unix timestamp or ISO string, depending on API spec).
            sensor_id(int): The unique sensor or device identifier.
            token(str): Authorization token for API access.
            organization_id(str): The ID of the organization the device belongs to.
            offset (int, optional): Offset token for paginated API results.

        Returns:
            list: A list of sensor measurement dictionaries.

        Raises:
            KeyError: If expected keys like "measures" or "more" are missing in the response.
            Any exception raised by the DataApi.__request method.
        """
        data_api = DataApi()
        params = {
            "token": token,
            "sensor_id": sensor_id,
            "start_date": start_timestamp,
            "end_date": end_timestamp,
        }
        if offset:
            params["offset"] = offset
        api_response = data_api.__request(
            endpoint=f"/organizations/{organization_id}/sensors/measures",
            params=params,
        )

        sensor_data = api_response["measures"]

        if api_response["more"]:
            sensor_data.extend(
                self.__query_sensor_measures(
                    start_timestamp=start_timestamp,
                    end_timestamp=end_timestamp,
                    device_number=sensor_id,
                    token=token,
                    organization_id=organization_id,
                    offset=api_response["offset"],
                )
            )
        return sensor_data

    def __query_sensor_positions(
        self,
        start_timestamp: int,
        end_timestamp: int,
        sensor_id: str,
        token: str,
        organization_id: str,
        offset: Optional[int] = None,
    ) -> list:
        """
        Recursively fetches positional (GPS) data for a specific sensor from the Plume Labs API within a given time range.

        This method supports pagination and will continue to retrieve results as long as the API indicates more data is available.

        Args:
            start_timestamp(int): Start of the time range for the query (Unix timestamp).
            end_timestamp(int): End of the time range for the query.
            sensor_id(int): Unique identifier of the sensor device.
            token(int): API access token for authentication.
            organization_id(str): ID of the organization owning the sensor.
            offset(str, optional): Offset value for paginated results.

        Returns:
            list: A list of dictionaries, each representing a recorded position of the sensor.

        Raises:
            KeyError: If expected keys such as "positions" or "more" are missing in the API response.
            Any exception raised by the DataApi.__request method.
        """
        data_api = DataApi()
        params = {
            "token": token,
            "sensor_id": sensor_id,
            "start_date": start_timestamp,
            "end_date": end_timestamp,
        }
        if offset:
            params["offset"] = offset
        api_response = data_api.__request(
            endpoint=f"/organizations/{organization_id}/sensors/positions",
            params=params,
        )

        sensor_data = api_response["positions"]

        if api_response["more"]:
            sensor_data.extend(
                self.__query_sensor_positions(
                    start_timestamp=start_timestamp,
                    end_timestamp=end_timestamp,
                    sensor_id=sensor_id,
                    token=token,
                    organization_id=organization_id,
                    offset=api_response["offset"],
                )
            )
        return sensor_data

    def get_sensor_positions(
        self,
        start_date_time: datetime,
        end_date_time: datetime,
        network: DeviceNetwork,
    ) -> list:
        """
        Retrieves GPS position data for all sensors associated with the given device network within a specified time range.

        This method uses internal metadata and helper functions to query the Plume Labs API for position data of each sensor, and aggregates the results.

        Args:
            start_date_time(datetime): Start of the time range for the query.
            end_date_time(datetime): End of the time range for the query.
            network(DeviceNetwork): Enum indicating the sensor network (e.g., AIRBEAM, PLUME).

        Returns:
            list: A list of dictionaries, each containing the sensor's device number and a list of its corresponding position records.
        """
        network_meta_data = self.__get_network_meta_data(network=network)

        token = network_meta_data.get("token")
        organization_id = network_meta_data.get("id")

        sensors_positions = []
        for sensor in network_meta_data["sensors"]:
            device_number = sensor["id"]
            sensor_positions = self.__query_sensor_positions(
                token=token,
                sensor_id=device_number,
                organization_id=organization_id,
                start_timestamp=int(start_date_time.timestamp()),
                end_timestamp=int(end_date_time.timestamp()),
            )

            if sensor_positions:
                sensors_positions.append(
                    {
                        "device_number": device_number,
                        "positions": sensor_positions,
                    }
                )

        return sensors_positions

    def get_sensor_measures(
        self,
        start_date_time: datetime,
        end_date_time: datetime,
        network: DeviceNetwork,
    ) -> list:
        """
        Retrieves measurement data for all sensors in the specified device network within a given time range.

        This function fetches authentication details for the network, iterates through all registered sensors, and queries measurement data from the external API.

        Args:
            start_date_time(datetime): Start of the measurement time range.
            end_date_time(datetime): End of the measurement time range.
            network(DeviceNetwork): Enum representing the device network to query.

        Returns:
            list: A list of dictionaries containing device measurement data. Each dictionary includes the device number, device ID, and a list of measurements.
        """
        network_meta_data = self.__get_network_meta_data(network=network)

        sensors_data = []
        token = network_meta_data.get("token")
        organization_id = network_meta_data.get("id")

        for sensor in network_meta_data["sensors"]:
            device_number = sensor["id"]
            sensor_data = self.__query_sensor_measures(
                token=token,
                device_number=device_number,
                organization_id=organization_id,
                start_timestamp=int(start_date_time.timestamp()),
                end_timestamp=int(end_date_time.timestamp()),
            )

            if sensor_data:
                sensors_data.append(
                    {
                        "device_number": device_number,
                        "device_id": sensor["device_id"],
                        "data": sensor_data,
                    }
                )

        return sensors_data
