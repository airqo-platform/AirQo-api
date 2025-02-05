import datetime
import json

import urllib3
from urllib3.util.retry import Retry

from .config import configuration as Config
from .constants import DeviceNetwork
from .utils import Utils


class PlumeLabsApi:
    # TODO Seems not to be active at the moment. Needs some reworking.
    def __init__(self):
        self.PLUME_LABS_BASE_URL = Config.PLUME_LABS_BASE_URL
        self.PLUME_LABS_ORGANISATIONS_CRED = Config.PLUME_LABS_ORGANISATIONS_CRED

    def __get_network_credentials(self):
        with open(self.PLUME_LABS_ORGANISATIONS_CRED) as file:
            credentials = json.load(file)
        return credentials

    def __get_network_meta_data(self, network: DeviceNetwork) -> dict:
        network = network.str
        network = dict(self.__get_network_credentials())
        network_id, token = next(iter(network.items()))
        sensors = self.__request(
            endpoint=f"/organizations/{network_id}/sensors/list",
            params={
                "token": token,
            },
        )

        return {
            "id": network_id,
            "token": token,
            "network": network,
            "sensors": sensors["sensors"],
        }

    def __query_sensor_measures(
        self,
        start_timestamp,
        end_timestamp,
        device_number,
        token,
        organization_id,
        offset=None,
    ) -> list:
        params = {
            "token": token,
            "sensor_id": device_number,
            "start_date": start_timestamp,
            "end_date": end_timestamp,
        }
        if offset:
            params["offset"] = offset
        api_response = self.__request(
            endpoint=f"/organizations/{organization_id}/sensors/measures",
            params=params,
        )

        sensor_data = api_response["measures"]

        if api_response["more"]:
            sensor_data.extend(
                self.__query_sensor_measures(
                    start_timestamp=start_timestamp,
                    end_timestamp=end_timestamp,
                    device_number=device_number,
                    token=token,
                    organization_id=organization_id,
                    offset=api_response["offset"],
                )
            )
        return sensor_data

    def __query_sensor_positions(
        self,
        start_timestamp,
        end_timestamp,
        sensor_id,
        token,
        organization_id,
        offset=None,
    ) -> list:
        params = {
            "token": token,
            "sensor_id": sensor_id,
            "start_date": start_timestamp,
            "end_date": end_timestamp,
        }
        if offset:
            params["offset"] = offset
        api_response = self.__request(
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
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
        network: DeviceNetwork,
    ) -> list:
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
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
        network: DeviceNetwork,
    ) -> list:
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

    def __request(self, endpoint, params):
        url = f"{self.PLUME_LABS_BASE_URL}{endpoint}"
        retry_strategy = Retry(
            total=5,
            backoff_factor=5,
        )

        http = urllib3.PoolManager(retries=retry_strategy)

        try:
            response = http.request(
                "GET",
                url,
                fields=params,
            )

            response_data = response.data
            print(response._request_url)

            if response.status == 200:
                return json.loads(response_data)
            else:
                Utils.handle_api_error(response)
                return None

        except urllib3.exceptions.HTTPError as e:
            print(f"HTTPError: {e}")
            return None
