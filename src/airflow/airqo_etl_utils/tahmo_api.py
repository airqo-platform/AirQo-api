import pandas as pd
import requests

from .config import configuration
from .utils import Utils


class TahmoApi:
    def __init__(self):
        self.BASE_URL = Utils.remove_suffix(configuration.TAHMO_BASE_URL, suffix="/")
        self.API_MAX_PERIOD = configuration.TAHMO_API_MAX_PERIOD
        self.API_KEY = configuration.TAHMO_API_KEY
        self.API_SECRET = configuration.TAHMO_API_SECRET

    def get_measurements(self, start_time, end_time, station_codes=None):
        if station_codes is None:
            station_codes = []

        params = {
            "start": start_time,
            "end": end_time,
        }

        stations = set(station_codes)
        columns = ["value", "variable", "station", "time"]
        measurements = pd.DataFrame(columns=columns)

        for code in stations:
            try:
                response = self.__request(
                    f"services/measurements/v2/stations/{code}/measurements/controlled",
                    params,
                )

                if response and "results" in response:
                    results = response["results"]
                    values = results[0]["series"][0]["values"]
                    columns = results[0]["series"][0]["columns"]

                    station_measurements = pd.DataFrame(data=values, columns=columns)

                    measurements = pd.concat(
                        [measurements, station_measurements[columns]], ignore_index=True
                    )

            except Exception as ex:
                print(ex)
                continue

        return measurements.to_dict(orient="records")

    def __request(self, endpoint, params):
        api_request = requests.get(
            "%s/%s" % (self.BASE_URL, endpoint),
            params=params,
            auth=requests.auth.HTTPBasicAuth(self.API_KEY, self.API_SECRET),
        )

        print("Tahmo API request: %s" % api_request.request.url)

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return None
