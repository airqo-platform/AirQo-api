import base64
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
import requests
import numpy as np
import pandas as pd
import os
from config import constants, db_connection
from helpers import convert_date

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client['airqo_analytics']


code_locations_dict = {'Luzira': 'A9WLJS5F', 'Kawala': 'AR2RHV97', 'Nakulabye': 'AMBD741S', 'Namirembe': 'ARBL6HVZ',
                       'Kiswa': 'APYZC5J7', 'Civic Centre': 'A95X5F9T', 'Ggaba': 'AKSLS0FP', 'Kazo Angola': 'AW66FF7V', 'Kisugu': 'APZ80RTM',
                       'Kisenyi II': 'AY2J2Q7Z', 'Kyebando': 'ALS2LCWY',  'Mutundwe': 'AZB4PFV4', 'Bwaise II': 'ANQ16PZJ',
                       'Naguru I': 'AGPZ1C42', 'Nakawa': 'ADPYGHD0', 'Kamwokya II': 'AJCK5L86', 'Wandegeya': 'A743BPWK', 'Nsambya Central': 'AX9RGBN0',
                       'Komamboga': 'AB6051M4', 'Kisenyi II': 'AT6NJNZR', 'Nakasero II': 'ARSWTW30',  'Kibuye I': 'A0WN66FH',
                       'Kyanja': 'ACMVQ44H'}


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


