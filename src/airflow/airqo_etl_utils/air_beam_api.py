import datetime
import json

import pandas as pd
import requests

from .config import configuration
from .utils import Utils


class AirBeamApi:
    def __init__(self):
        self.AIR_BEAM_BASE_URL = Utils.remove_suffix(
            configuration.AIR_BEAM_BASE_URL, suffix="/"
        )

    def get_stream_ids(
        self,
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
        username: str,
        pollutant: str,
    ):
        request = requests.get(
            url=f"{self.AIR_BEAM_BASE_URL}mobile/sessions.json",
            params={
                "q": json.dumps(
                    {
                        "time_from": int(start_date_time.timestamp()),
                        "time_to": int(end_date_time.timestamp()),
                        "tags": "",
                        "usernames": username,
                        "west": 10.581214853439886,
                        "east": 38.08577769782265,
                        "south": -36.799337832603314,
                        "north": -19.260169583742446,
                        "limit": 100,
                        "offset": 0,
                        "sensor_name": f"airbeam3-{pollutant}",
                        "measurement_type": "Particulate Matter",
                        "unit_symbol": "µg/m³",
                    }
                )
            },
        )

        print(request.request.url)

        if request.status_code == 200:
            return request.json()
        else:
            handle_api_error(request)
            return None

    def get_measurements(
        self,
        start_date_time: datetime.datetime,
        end_date_time: datetime.datetime,
        stream_id: int,
    ) -> pd.DataFrame:
        params = {
            "start_time": int(start_date_time.timestamp()) * 1000,
            "end_time": int(end_date_time.timestamp()) * 1000,
            "stream_ids": stream_id,
        }
        return self.__request(
            endpoint=f"measurements.json",
            params=params,
        )

    def __request(self, endpoint, params):
        api_request = requests.get(
            "%s/%s" % (self.AIR_BEAM_BASE_URL, endpoint),
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
