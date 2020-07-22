import app
from helpers import mongo_helpers, helpers
from datetime import datetime, timedelta
import pandas as pd


class Graph():
    """
    The class handles functionality for accessing data for the graphs (charts).

    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.

    """

    def __init__(self):
        """ initialize """

    def get_all_devices_past_28_days_exceedences(self, pollutant='PM 2.5', standard='AQI'):
        """
        Gets all the exceedences for all the locations in the past 28 days from current day. 

        Args:
            pollutant: the pollutant whose exceedences are to be returned. 
            standard: the standard to use to get the exceedences.

        Returns:
            A list of the number of daily exceedences for the specified pollutant and standard in the past 28 days.
        """
        created_at = helpers.str_to_date(
            helpers.date_to_str(datetime.now().date()))
        # print(created_at)
        query = {'$match': {'created_at': {'$gte': created_at},
                            'pollutant': pollutant, 'standard': standard}}
        projection = {'$project': {'_id': 0}}
        results = list(
            app.mongo.db.device_daily_exceedences.aggregate([query, projection]))
        return results

    def get_piechart_data(self, device_code, start_date, end_date, frequency, pollutant):
        '''
        returns the data to generate a pie chart given specific parameters
        '''
        records = self.get_filtered_data(
            device_code, start_date, end_date, frequency, pollutant)
        if records:
            if pollutant == 'PM 2.5':
                good_sum = sum(1 for i in range(len(
                    records)) if records[i]['pollutant_value'] > 0.0 and records[i]['pollutant_value'] <= 12.0)
                moderate_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 12.0 and
                                   records[i]['pollutant_value'] <= 35.4)
                UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 35.4 and
                                records[i]['pollutant_value'] <= 55.4)
                unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 55.4 and
                                    records[i]['pollutant_value'] <= 150.4)
                v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 150.4 and
                                      records[i]['pollutant_value'] <= 250.4)
                hazardous_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 250.4 and
                                    records[i]['pollutant_value'] <= 500.4)
                unknowns_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] < 0.0 or
                                   records[i]['pollutant_value'] > 500.4)

            elif pollutant == 'PM 10':
                good_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 0.0 and
                               records[i]['pollutant_value'] <= 54)
                moderate_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 54 and
                                   records[i]['pollutant_value'] <= 154)
                UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 154 and
                                records[i]['pollutant_value'] <= 254)
                unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 254 and
                                    records[i]['pollutant_value'] <= 354)
                v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 354 and
                                      records[i]['pollutant_value'] <= 424)
                hazardous_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 424 and
                                    records[i]['pollutant_value'] <= 604)
                unknowns_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] < 0.0 or
                                   records[i]['pollutant_value'] > 604)
            else:
                records = self.get_filtered_data(
                    device_code, start_date, end_date, frequency, pollutant)
                good_sum = sum(1 for i in range(len(
                    records)) if records[i]['pollutant_value'] > 0 and records[i]['pollutant_value'] <= 53)
                moderate_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 53 and
                                   records[i]['pollutant_value'] <= 100)
                UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 100 and
                                records[i]['pollutant_value'] <= 360)
                unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 360 and
                                    records[i]['pollutant_value'] <= 649)
                v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 649 and
                                      records[i]['pollutant_value'] <= 1249)
                hazardous_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] > 1249 and
                                    records[i]['pollutant_value'] <= 2049)
                unknowns_sum = sum(1 for i in range(len(records)) if records[i]['pollutant_value'] < 0.0 or
                                   records[i]['pollutant_value'] > 2049)

            tasks = [{'category_name': 'Good', 'category_count': good_sum},
                     {'category_name': 'Moderate', 'category_count': moderate_sum}, {
                         'category_name': 'UH4SG', 'category_count': UH4SG_sum},
                     {'category_name': 'Unhealthy', 'category_count': unhealthy_sum}, {
                         'category_name': 'Very Unhealthy', 'category_count': v_unhealthy_sum},
                     {'category_name': 'Hazardous', 'category_count': hazardous_sum}, {'category_name': 'Other', 'category_count': unknowns_sum}]
        else:
            tasks = []
        return tasks

    def resample_timeseries_data(self, data, frequency, datetime_field, decimal_places):
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
            resampled_average_concentrations = time_indexed_data.resample(
                frequency).mean().round(decimal_places)
            resampled_timeseries = [{'pollutant_value': row.pollutant_value,
                                     'time': datetime.strftime(index, '%b,%Y')}
                                    for index, row in resampled_average_concentrations.iterrows()]
            return resampled_timeseries

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
            A list of the data(pollutant values & their corresponding time) for the specified pollutant from the device with the specified code observed between
        the specified start date and end date for the specified time frequency.

        """
        if start_date == None:
            start = helpers.str_to_date_find('2019-06-01T00:00:00Z')
        else:
            start = helpers.str_to_date(start_date)
        if end_date == None:
            end = datetime.now()
        else:
            end = helpers.str_to_date(end_date)

        query = {'$match': {'deviceCode': device_code,
                            'time': {'$lte': end, '$gte': start}}}
        sort_order = {'$sort': {'time': 1}}

        time_format = '%Y-%m-%dT%H:%M:%S%z'

        if frequency == 'daily':
            time_format = '%Y-%m-%d'
        elif frequency == 'hourly':
            time_format = '%Y-%m-%d %H:%M'

        if pollutant == 'PM 10':
            projection = {'$project': {'_id': 0,
                                       'time': {'$dateToString': {'format': time_format, 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                       'pollutant_value': {'$round': ['$characteristics.pm10ConcMass.value', 2]}}}
        elif pollutant == 'NO2':
            projection = {'$project': {'_id': 0,
                                       'time': {'$dateToString': {'format': time_format, 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                       'pollutant_value': {'$round': ['$characteristics.no2Conc.value', 2]}}}
        else:
            projection = {'$project': {'_id': 0,
                                       'time': {'$dateToString': {'format': time_format, 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                       'pollutant_value': {'$round': ['$characteristics.pm2_5ConcMass.value', 2]}}}

        if frequency == 'hourly':
            records = app.mongo.db.device_hourly_measurements.aggregate(
                [query, projection, sort_order])
        elif frequency == 'monthly':
            results = list(app.mongo.db.device_daily_measurements.aggregate(
                [query, projection, sort_order]))
            records = self.resample_timeseries_data(results, 'M', 'time', 2)
        else:
            records = app.mongo.db.device_daily_measurements.aggregate(
                [query, projection, sort_order])

        return list(records)
