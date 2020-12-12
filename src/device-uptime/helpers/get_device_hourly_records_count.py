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
from helpers import convert_dates, calculate_uptime, get_expected_records_count
from models import network_uptime_analysis_results, device, raw_feeds_pms, device_uptime


def get_count(channel_id: int, hours=24):
    """
    returns:
    valid_hourly_records_with_out_null_values_count
    total_hourly_records_count, 
    sensor_one_pm2_5_readings, 
    sensor_two_pm2_5_readings, 
    battery_voltage_readings, 
    time_readings
    """

    channel_id = str(channel_id)
    client = bigquery.Client()
    # fetch the records from the database
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

    # validating the values obtained from the database
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

    # change freqeuncy to hours
    final_hourly_data = time_indexed_data.resample('H').mean().round(2)

    # change frequency to days
    daily_data = final_hourly_data.resample('D').mean().dropna()
    sensor_one_pm2_5_readings = daily_data['s1_pm2_5'].tolist()
    sensor_two_pm2_5_readings = daily_data['s2_pm2_5'].tolist()
    battery_voltage_readings = daily_data['battery_voltage'].tolist(
    )
    time_readings = daily_data.index.tolist()

    total_hourly_records_count = final_hourly_data.shape[0]

    # removing outliers
    """
    filtering out values that are invalid
    removing null values for every hour
    """
    records_with_valid_values = final_hourly_data[final_hourly_data['s1_s2_average_pm2_5'] <= 500.4]
    records_with_valid_values = records_with_valid_values[
        records_with_valid_values['s1_s2_average_pm2_5'] > 0]

    records_with_valid_values_count = records_with_valid_values.shape[0]

    invalid_records_count = records_with_valid_values - records_with_valid_values_count

    valid_hourly_records_with_out_null_values = records_with_valid_values.dropna().reset_index()

    valid_hourly_records_with_out_null_values_count = valid_hourly_records_with_out_null_values.shape[
        0]

    return valid_hourly_records_with_out_null_values_count, total_hourly_records_count, sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings
