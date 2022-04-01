# Module dependancies
## code base adopted from tahmo demo repo
import time
import dateutil.parser
import datetime
import gc

import requests
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import os

load_dotenv()

# Module Constants
API_BASE_URL = os.getenv("TAHMO_API_BASE_URL")
API_MAX_PERIOD = os.getenv("TAHMO_API_MAX_PERIOD")

class apiWrapper(object):
    apiKey = ''
    apiSecret = ''

    def setCredentials(self, key, secret):
        self.apiKey = key
        self.apiSecret = secret

    def getMeasurements(self, station, startDate=None, endDate=None, variables=None, dataset='controlled'):
        #print('Get measurements', station, startDate, endDate, variables)
        endpoint = 'services/measurements/v2/stations/%s/measurements/%s' % (station, dataset)

        dateSplit = self.__splitDateRange(startDate, endDate)
        series = []
        seriesHolder = {}

        for index, row in dateSplit.iterrows():
            params = {'start': row['start'].strftime('%Y-%m-%dT%H:%M:%SZ'), 'end': row['end'].strftime('%Y-%m-%dT%H:%M:%SZ')}
            if variables and isinstance(variables, list) and len(variables) == 1:
                params['variable'] = variables[0]
            response = self.__request(endpoint, params)
            if 'results' in response and len(response['results']) >= 1 and 'series' in response['results'][0] and len(
                response['results'][0]['series']) >= 1 and 'values' in response['results'][0]['series'][0]:

                for result in response['results']:
                    if 'series' in result and len(result['series']) >= 1 and 'values' in result['series'][0]:
                        for serie in result['series']:

                            columns = serie['columns']
                            observations = serie['values']

                            time_index = columns.index('time')
                            quality_index = columns.index('quality')
                            variable_index = columns.index('variable')
                            sensor_index = columns.index('sensor')
                            value_index = columns.index('value')

                            # Create list of unique variables within the retrieved observations.
                            if not isinstance(variables, list) or len(variables) == 0:
                                shortcodes = list(set(list(map(lambda x: x[variable_index], observations))))
                            else:
                                shortcodes = variables

                            for shortcode in shortcodes:

                                # Create list of timeserie elements for this variable with predefined format [time, value, sensor, quality].
                                timeserie = list(map(lambda x: [x[time_index], x[value_index] if x[quality_index] == 1 else np.nan, x[sensor_index], x[quality_index]],
                                                     list(filter(lambda x: x[variable_index] == shortcode, observations))))

                                if shortcode in seriesHolder:
                                    seriesHolder[shortcode] = seriesHolder[shortcode] + timeserie
                                else:
                                    seriesHolder[shortcode] = timeserie

                                # Clean up scope.
                                del timeserie

                            # Clean up scope.
                            del columns
                            del observations
                            del shortcodes

                # Clean up scope and free memory.
                del response
                gc.collect()

        for shortcode in seriesHolder:
            # Check if there are duplicate entries in this timeseries (multiple sensors for same variable).
            timestamps = list(map(lambda x: x[0], seriesHolder[shortcode]))

            if len(timestamps) > len(set(timestamps)):
                # Split observations per sensor.
                print('Split observations for %s per sensor' % shortcode)
                sensors = list(set(list(map(lambda x: x[2], seriesHolder[shortcode]))))
                for sensor in sensors:
                    sensorSerie = list(filter(lambda x: x[2] == sensor, seriesHolder[shortcode]))
                    timestamps = list(map(lambda x: pd.Timestamp(x[0]), sensorSerie))
                    values = list(map(lambda x: x[1], sensorSerie))
                    serie = pd.Series(values, index=pd.DatetimeIndex(timestamps))
                    series.append(serie.to_frame('%s_%s' % (shortcode, sensor)))

                    # Clean up scope.
                    del sensorSerie
                    del timestamps
                    del values
                    del serie
            else:
                values = list(map(lambda x: x[1], seriesHolder[shortcode]))
                serie = pd.Series(values, index=pd.DatetimeIndex(timestamps))

                if len(values) > 0:
                    serie = pd.Series(values, index=pd.DatetimeIndex(timestamps))
                    series.append(serie.to_frame(shortcode))

                # Clean up scope.
                del values
                del serie

            # Clean up memory.
            gc.collect()

        # Clean up.
        del seriesHolder
        gc.collect()

        # Merge all series together.
        if len(series) > 0:
            df = pd.concat(series, axis=1, sort=True)
        else:
            df = pd.DataFrame()

        # Clean up memory.
        del series
        gc.collect()

        return df

    def getRawMeasurements(self, station, startDate=None, endDate=None, variables=None):
        return self.getMeasurements(station, startDate=startDate, endDate=endDate, variables=variables, dataset='raw')

    def getStations(self):
        response = self.__request('services/assets/v2/stations', {'sort': 'code'})
        stations = {}
        if 'data' in response and isinstance(response['data'], list):
            for element in response['data']:
                #print(element)
                stations[element['code']] = element
        return stations

    def getVariables(self):
        response = self.__request('services/assets/v2/variables', {})
        variables = {}
        if 'data' in response and isinstance(response['data'], list):
            for element in response['data']:
                variables[element['variable']['shortcode']] = element['variable']
        return variables

    def __request(self, endpoint, params):
        print('API request: %s' % endpoint)
        apiRequest = requests.get(
            '%s/%s' % (API_BASE_URL, endpoint),
            params=params,
            auth=requests.auth.HTTPBasicAuth(
                self.apiKey,
                self.apiSecret
            )
        )

        if apiRequest.status_code == 200:
            return apiRequest.json()
        else:
            return self.__handleApiError(apiRequest)

    # Split date range into intervals of 365 days.
    def __splitDateRange(self, inputStartDate, inputEndDate):
        try:
            startDate = dateutil.parser.parse(inputStartDate)
            endDate = dateutil.parser.parse(inputEndDate)
        except ValueError:
            raise ValueError("Invalid data parameters")

        # Split date range into intervals of 365 days.
        dates = pd.date_range(start=startDate.strftime("%Y%m%d"), end=endDate.strftime("%Y%m%d"), freq=API_MAX_PERIOD)

        df = pd.DataFrame([[i, x] for i, x in
                           zip(dates, dates.shift(1) - datetime.timedelta(seconds=1))],
                          columns=['start', 'end'])

        # Set start and end date to their provided values.
        df.loc[0, 'start'] = pd.Timestamp(startDate)
        df['end'].iloc[-1] = pd.Timestamp(endDate)
        return df

    def __handleApiError(self, apiRequest):
        json = None
        try:
            # Try to parse json and check if body contains a specific error message.
            json = apiRequest.json()
        finally:
            if json and 'error' in json and 'message' in json['error']:
                print(json)
                raise Exception(json['error']['message'])
            else:
                raise Exception('API request failed with status code %s' % apiRequest.status_code)