def calculate_exceedences_for_last_28_days():
    monitoring_sites = list(db.monitoring_site.find(
        {}, {"DeviceCode": 1, "Parish": 1, "LocationCode": 1, "Division": 1, "_id": 0}))

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
                convert_date.date_to_str(datetime.now()))

            endtime = convert_date.date_to_str(datetime.now())
            starttime = convert_date.date_to_str(
                datetime.now() - timedelta(days=28))
            monitoring_site_measurements_cursor = get_filtered_data(
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


def get_filtered_dataX(device_code, start_date=None, end_date=None, frequency='daily', pollutant='PM 2.5'):
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
        records = db.device_hourly_measurements.aggregate([query, projection])
    elif frequency == 'monthly':
        results = list(
            db.device_daily_measurements.aggregate([query, projection]))
        records = resample_timeseries_data(results, 'M', 'time', 2)
    else:
        records = db.device_daily_measurements.aggregate([query, projection])

    return list(records)


def save_device_daily_exceedences(data):
    """
    """
    for i in data:
        db.device_daily_exceedences.insert_one(i)


def get_filtered_data(device_code, start_date=None, end_date=None, frequency='daily', pollutant='PM 2.5'):
    """
    returns the data of a certain device with specified parameters
    """

    if start_date == None:
        start = convert_date.str_to_date_find('2019-06-01T00:00:00Z')
    else:
        start = convert_date.str_to_date(start_date)
    if end_date == None:
        end = datetime.now()
    else:
        end = convert_date.str_to_date(end_date)

    query = {'deviceCode': device_code, 'time': {'$lte': end, '$gte': start}}

    if pollutant == 'PM 10':
        projection = {'_id': 0, 'time': 1,
                      'characteristics.pm10ConcMass.value': 1}
        if frequency == 'hourly':
            records = list(
                db.device_hourly_measurements.find(query, projection))
        elif frequency == 'daily':
            records = list(
                db.device_daily_measurements.find(query, projection))
        else:
            records = list(db.device_raw_measurements.find(query, projection))
        for i in range(len(records)):
            if records[i]['characteristics']['pm10ConcMass']['value'] > 0 and records[i]['characteristics']['pm10ConcMass']['value'] <= 54:
                records[i]['backgroundColor'] = 'green'
            elif records[i]['characteristics']['pm10ConcMass']['value'] > 54 and records[i]['characteristics']['pm10ConcMass']['value'] <= 154:
                records[i]['backgroundColor'] = 'yellow'
            elif records[i]['characteristics']['pm10ConcMass']['value'] > 154 and records[i]['characteristics']['pm10ConcMass']['value'] <= 254:
                records[i]['backgroundColor'] = 'orange'
            elif records[i]['characteristics']['pm10ConcMass']['value'] > 254 and records[i]['characteristics']['pm10ConcMass']['value'] <= 354:
                records[i]['backgroundColor'] = 'red'
            elif records[i]['characteristics']['pm10ConcMass']['value'] > 354 and records[i]['characteristics']['pm10ConcMass']['value'] <= 424:
                records[i]['backgroundColor'] = 'purple'
            elif records[i]['characteristics']['pm10ConcMass']['value'] > 424 and records[i]['characteristics']['pm10ConcMass']['value'] <= 604:
                records[i]['backgroundColor'] = 'maroon'
            else:
                records[i]['backgroundColor'] = 'gray'
        return records
    elif pollutant == 'NO2':
        projection = {'_id': 0, 'time': 1, 'characteristics.no2Conc.value': 1}
        if frequency == 'hourly':
            records = list(
                db.device_hourly_measurements.find(query, projection))
        elif frequency == 'daily':
            records = list(
                db.device_daily_measurements.find(query, projection))
        else:
            records = list(db.device_raw_measurements.find(query, projection))
        for i in range(len(records)):
            if records[i]['characteristics']['no2Conc']['value'] > 0.0 and records[i]['characteristics']['no2Conc']['value'] <= 53:
                records[i]['backgroundColor'] = 'green'
            elif records[i]['characteristics']['no2Conc']['value'] > 53 and records[i]['characteristics']['no2Conc']['value'] <= 100:
                records[i]['backgroundColor'] = 'yellow'
            elif records[i]['characteristics']['no2Conc']['value'] > 100 and records[i]['characteristics']['no2Conc']['value'] <= 360:
                records[i]['backgroundColor'] = 'orange'
            elif records[i]['characteristics']['no2Conc']['value'] > 360 and records[i]['characteristics']['no2Conc']['value'] <= 649:
                records[i]['backgroundColor'] = 'red'
            elif records[i]['characteristics']['no2Conc']['value'] > 649 and records[i]['characteristics']['no2Conc']['value'] <= 1249:
                records[i]['backgroundColor'] = 'purple'
            elif records[i]['characteristics']['no2Conc']['value'] > 1249 and records[i]['characteristics']['no2Conc']['value'] <= 2049:
                records[i]['backgroundColor'] = 'maroon'
            else:
                records[i]['backgroundColor'] = 'gray'
        return records
    else:
        projection = {'_id': 0, 'time': 1,
                      'characteristics.pm2_5ConcMass.value': 1}
        if frequency == 'hourly':
            records = list(
                db.device_hourly_measurements.find(query, projection))
        elif frequency == 'daily':
            records = list(
                db.device_daily_measurements.find(query, projection))
        else:
            records = list(db.device_raw_measurements.find(query, projection))
        for i in range(len(records)):
            if records[i]['characteristics']['pm2_5ConcMass']['value'] > 0.0 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 12.0:
                records[i]['backgroundColor'] = 'green'
            elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 12.0 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 35.4:
                records[i]['backgroundColor'] = 'yellow'
            elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 35.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 55.4:
                records[i]['backgroundColor'] = 'orange'
            elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 55.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 150.4:
                records[i]['backgroundColor'] = 'red'
            elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 150.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 250.4:
                records[i]['backgroundColor'] = 'purple'
            elif records[i]['characteristics']['pm2_5ConcMass']['value'] > 250.4 and records[i]['characteristics']['pm2_5ConcMass']['value'] <= 500.4:
                records[i]['backgroundColor'] = 'maroon'
            else:
                records[i]['backgroundColor'] = 'gray'
        return records


def calculate_exceedances_for_last_28_days():
    pollutants = ['PM 2.5', 'PM 10', 'NO2']
    standards = ['WHO', 'AQI']
    exceedence_results = []
    created_at = convert_date.str_to_date(
        convert_date.date_to_str(datetime.now()))
    for pollutant in pollutants:
        for standard in standards:
            exceedences_data = get_exceedances(pollutant, standard)
            exceedence_record = {'pollutant': pollutant, 'standard': standard, 'exceedences': exceedences_data,
                                 'created_at': created_at}
            exceedence_results.append(exceedence_record)

    print(exceedence_results)
    save_device_daily_exceedences(exceedence_results)


def get_exceedances(pollutant='PM 2.5', standard='WHO', frequency='daily'):
    '''
    Generates data for exceedances chart
    '''
    exceedances_list = []
    for location in code_locations_dict.keys():
        exceedances_dict = {}
        if standard == 'AQI':
            exceedances = get_AQI_exceedances(location, pollutant, frequency)
            exceedances_dict['location'] = location
            exceedances_dict['UH4SG'] = exceedances[0]
            exceedances_dict['Unhealthy'] = exceedances[1]
            exceedances_dict['VeryUnhealthy'] = exceedances[2]
            exceedances_dict['Hazardous'] = exceedances[3]
            exceedances_list.append(exceedances_dict)
        else:
            exceedances = get_WHO_exceedances(location, pollutant, frequency)
            exceedances_dict['location'] = location
            exceedances_dict['exceedances'] = exceedances
            exceedances_list.append(exceedances_dict)
    return exceedances_list


def get_WHO_exceedances(location, pollutant='PM 2.5', frequency='daily'):
    '''
    Returns exceedances based on the WHO limit
    '''
    device_code = code_locations_dict[location]
    end_date = datetime.now()
    start_date = end_date-timedelta(days=29)

    records = get_filtered_data(device_code, convert_date.date_to_str(
        start_date), convert_date.date_to_str(end_date), frequency, pollutant)

    if pollutant == 'NO2':
        exceedance_sum = sum(1 for i in range(
            len(records)) if records[i]['characteristics']['no2Conc']['value'] > 40)

    elif pollutant == 'PM 10':
        exceedance_sum = sum(1 for i in range(
            len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] > 50)

    else:
        exceedance_sum = sum(1 for i in range(
            len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] > 25.0)
    return exceedance_sum


def get_AQI_exceedances(location, pollutant='PM 2.5', frequency='daily'):
    '''
    Returns exceedances based on the AQI index
    '''
    device_code = code_locations_dict[location]
    end_date = datetime.now()
    start_date = end_date-timedelta(days=29)

    records = get_filtered_data(device_code, convert_date.date_to_str(
        start_date), convert_date.date_to_str(end_date), frequency, pollutant)

    if pollutant == 'NO2':
        UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] > 100 and
                        records[i]['characteristics']['no2Conc']['value'] <= 360)
        unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] > 360 and
                            records[i]['characteristics']['no2Conc']['value'] <= 649)
        v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] > 649 and
                              records[i]['characteristics']['no2Conc']['value'] <= 1249)
        hazardous_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['no2Conc']['value'] > 1249 and
                            records[i]['characteristics']['no2Conc']['value'] <= 2049)

    elif pollutant == 'PM 10':
        UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] > 154 and
                        records[i]['characteristics']['pm10ConcMass']['value'] <= 254)
        unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] > 254 and
                            records[i]['characteristics']['pm10ConcMass']['value'] <= 354)
        v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] > 354 and
                              records[i]['characteristics']['pm10ConcMass']['value'] <= 424)
        hazardous_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm10ConcMass']['value'] > 424 and
                            records[i]['characteristics']['pm10ConcMass']['value'] <= 604)
    else:
        UH4SG_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] > 35.4 and
                        records[i]['characteristics']['pm2_5ConcMass']['value'] <= 55.4)
        unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] > 55.4 and
                            records[i]['characteristics']['pm2_5ConcMass']['value'] <= 150.4)
        v_unhealthy_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] > 150.4 and
                              records[i]['characteristics']['pm2_5ConcMass']['value'] <= 250.4)
        hazardous_sum = sum(1 for i in range(len(records)) if records[i]['characteristics']['pm2_5ConcMass']['value'] > 250.4 and
                            records[i]['characteristics']['pm2_5ConcMass']['value'] <= 500.4)

    exceedances = [UH4SG_sum, unhealthy_sum, v_unhealthy_sum, hazardous_sum]
    return exceedances


if __name__ == '__main__':
    calculate_exceedances_for_last_28_days()
