import traceback

import requests

from config import configuration


class TahmoApi:

    def __init__(self):
        self.BASE_URL = configuration.TAHMO_BASE_URL
        self.API_MAX_PERIOD = configuration.TAHMO_API_MAX_PERIOD
        self.API_KEY = configuration.TAHMO_API_KEY
        self.API_SECRET = configuration.TAHMO_API_SECRET

    def get_stations(self):
        response = self.__request('services/assets/v2/stations', {'sort': 'code'})
        stations = {}
        if 'data' in response and isinstance(response['data'], list):
            for element in response['data']:
                stations[element['code']] = element
        return stations

    def get_measurements(self, start_time, end_time, station_codes=None):

        if station_codes is None:
            station_codes = []

        measurements = []
        params = {
            'start': start_time,
            'end': end_time,
        }
        columns = []
        stations = set(station_codes)

        for code in stations:

            try:
                response = self.__request(f'services/measurements/v2/stations/{code}/measurements/controlled',
                                          params)

                if 'results' in response and isinstance(response["results"], list):
                    results = response["results"]
                    values = results[0]["series"][0]["values"]
                    if len(columns) == 0:
                        columns = results[0]["series"][0]["columns"]

                    measurements.extend(values)
            except Exception as ex:
                traceback.print_exc()
                print(ex)
                continue

        return columns, measurements

    def __request(self, endpoint, params):
        api_request = requests.get(
            '%s/%s' % (self.BASE_URL, endpoint),
            params=params,
            auth=requests.auth.HTTPBasicAuth(
                self.API_KEY,
                self.API_SECRET
            )
        )

        print('Tahmo API request: %s' % api_request.request.url)

        if api_request.status_code == 200:
            return api_request.json()
        else:
            return []
