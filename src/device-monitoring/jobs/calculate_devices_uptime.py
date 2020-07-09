import base64
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
import requests
import math
from google.cloud import bigquery
import pandas as pd
import numpy as np
import os


MONGO_URI = os.getenv("MONGO_URI")
print(MONGO_URI)
client = MongoClient(MONGO_URI)
db = client['airqo_netmanager']


def function_to_execute(event, context):
    """Triggered from a message on a Cloud Pub/Sub topic.
    Args:
         event (dict): Event payload.
         context (google.cloud.functions.Context): Metadata for the event.
    """
    action = base64.b64decode(event['data']).decode('utf-8')

    if (action == "compute_uptime_for_all_devices"):
        compute_uptime_for_all_devices()


def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def str_to_date_find(st):
    """
    Converts a string of different format to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%SZ')


def date_to_formated_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%d %H:%M')


def get_all_devices():
    results = db.devices.find({'status': {'$ne': 'Retired'}}, {'_id': 0})
    return results


def compute_number_of_months_between_two_dates(start_date, end_date):
    number_of_months = (end_date.year - start_date.year) * \
        12 + (end_date.month - start_date.month)
    return number_of_months


def get_raw_channel_data(channel_id: int, hours=24):
    channel_id = str(channel_id)
    client = bigquery.Client()
    sql_query = """ 
           
            SELECT SAFE_CAST(TIMESTAMP(created_at) as DATETIME) as time, channel_id,field1 as s1_pm2_5,
            field2 as s1_pm10, field3 as s2_pm2_5, field4 s2_pm10, 
            FROM `airqo-250220.thingspeak.raw_feeds_pms` 
            WHERE channel_id = {0} AND CAST(created_at as TIMESTAMP) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {1} HOUR) 
            ORDER BY time DESC           
            
        """
    xx = "'" + channel_id + "'"
    sql_query = sql_query.format(xx, hours)

    job_config = bigquery.QueryJobConfig()
    job_config.use_legacy_sql = False

    df = client.query(sql_query, job_config=job_config).to_dataframe()
    df['time'] = pd.to_datetime(df['time'])
    df['time'] = df['time']
    df['s1_pm2_5'] = pd.to_numeric(df['s1_pm2_5'], errors='coerce')
    df['channel_id'] = pd.to_numeric(df['channel_id'], errors='coerce')
    df['s1_pm10'] = pd.to_numeric(df['s1_pm10'], errors='coerce')
    df['s2_pm2_5'] = pd.to_numeric(df['s2_pm2_5'], errors='coerce')
    df['s2_pm10'] = pd.to_numeric(df['s2_pm10'], errors='coerce')
    df['s1_s2_average_pm2_5'] = df[[
        's1_pm2_5', 's2_pm2_5']].mean(axis=1).round(2)
    df['s1_s2_average_pm10'] = df[['s1_pm10', 's2_pm10']].mean(axis=1).round(2)
    time_indexed_data = df.set_index('time')
    final_hourly_data = time_indexed_data.resample('H').mean().round(2)

    total_hourly_records_count = final_hourly_data.shape[0]

    records_with_valid_values = final_hourly_data[final_hourly_data['s1_s2_average_pm2_5'] <= 500.4]
    records_with_valid_values = final_hourly_data[final_hourly_data['s1_s2_average_pm2_5'] > 0]

    records_with_valid_values_count = records_with_valid_values.shape[0]

    invalid_records_count = records_with_valid_values - records_with_valid_values_count

    valid_hourly_records_with_out_null_values = records_with_valid_values.dropna().reset_index()
    valid_hourly_records_with_out_null_values_count = valid_hourly_records_with_out_null_values.shape[
        0]

    return valid_hourly_records_with_out_null_values_count, total_hourly_records_count


def calculate_device_uptime(expected_total_records_count, actual_valid_records_count):
    device_uptime_in_percentage = round(
        ((actual_valid_records_count/expected_total_records_count) * 100), 2)
    device_downtime_in_percentage = round(
        ((expected_total_records_count-actual_valid_records_count)/expected_total_records_count) * 100)
    if device_uptime_in_percentage > 100:
        device_uptime_in_percentage = 100
    if device_downtime_in_percentage < 0:
        device_downtime_in_percentage = 0

    return device_uptime_in_percentage, device_downtime_in_percentage


def compute_uptime_for_all_devices():

    time_periods = [{'label': 'twenty_four_hours', 'specified_hours': 24, 'specifed_hours_mobile': 12}, {'label': 'seven_days', 'specified_hours': 168, 'specifed_hours_mobile': 84},
                    {'label': 'twenty_eight_days', 'specified_hours': 672, 'specifed_hours_mobile': 336}, {'label': 'twelve_months', 'specified_hours': 0, 'specifed_hours_mobile': 0}, {'label': 'all_time', 'specified_hours': 0, 'specifed_hours_mobile': 0}]

    average_uptime_for_entire_network_in_percentage_for_twentyfour_hours = {}
    twentyfour_hours = 0
    average_uptime_for_entire_network_in_percentage_for_seven_days = {}
    seven_days = 0
    average_uptime_for_entire_network_in_percentage_for_twenty_eight_days = {}
    twenty_eight_days = 0
    average_uptime_for_entire_network_in_percentage_for_twelve_months = {}
    twelve_months = 0
    average_uptime_for_entire_network_in_percentage_for_all_time = {}
    all_time = 0

    for time_period in time_periods:
        results = get_all_devices()
        specified_hours = int(time_period['specified_hours'])
        device_uptime_records = []
        all_devices_uptime_series = []

        if time_period['label'] == 'twelve_months':
            today = dt.date.today()
            past_day = today.day
            past_month = (today.month - 12) % 12
            past_year = today.year - ((today.month + 12)//12)
            twelve_months_later = dt.date(past_year, past_month, past_day)
            delta = datetime.now().date() - twelve_months_later
            no_of_days = delta.days
            specified_hours = no_of_days * 24

        elif time_period['label'] == 'all_time':
            no_of_days = 365
            specified_hours = no_of_days * 24

        print('specified hours\t' + str(specified_hours))
        for device in results:
            channel_id = device['channelID']
            mobililty = device['mobility']

            if time_period['label'] == 'twelve_months':
                device_registration_date = datetime.strptime(
                    device['registrationDate'], '%Y-%m-%d')
                end_date = datetime.now().date()
                start_date = device_registration_date.date()
                number_of_months = compute_number_of_months_between_two_dates(
                    start_date, end_date)
                if number_of_months < 12:
                    delta = end_date - device_registration_date.date()
                    no_of_days = delta.days
                    specified_hours = no_of_days * 24

            if time_period['label'] == 'all_time':
                device_registration_date = datetime.strptime(
                    device['registrationDate'], '%Y-%m-%d')
                delta = datetime.now().date() - device_registration_date.date()
                no_of_days = delta.days
                specified_hours = no_of_days * 24

            if mobililty == 'Mobile':
                # divide the specified hours by 2.. for mobile devices, use 12 hours
                specified_hours = int(specified_hours/2)

            valid_hourly_records_with_out_null_values_count, total_hourly_records_count = get_raw_channel_data(
                channel_id, specified_hours)
            print('valid records count' +
                  str(valid_hourly_records_with_out_null_values_count))
            device_uptime_in_percentage, device_downtime_in_percentage = calculate_device_uptime(
                specified_hours, valid_hourly_records_with_out_null_values_count)
            print('device-uptime \t' + str(device_uptime_in_percentage) +
                  '\n downtime \t' + str(device_downtime_in_percentage))

            created_at = str_to_date(date_to_str(datetime.now()))

            all_devices_uptime_series.append(device_uptime_in_percentage)
            device_uptime_record = {"device_uptime_in_percentage": device_uptime_in_percentage,
                                    "device_downtime_in_percentage": device_downtime_in_percentage, "created_at": created_at,
                                    "device_channel_id": channel_id, 'specified_time_in_hours': specified_hours}
            device_uptime_records.append(device_uptime_record)

        average_uptime_for_entire_network_in_percentage_for_selected_timeperiod = round(
            np.mean(all_devices_uptime_series), 2)
        created_at = str_to_date(date_to_str(datetime.now()))

        print('average uptime for entire network in percentage is : {}%'.format(
            average_uptime_for_entire_network_in_percentage_for_selected_timeperiod))

        if time_period['label'] == 'twenty_four_hours':
            entire_network_uptime_record = {"average_uptime_for_entire_network_in_percentage": average_uptime_for_entire_network_in_percentage_for_selected_timeperiod,
                                            "device_uptime_records": device_uptime_records, "created_at": created_at, 'specified_time_in_hours': specified_hours}

            twentyfour_hours = average_uptime_for_entire_network_in_percentage_for_selected_timeperiod
            average_uptime_for_entire_network_in_percentage_for_twentyfour_hours = entire_network_uptime_record
            print('twenty four hours' +
                  str(average_uptime_for_entire_network_in_percentage_for_selected_timeperiod))
        elif time_period['label'] == 'seven_days':
            entire_network_uptime_record = {"average_uptime_for_entire_network_in_percentage": average_uptime_for_entire_network_in_percentage_for_selected_timeperiod,
                                            "device_uptime_records": device_uptime_records, "created_at": created_at, 'specified_time_in_hours': specified_hours}

            seven_days = average_uptime_for_entire_network_in_percentage_for_selected_timeperiod
            average_uptime_for_entire_network_in_percentage_for_seven_days = entire_network_uptime_record
        elif time_period['label'] == 'twelve_months':
            entire_network_uptime_record = {"average_uptime_for_entire_network_in_percentage": average_uptime_for_entire_network_in_percentage_for_selected_timeperiod,
                                            "device_uptime_records": device_uptime_records, "created_at": created_at, 'specified_time_in_hours': specified_hours}

            twelve_months = average_uptime_for_entire_network_in_percentage_for_selected_timeperiod
            print('twelve_months' +
                  str(average_uptime_for_entire_network_in_percentage_for_selected_timeperiod))
            average_uptime_for_entire_network_in_percentage_for_twelve_months = entire_network_uptime_record
        elif time_period['label'] == 'twenty_eight_days':
            entire_network_uptime_record = {"average_uptime_for_entire_network_in_percentage": average_uptime_for_entire_network_in_percentage_for_selected_timeperiod,
                                            "device_uptime_records": device_uptime_records, "created_at": created_at, 'specified_time_in_hours': specified_hours}

            twenty_eight_days = average_uptime_for_entire_network_in_percentage_for_selected_timeperiod
            print(
                '28 days' + str(average_uptime_for_entire_network_in_percentage_for_selected_timeperiod))
            average_uptime_for_entire_network_in_percentage_for_twenty_eight_days = entire_network_uptime_record
        elif time_period['label'] == 'all_time':
            entire_network_uptime_record = {"average_uptime_for_entire_network_in_percentage": average_uptime_for_entire_network_in_percentage_for_selected_timeperiod,
                                            "device_uptime_records": device_uptime_records, "created_at": created_at, 'specified_time_in_hours': specified_hours}

            all_time = average_uptime_for_entire_network_in_percentage_for_selected_timeperiod
            print(
                'alltime' + str(average_uptime_for_entire_network_in_percentage_for_selected_timeperiod))
            average_uptime_for_entire_network_in_percentage_for_all_time = entire_network_uptime_record

    all_network_device_uptime_records = []

    entire_network_uptime_record_for_all_periods = {"average_uptime_for_entire_network_for_twentyfour_hours": average_uptime_for_entire_network_in_percentage_for_twentyfour_hours,
                                                    "average_uptime_for_entire_network_for_seven_days": average_uptime_for_entire_network_in_percentage_for_seven_days,
                                                    "average_uptime_for_entire_network_for_twenty_eight_days": average_uptime_for_entire_network_in_percentage_for_twenty_eight_days,
                                                    "average_uptime_for_entire_network_for_twelve_months": average_uptime_for_entire_network_in_percentage_for_twelve_months,
                                                    "average_uptime_for_entire_network_for_all_time": average_uptime_for_entire_network_in_percentage_for_all_time,
                                                    "created_at": created_at}

    all_network_device_uptime_records.append(
        entire_network_uptime_record_for_all_periods)

    print('average uptime for entire network is : {}%'.format(
        entire_network_uptime_record_for_all_periods))

    save_network_uptime_analysis_results(all_network_device_uptime_records)


def save_network_uptime_analysis_results(data):
    """
    """
    for i in data:
        print(i)
        db.network_uptime_analysis_results.insert_one(i)
        print('saved')


if __name__ == '__main__':
    compute_uptime_for_all_devices()
