import json

import urllib3
from urllib3.util.retry import Retry

from .config import configuration
from .utils import Utils


class PurpleAirApi:
    def __init__(self):
        self.PURPLE_AIR_BASE_URL = configuration.PURPLE_AIR_BASE_URL
        self.PURPLE_AIR_API_KEY = configuration.PURPLE_AIR_API_KEY

    def get_data(
        self,
        start_date_time,
        end_date_time,
        sensor,
        fields="humidity,humidity_a,humidity_b,temperature,temperature_a,temperature_b,"
        "pressure,pressure_a,pressure_b,pm1.0_atm,pm1.0_atm_a,pm1.0_atm_b,"
        "pm2.5_atm,pm2.5_atm_a,pm2.5_atm_b,pm10.0_atm,pm10.0_atm_a,pm10.0_atm_b,"
        "voc,voc_a,voc_b",
    ) -> dict:
        params = {
            "fields": fields,
            "start_timestamp": start_date_time,
            "end_timestamp": end_date_time,
        }

        response = self.__request(endpoint=f"/sensors/{sensor}/history", params=params)
        return response if response else {}

    def __request(self, endpoint, params):
        url = f"{self.PURPLE_AIR_BASE_URL}{endpoint}"
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
                headers={"x-api-key": self.PURPLE_AIR_API_KEY},
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
