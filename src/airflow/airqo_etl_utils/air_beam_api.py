import datetime
import json

import urllib3
from urllib3.util.retry import Retry

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
            }
        request = self.__request(
            endpoint=f"mobile/sessions.json",
            params=params,
        )

        return request

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

        url = f"{self.AIR_BEAM_BASE_URL}{endpoint}"
        retry_strategy = Retry(
            total=5,
            backoff_factor=5,
        )
        
        http = urllib3.PoolManager(retries=retry_strategy)
        
        try:
            response = http.request(
                "GET", 
                url, 
                fields=params,)
            
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


def handle_api_error(api_request):
    try:
        print(api_request.request.url)
        print(api_request.request.body)
    except Exception as ex:
        print(ex)
    finally:
        print(api_request.content)
        print("API request failed with status code %s" % api_request.status_code)
