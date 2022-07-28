import pandas as pd
import requests

from config import configuration
from geopy import distance


class TahmoApi:
    def __init__(self):
        self.BASE_URL = configuration.TAHMO_BASE_URL
        self.API_MAX_PERIOD = configuration.TAHMO_API_MAX_PERIOD
        self.API_KEY = configuration.TAHMO_API_KEY
        self.API_SECRET = configuration.TAHMO_API_SECRET

    def get_stations(self):
        response = self.__request("services/assets/v2/stations", {"sort": "code"})
        stations = {}
        if "data" in response and isinstance(response["data"], list):
            for element in response["data"]:
                stations[element["code"]] = element
        return stations

    def get_closest_station(self, latitude, longitude, all_stations=None):

        weather_stations_with_distances_from_specified_coordinates = {}
        if not all_stations:
            all_stations = self.get_stations()
        specified_coordinates = (latitude, longitude)

        for key, station in all_stations.items():
            weather_station_coordinates = (
                station["location"]["latitude"],
                station["location"]["longitude"],
            )
            distance_between_coordinates = distance.distance(
                specified_coordinates, weather_station_coordinates
            ).km
            weather_stations_with_distances_from_specified_coordinates[
                station["code"]
            ] = distance_between_coordinates

        weather_stations_with_min_distance = min(
            weather_stations_with_distances_from_specified_coordinates.keys(),
            key=(
                lambda k: weather_stations_with_distances_from_specified_coordinates[k]
            ),
        )
        selected_station = all_stations.get(weather_stations_with_min_distance)

        return selected_station

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

                if "results" in response and isinstance(response["results"], list):
                    results = response["results"]
                    values = results[0]["series"][0]["values"]
                    columns = results[0]["series"][0]["columns"]

                    station_measurements = pd.DataFrame(data=values, columns=columns)

                    measurements = measurements.append(
                        station_measurements[columns], ignore_index=True
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
            return []
