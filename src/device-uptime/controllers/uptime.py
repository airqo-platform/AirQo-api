import base64
import datetime as dt
from flask import Blueprint, request, jsonify
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
import requests
import math
from google.cloud import bigquery
from flask import Blueprint, request, jsonify
import logging
import pandas as pd
import numpy as np
from routes import api
import os
import logging
from helpers import convert_dates, calculate_uptime, get_expected_records_count, get_device_hourly_records_count
from models import network_uptime_analysis_results, device, raw_feeds_pms, device_uptime

_logger = logging.getLogger(__name__)
uptime_bp = Blueprint('uptime', __name__)


def get_all_devices(tenant):
    DeviceModel = device.Device(tenant)
    results = DeviceModel.get_all()
    active_devices = []
    for dev in results:
        print(dev['name'])
        device_id = dev['_id']
        print(device_id)
        if(dev['isActive'] == True):
            active_devices.append(dev)
    return active_devices


def get_raw_channel_data(channel_id: int, hours=24):
    channel_id = str(channel_id)
    client = bigquery.Client()
    sql_query = """ 
           
            SELECT SAFE_CAST(TIMESTAMP(created_at) as DATETIME) as time, channel_id,field1 as s1_pm2_5,
            field2 as s1_pm10, field3 as s2_pm2_5, field4 as s2_pm10, field7 as battery_voltage
            FROM `airqo-250220.thingspeak.raw_feeds_pms` 
            WHERE channel_id = '{0}' AND CAST(created_at as TIMESTAMP) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {1} HOUR) 
            ORDER BY time DESC           
            
        """
    sql_query = sql_query.format(channel_id, hours)

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
    df['battery_voltage'] = pd.to_numeric(
        df['battery_voltage'], errors='coerce')
    time_indexed_data = df.set_index('time')
    final_hourly_data = time_indexed_data.resample('H').mean().round(2)

    daily_data = final_hourly_data.resample('D').mean().dropna()
    sensor_one_pm2_5_readings = daily_data['s1_pm2_5'].tolist()
    sensor_two_pm2_5_readings = daily_data['s2_pm2_5'].tolist()
    battery_voltage_readings = daily_data['battery_voltage'].tolist(
    )
    time_readings = daily_data.index.tolist()

    total_hourly_records_count = final_hourly_data.shape[0]

# removing outliers
    records_with_valid_values = final_hourly_data[final_hourly_data['s1_s2_average_pm2_5'] <= 500.4]
    records_with_valid_values = records_with_valid_values[
        records_with_valid_values['s1_s2_average_pm2_5'] > 0]

    records_with_valid_values_count = records_with_valid_values.shape[0]

    invalid_records_count = records_with_valid_values - records_with_valid_values_count

    valid_hourly_records_with_out_null_values = records_with_valid_values.dropna().reset_index()

    valid_hourly_records_with_out_null_values_count = valid_hourly_records_with_out_null_values.shape[
        0]

    return valid_hourly_records_with_out_null_values_count, total_hourly_records_count, sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings


