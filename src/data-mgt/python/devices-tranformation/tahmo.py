import os

import requests
from geopy import distance

from utils import handle_api_error


class TahmoApi:

    def __init__(self):
        self.TAHMO_BASE_URL = os.getenv("TAHMO_API_BASE_URL")
        self.API_MAX_PERIOD = os.getenv("TAHMO_API_MAX_PERIOD")
        self.TAHMO_API_KEY = os.getenv("TAHMO_API_CREDENTIALS_USERNAME")
        self.TAHMO_API_SECRET = os.getenv("TAHMO_API_CREDENTIALS_PASSWORD")

    def get_closest_station(self, latitude, longitude):

        weather_stations_with_distances_from_specified_coordinates = {}
        all_stations = self.get_stations()
        specified_coordinates = (latitude, longitude)

        for key, station in all_stations.items():
            # print(station)
            weather_station_coordinates = (station['location']['latitude'], station['location']['longitude'])
            # print(weather_station_coordinates)
            distance_between_coordinates = distance.distance(specified_coordinates, weather_station_coordinates).km
            weather_stations_with_distances_from_specified_coordinates[station["code"]] = distance_between_coordinates

        # print(weather_stations_with_distances_from_specified_coordinates)
        weather_stations_with_min_distance = min(weather_stations_with_distances_from_specified_coordinates.keys(), key=(
            lambda k: weather_stations_with_distances_from_specified_coordinates[k]))
        selected_station = all_stations.get(weather_stations_with_min_distance)
        # print(selected_station)

        # return weather_stations_with_min_distance, selected_station

        return selected_station

    def get_stations(self):
        response = self.__request('services/assets/v2/stations', {'sort': 'code'})
        stations = {}
        if 'data' in response and isinstance(response['data'], list):
            for element in response['data']:
                stations[element['code']] = element
        return stations

    def __request(self, endpoint, params):
        print('API request: %s' % endpoint)
        api_request = requests.get(
            '%s/%s' % (self.TAHMO_BASE_URL, endpoint),
            params=params,
            auth=requests.auth.HTTPBasicAuth(
                self.TAHMO_API_KEY,
                self.TAHMO_API_SECRET
            )
        )

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return handle_api_error(api_request)
