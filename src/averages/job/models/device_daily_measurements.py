import app
from datetime import datetime, timedelta
from config import db_connection
from helpers import convert_date
import requests
import math
from google.cloud import bigquery
import pandas as pd


class DailyMeasurements():
    """The class contains functionality for retrieving device status .
    Attributes:
        attr1 (str): Description of `attr1`.
        attr2 (:obj:`int`, optional): Description of `attr2`.
    """

    def __init__(self, tenant):
        """ initialize """
        self.tenant = tenant


   def get_all(self,query,projection):
       """
       """
       tenant = self.tenant
       db = db_connection.connect_mongo(tenant)
       results = list(
            db.device_daily_measurements.aggregate([query, projection]))

   
    def get_filtered_data(device_code, start_date=None, end_date=None, frequency='daily', pollutant='PM 2.5'):
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
    tenant = self.tenant
    db = db_connection.connect_mongo(tenant)
    if start_date == None:
        start = convert_date.str_to_date_find('2019-06-01T00:00:00Z')
    else:
        start = convert_date.str_to_date(start_date)
    if end_date == None:
        end = datetime.now()
    else:

        end = convert_date.str_to_date(end_date)

    query = {'$match': {'deviceCode': device_code,
                        'time': {'$lte': end, '$gte': start}}}

    if pollutant == 'PM 10':
        projection = {'$project': {'_id': 0,
                                   'time': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                   'pollutant_value': {'$round': ['$characteristics.pm10ConcMass.value', 2]}}}
    elif pollutant == 'NO2':
        projection = {'$project': {'_id': 0,
                                   'time': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                   'pollutant_value': {'$round': ['$characteristics.no2Conc.value', 2]}}}
    else:
        projection = {'$project': {'_id': 0,
                                   'time': {'$dateToString': {'format': '%Y-%m-%dT%H:%M:%S%z', 'date': '$time', 'timezone': 'Africa/Kampala'}},
                                   'pollutant_value': {'$round': ['$characteristics.pm2_5ConcMass.value', 2]}}}

    if frequency == 'hourly':
        records = db.device_hourly_measurements.aggregate([query, projection])
    elif frequency == 'monthly':
        results = list(
            db.device_daily_measurements.aggregate([query, projection]))
        records = resample_timeseries_data(results, 'M', 'time', 2)
    else:
        records = db.device_daily_measurements.aggregate([query, projection])

    return list(records)