@uptime_bp.route(api.route['uptime'], methods=['POST', 'GET'])
def compute_uptime_for_all_devices():
    """
    This function computes the uptime for the 
    1. network and 
    2. each device accordingly (when device IDs are provided as query params)

    Response Bodies:
    1.  Entire Network:
       [
          {
             network_name: "",
              _id: "",
             uptime: "",
             created_at: ""
          },
          ...
       ]
    2. Uptime for one device
        [ {
               device_name: "",
               channel_id: "",
               _id: "",
               uptime: "",
               created_at: ""
           }
         ]

    3. Uptime for various devices for a time period

       {

           "aq_23": [
              {
                 device_name: "",
                 channel_id: "",
                 _id: "",
                 uptime: "",
                 created_at: ""
               },
               ...
           ],
           "aq_23": [


           ]
       }
    """
    if request.method == 'POST':
        tenant = request.args.get('tenant')
        device_channel_id = request.args.get('channel_id')
        device_id = request.args.get('device_id')
        device_name = request.args.get('device_name')

        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400

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
            results = get_all_devices(tenant)
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
                device_id = device['_id']
                device_name = device['name']

                if time_period['label'] == 'twelve_months':
                    device_registration_date = device['createdAt']
                    end_date = datetime.now().date()
                    start_date = device_registration_date.date()
                    number_of_months = convert_dates.compute_number_of_months_between_two_dates(
                        start_date, end_date)
                    if number_of_months < 12:
                        delta = end_date - device_registration_date.date()
                        no_of_days = delta.days
                        specified_hours = no_of_days * 24

                if time_period['label'] == 'all_time':
                    device_registration_date = device['createdAt']
                    delta = datetime.now().date() - device_registration_date.date()
                    no_of_days = delta.days
                    specified_hours = no_of_days * 24

                if mobililty == 'Mobile':
                    # divide the specified hours by 2.. for mobile devices, use 12 hours
                    specified_hours = int(specified_hours/2)

                valid_hourly_records_with_out_null_values_count, total_hourly_records_count, sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings = get_raw_channel_data(
                    channel_id, specified_hours)
                print('valid records count' +
                      str(valid_hourly_records_with_out_null_values_count))
                device_uptime_in_percentage, device_downtime_in_percentage = calculate_uptime.calculate_device_uptime(
                    specified_hours, valid_hourly_records_with_out_null_values_count)
                print('device-uptime \t' + str(device_uptime_in_percentage) +
                      '\n downtime \t' + str(device_downtime_in_percentage))

                created_at = convert_dates.str_to_date(
                    convert_dates.date_to_str(datetime.now()))
                # storing the uptimes for the different devices within this timeframe
                all_devices_uptime_series.append(device_uptime_in_percentage)
                device_uptime_record = {"device_uptime_in_percentage": device_uptime_in_percentage,
                                        "device_downtime_in_percentage": device_downtime_in_percentage, "created_at": created_at,
                                        "device_channel_id": channel_id, "specified_time_in_hours": specified_hours, "device_name": device_name, "device_id": device_id}

                if time_period['label'] == 'twenty_eight_days':
                    device_uptime_record["device_sensor_one_pm2_5_readings"] = sensor_one_pm2_5_readings
                    device_uptime_record["device_sensor_two_pm2_5_readings"] = sensor_two_pm2_5_readings
                    device_uptime_record["device_battery_voltage_readings"] = battery_voltage_readings
                    device_uptime_record["device_time_readings"] = time_readings

                device_uptime_records.append(device_uptime_record)

            average_uptime_for_entire_network_in_percentage_for_selected_timeperiod = round(
                np.mean(all_devices_uptime_series), 2)
            created_at = convert_dates.str_to_date(
                convert_dates.date_to_str(datetime.now()))

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

        # print('average uptime for entire network is : {}%'.format(
        # entire_network_uptime_record_for_all_periods))

        save_network_uptime_analysis_results(
            all_network_device_uptime_records, tenant)
    elif request.method == 'GET':
        pass
        # fetch the uptimes for either entire network or single device.


@uptime_bp.route(api.route['uptime'], methods=['POST', 'GET'])
def compute_device_uptime(mobility, device_name):
    """
    specify the expected number of records
    get actual hourly records for the device
    we use the method for calculating uptime
    """

    expected_records_count = get_expected_records_count.get_expected_records_count(
        mobility)

    device_hourly_records = get_device_hourly_records_count.get_count(
        device_name)


def save_network_uptime_analysis_results(data, tenant):
    """
    This function saves the uptime for the entire network
    """
    DeviceUptimeModel = network_uptime_analysis_results.NetworkUptimeAnalysisResults(
        tenant)
    for i in data:
        print(i)
        DeviceUptimeModel.save_device_uptime(i)
        print('saved')


@uptime_bp.route(api.route['uptime'], methods=['GET'])
def get_device_uptime():
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        device_channel_id = request.args.get('channel_id')
        device_id = request.args.get('device_id')
        device_name = request.args.get('device_name')
        last_days = request.args.get('last_days')
    DeviceUptimeModel = network_uptime_analysis_results.NetworkUptimeAnalysisResults(
        tenant)


def save_device_uptime_analysis_results(data, tenant):
    """
    """
