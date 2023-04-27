import datetime
import json

import requests

from .config import configuration
from .constants import Tenant
from .utils import Utils


class PlumeLabsApi:
    def __init__(self):
        self.PLUME_LABS_BASE_URL = configuration.PLUME_LABS_BASE_URL
        self.PLUME_LABS_ORGANISATIONS_CRED = configuration.PLUME_LABS_ORGANISATIONS_CRED

    def __get_tenants_credentials(self):
        with open(self.PLUME_LABS_ORGANISATIONS_CRED) as file:
            credentials = json.load(file)
        return credentials

    def __get_tenant_meta_data(self, tenant: Tenant) -> dict:
        tenant = str(tenant)
        tenants = dict(self.__get_tenants_credentials())
        tenant_credentials = tenants.get(tenant, {})
        sensors = self.__request(
            endpoint=f"/organizations/{tenant_credentials.get('id')}/sensors/list",
            params={
                "token": tenant_credentials.get("token"),
            },
        )

        return {
            "id": tenant_credentials.get("id"),
            "token": tenant_credentials.get("token"),
            "tenant": tenant,
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
        tenant: Tenant,
    ) -> list:
        tenant_meta_data = self.__get_tenant_meta_data(tenant=tenant)

        token = tenant_meta_data.get("token")
        organization_id = tenant_meta_data.get("id")

        sensors_positions = []
        for sensor in tenant_meta_data["sensors"]:
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
        tenant: Tenant,
    ) -> list:
        tenant_meta_data = self.__get_tenant_meta_data(tenant=tenant)

        sensors_data = []
        token = tenant_meta_data.get("token")
        organization_id = tenant_meta_data.get("id")

        for sensor in tenant_meta_data["sensors"]:
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
        api_request = requests.get(
            "%s%s" % (self.PLUME_LABS_BASE_URL, endpoint),
            params=params,
            verify=False,
        )

        print(api_request.request.url)

        if api_request.status_code == 200:
            return api_request.json()
        else:
            Utils.handle_api_error(api_request)
            return None
