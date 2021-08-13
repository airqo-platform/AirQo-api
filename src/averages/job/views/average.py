from flask import Blueprint, request, jsonify
import logging
import app
import json
from config import db_connection
from helpers import convert_date
from models import device_daily_historical_averages, device_daily_measurements, monitoring_site, device_hourly_measurements
from routes import api
from flask_cors import CORS
import sys
from datetime import datetime, timedelta
from bson import json_util, ObjectId
import numpy as np
import pandas as pd
import os

_logger = logging.getLogger(__name__)

average_bp = Blueprint('average', __name__)


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
        resampled_average_concentrations = time_indexed_data.resample(
            frequency).mean().round(decimal_places)
        resampled_timeseries = [{'pollutant_value': row.pollutant_value,
                                 'time': datetime.strftime(index, '%b,%Y')}
                                for index, row in resampled_average_concentrations.iterrows()]
        return resampled_timeseries


@average_bp.route(api.route['averages'], methods=['POST'])
def calculate_average_daily_measurements_for_last_28_days():
    tenant = request.args.get('tenant')
    if not tenant:
        return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
    MonitoringSiteModel = monitoring_site.MonitoringSite(tenant)
    monitoring_sites = MonitoringSiteModel.get_monitoring_sites()
    devices_historical_records = []
    for monitoring_site_device in monitoring_sites:
        print(monitoring_site_device)
        code = monitoring_site_device['DeviceCode']
        historical_results = []
        records = []
        pm25_daily_values = []
        average_pm25 = 0
        if code:  # check if code is not empty
            parish = monitoring_site_device['Parish']
            division = monitoring_site_device['Division']
            location_code = monitoring_site_device['LocationCode']
            created_at = convert_date.str_to_date(
                convert_date.str_to_date(datetime.now()))

            endtime = convert_date.str_to_date(datetime.now())
            starttime = convert_date.str_to_date(
                datetime.now() - timedelta(days=28))
            DailyAverage = device_daily_measurements.DailyMeasurements(tenant)
            monitoring_site_measurements_cursor = DailyAverage.get_filtered_data(
                code, starttime, endtime, 'daily', 'PM 2.5')

            for site in monitoring_site_measurements_cursor:
                record = {'pm2_5_value': int(
                    site['pollutant_value']), 'time': site["time"]}
                records.append(record)
                pm25_daily_values.append(int(site['pollutant_value']))
                historical_results.append(site)

            if len(pm25_daily_values) > 0:
                average_pm25 = np.mean(pm25_daily_values)
                historical_record = {'deviceCode': code, 'average_pm25': average_pm25,
                                     'historical_records': records, 'Parish': parish, 'Division': division, 'LocationCode': location_code, 'created_at': created_at}
                devices_historical_records.append(historical_record)

    # save_device_daily_historical_averages(devices_historical_records)
    print(devices_historical_records)


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
        DeviceHourlyMeasurement = device_hourly_measurements.DeviceHourlyMeasurements(
            tenant)
        records = DeviceHourlyMeasurement.get_all(query, projection)
    elif frequency == 'monthly':
        DeviceDailyMeasurement = device_daily_measurements.DailyMeasurements(
            tenant)
        results = DeviceDailyMeasurement.get_all(query, projection)
        records = resample_timeseries_data(results, 'M', 'time', 2)
    else:
        results = DeviceDailyMeasurement.get_all(query, projection)

    return list(records)


def save_device_daily_historical_averages(data, tenant):
    """
    """
    DeviceDailyHistoricalAverages = device_daily_historical_averages.Average(
        tenant)
    for i in data:
        DeviceDailyHistoricalAverages.save_averages(i)
