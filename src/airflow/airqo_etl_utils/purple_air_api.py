import requests

from .config import configuration


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
        api_request = requests.get(
            "%s%s" % (self.PURPLE_AIR_BASE_URL, endpoint),
            params=params,
            verify=False,
            headers={"x-api-key": self.PURPLE_AIR_API_KEY},
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
