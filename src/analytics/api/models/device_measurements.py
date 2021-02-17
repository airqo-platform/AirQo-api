from datetime import datetime
import pandas as pd
from api.models.base.base_model import BasePyMongoModel
from api.utils.dates import date_to_str, str_to_date


class DeviceDailyHistoricalAverages(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name='device_daily_historical_averages')

    def get_last_28_days_measurements(self):
        """
        Gets all the daily measurements for the device for the past 28 days from current day.

        Returns:
            A list of the daily measurements for the past 28 days.
        """
        created_at = str_to_date(date_to_str(datetime.now().date()))
        query = {
            '$match': {'created_at': {'$gte': created_at}}
        }
        projection = {'$project': {'_id': 0}}
        return list(self.collection.aggregate([query, projection]))


class DeviceHourlyMeasurement(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="device_hourly_measurements")

    @staticmethod
    def resample_timeseries_data(data, frequency, datetime_field, decimal_places):
        """
        Resamples the time series data provided into the specified frequency

        Args:
            chart_data (list): list of objects containing the timeseries data e.g [{'pollutant_value': 21.88, 'time': '2020-04-10T03:00:00+0300'}]
            frequency  (str): string specifying the frequency for the resampling i.e. 'M', "H", "D".
            datetime_field (str): The field to be used as a time index for the resampling.
            decimal_places (int): Specifes the number of decimal places to which values should be rounded to.

        Returns:
            A list containing the resampled timeseries.
        """
        if not data:
            return []
        else:
            df = pd.DataFrame(data)
            df[datetime_field] = pd.to_datetime(df[datetime_field])
            time_indexed_data = df.set_index(datetime_field)
            resampled_average_concentrations = time_indexed_data.resample(frequency).mean().round(decimal_places)
            return [
                {'pollutant_value': row.pollutant_value, 'time': datetime.strftime(index, '%b,%Y')}
                for index, row in resampled_average_concentrations.iterrows()
            ]

    def get_filtered_data(self, device_code, start_date=None, end_date=None, frequency='daily', pollutant='PM 2.5'):
        """
        Gets all the data for the specified pollutant from the device with the specified code observed between
        the specified start date and end date for the specified time frequency.

        Args:
            device_code (str): the code used to identify a device.
            start_date (datetime): the datetime from which observations to be returned should start(lower boundary).
            end_date (datetime): the datetime from which observations to be returned should end(upper boundary).
            frequency (str): the frequency of the observataions i.e. hourly, daily, monthly.
            pollutant (str): the pollutant whose observatations are to be returned i.e. PM 2.5, PM 10, NO2.
        Returns:
            A list of the data(pollutant values & their corresponding time) for the specified pollutant from the device
             with the specified code observed between
        the specified start date and end date for the specified time frequency.

        """

        start = start_date and datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%S.%fZ') or \
            datetime.strptime('2019-06-01T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')

        end = end_date and datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%S.%fZ') or datetime.now()

        query = {'$match': {'deviceCode': device_code, 'time': {'$lte': end, '$gte': start}}}
        sort_order = {'$sort': {'time': 1}}

        time_format = '%Y-%m-%dT%H:%M:%S%z'

        if frequency == 'daily':
            time_format = '%Y-%m-%d'
        elif frequency == 'hourly':
            time_format = '%Y-%m-%d %H:%M'

        if pollutant == 'PM 10':
            projection = {
                '$project': {
                    '_id': 0,
                    'time': {
                        '$dateToString': {
                             'format': time_format,
                             'date': '$time',
                             'timezone': 'Africa/Kampala'
                         }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.pm10ConcMass.value', 2]
                    }
                }
            }
        elif pollutant == 'NO2':
            projection = {
                '$project': {
                    '_id': 0,
                    'time': {
                        '$dateToString': {
                            'format': time_format,
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.no2Conc.value', 2]
                    }
                }
            }
        else:
            projection = {
                '$project': {
                    '_id': 0,
                    'time': {
                        '$dateToString': {
                            'format': time_format,
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.pm2_5ConcMass.value', 2]
                    }
                }
            }

        if frequency == 'hourly':
            records = self.collection.aggregate(
                [query, projection, sort_order])
        elif frequency == 'monthly':
            results = list(self.collection.aggregate(
                [query, projection, sort_order]))
            records = self.resample_timeseries_data(results, 'M', 'time', 2)
        else:
            records = self.collection.aggregate(
                [query, projection, sort_order])

        return list(records)

    def get_all_filtered_data(self, device_codes, start_date=None, end_date=None, frequency='daily', pollutant='PM 2.5'):
        """
        Gets all the data for the specified pollutant from the device with the specified code observed between
        the specified start date and end date for the specified time frequency.

        Args:
            device_codes (list): the code used to identify a device.
            start_date (datetime): the datetime from which observations to be returned should start(lower boundary).
            end_date (datetime): the datetime from which observations to be returned should end(upper boundary).
            frequency (str): the frequency of the observataions i.e. hourly, daily, monthly.
            pollutant (str/list): the pollutant whose observatations are to be returned i.e. PM 2.5, PM 10, NO2.
        Returns:
            A list of the data(pollutant values & their corresponding time) for the specified pollutant from the device
             with the specified code observed between
        the specified start date and end date for the specified time frequency.

        """

        start = start_date and datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%S.%fZ') or \
            datetime.strptime('2019-06-01T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')

        end = end_date and datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%S.%fZ') or datetime.now()

        filtered = self.filter_by(time={'$lte': end, '$gte': start}).in_filter_by(deviceCode=device_codes)

        #skipped
        sort_order = {'$sort': {'time': 1}}

        time_format = '%Y-%m-%dT%H:%M:%S%z'

        if frequency == 'daily':
            time_format = '%Y-%m-%d'
        elif frequency == 'hourly':
            time_format = '%Y-%m-%d %H:%M'

        if pollutant == 'PM 10':
            projection = {
                '$project': {
                    '_id': 0,
                    'deviceCode': 1,
                    'time': {
                        '$dateToString': {
                             'format': time_format,
                             'date': '$time',
                             'timezone': 'Africa/Kampala'
                         }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.pm10ConcMass.value', 2]
                    }
                }
            }
        elif pollutant == 'NO2':
            projection = {
                '$project': {
                    '_id': 0,
                    'deviceCode': 1,
                    'time': {
                        '$dateToString': {
                            'format': time_format,
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.no2Conc.value', 2]
                    }
                }
            }
        else:
            projection = {
                '$project': {
                    '_id': 0,
                    'deviceCode': 1,
                    'time': {
                        '$dateToString': {
                            'format': time_format,
                            'date': '$time',
                            'timezone': 'Africa/Kampala'
                        }
                    },
                    'pollutant_value': {
                        '$round': ['$characteristics.pm2_5ConcMass.value', 2]
                    }
                }
            }

        # if frequency == 'hourly':
        #     return filtered.exec(projections=projection['$project'])
        #
        # if frequency == 'monthly':
        #     results = list(filtered.exec(projections=projection['$project']))
        #     return self.resample_timeseries_data(results, 'M', 'time', 2)

        return filtered.exec(projections=projection['$project'])

    def get_all_pollutant_values(self, device_codes, start_date=None, end_date=None, frequency='daily'):
        """
        Gets all the data for the all pollutants from the specified device codes between the specified start_date and
        end_date for the specified time frequency.
        Args:
            device_codes: list  codes used to identify devices
            start_date: the datetime from which observations to be returned should start(lower boundary).
            end_date: the datetime from which observations to be returned should end(upper boundary)
            frequency: the frequency of the observations i.e. hourly, daily, monthly.

        Returns: A list of the data(pollutant values & their corresponding time) for all pollutants from all devices
                 with the specified code observed between time period.
        """

        start = start_date and datetime.strptime(start_date, '%Y-%m-%dT%H:%M:%S.%fZ') or \
                datetime.strptime('2019-06-01T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')

        end = end_date and datetime.strptime(end_date, '%Y-%m-%dT%H:%M:%S.%fZ') or datetime.now()

        time_format = '%Y-%m-%dT%H:%M:%S%z'

        if frequency == 'daily':
            time_format = '%Y-%m-%d'
        elif frequency == 'hourly':
            time_format = '%Y-%m-%d %H:%M'

        projection = {
            '_id': 0,
            'deviceCode': 1,
            'time': {
                '$dateToString': {
                    'format': time_format,
                    'date': '$time',
                    'timezone': 'Africa/Kampala'
                }
            },
            'pm25_value': {
                '$round': ['$characteristics.pm2_5ConcMass.value', 2]
            },
            'pm10_value': {
                '$round': ['$characteristics.pm10ConcMass.value', 2]
            },
            'no2_value': {
                '$round': ['$characteristics.no2Conc.value', 2]
            }
        }

        return (
            self.filter_by(time={'$lte': end, '$gte': start})
                .in_filter_by(deviceCode=device_codes)
                .exec(projection)
        )
