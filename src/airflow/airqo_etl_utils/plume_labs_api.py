import datetime
import json

import requests

from airqo_etl_utils.config import configuration


class PlumeLabsApi:
    def __init__(self):
        self.PLUME_LABS_BASE_URL = configuration.PLUME_LABS_BASE_URL
        self.PLUME_LABS_ORGANISATIONS_CRED = configuration.PLUME_LABS_ORGANISATIONS_CRED

    def __get_organizations_credentials_metadata(self):
        with open(self.PLUME_LABS_ORGANISATIONS_CRED) as file:
            credentials = json.load(file)
        return credentials

    def __get_organizations_meta_data(self) -> list:
        organizations_details = []
        organizations = dict(self.__get_organizations_credentials_metadata())
        for org in organizations.keys():
            sensors = self.__request(
                endpoint=f"/organizations/{org}/sensors/list",
                params={
                    "token": organizations.get(org),
                },
            )
            organizations_details.append(
                {
                    "id": org,
                    "token": organizations.get(org),
                    "sensors": sensors["sensors"],
                }
            )
        return organizations_details

    def __query_sensor_measures(
        self,
        start_timestamp,
        end_timestamp,
        sensor_id,
        token,
        organization,
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
            endpoint=f"/organizations/{organization}/sensors/measures",
            params=params,
        )

        sensor_data = api_response["measures"]

        if api_response["more"]:
            sensor_data.extend(
                self.__query_sensor_measures(
                    start_timestamp=start_timestamp,
                    end_timestamp=end_timestamp,
                    sensor_id=sensor_id,
                    token=token,
                    organization=organization,
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
        organization,
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
            endpoint=f"/organizations/{organization}/sensors/positions",
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
                    organization=organization,
                    offset=api_response["offset"],
                )
            )
        return sensor_data

    def get_sensor_positions(
        self,
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
    ) -> list:
        organizations_meta_data = self.__get_organizations_meta_data()
        organizations_data = []
        for organization in organizations_meta_data:
            sensors_positions = []
            for sensor in organization["sensors"]:
                sensor_id = sensor["id"]
                sensor_positions = self.__query_sensor_positions(
                    token=organization["token"],
                    sensor_id=sensor_id,
                    organization=organization["id"],
                    start_timestamp=int(start_date_time.timestamp()),
                    end_timestamp=int(end_date_time.timestamp()),
                )

                if sensor_positions:
                    sensors_positions.append(
                        {
                            "device": sensor_id,
                            "device_positions": sensor_positions,
                        }
                    )

            if sensors_positions:
                organizations_data.append(
                    {
                        "organization": organization["id"],
                        "positions": sensors_positions,
                    }
                )

        return organizations_data

    def get_sensor_measures(
        self,
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
    ) -> list:
        organizations_meta_data = self.__get_organizations_meta_data()
        organizations_data = []
        for organization in organizations_meta_data:
            sensors_data = []
            for sensor in organization["sensors"]:
                sensor_id = sensor["id"]
                sensor_data = self.__query_sensor_measures(
                    token=organization["token"],
                    sensor_id=sensor_id,
                    organization=organization["id"],
                    start_timestamp=int(start_date_time.timestamp()),
                    end_timestamp=int(end_date_time.timestamp()),
                )

                if sensor_data:
                    sensors_data.append(
                        {
                            "device": sensor_id,
                            "device_data": sensor_data,
                        }
                    )

            if sensors_data:
                organizations_data.append(
                    {
                        "organization": organization["id"],
                        "measures": sensors_data,
                    }
                )

        return organizations_data

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
