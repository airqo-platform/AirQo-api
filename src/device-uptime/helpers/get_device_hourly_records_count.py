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


class DeviceChannelRecords:
    """
    """

    def __init__(self, channel_id):
        self.channel_id = channel_id
        self.df = self.get_records()

    def get_records(self, hours=24):
        client = bigquery.Client()
        today = datetime.now()
        today_midnight = datetime(
            year=today.year, month=today.month, day=today.day, hour=0, minute=0, second=0)
        yesterday = today_midnight-timedelta(days=1)

        sql_query = """ 
               
                SELECT SAFE_CAST(TIMESTAMP(created_at) as DATETIME) as time, channel_id,field1 as s1_pm2_5,
                field2 as s1_pm10, field3 as s2_pm2_5, field4 as s2_pm10, field7 as battery_voltage
                FROM `airqo-250220.thingspeak.raw_feeds_pms` 
                WHERE channel_id = '{0}' AND CAST(created_at as TIMESTAMP) BETWEEN CAST('{1}' as TIMESTAMP)  AND CAST('{2}' as TIMESTAMP)
                ORDER BY time DESC           
                
            """
        sql_query = sql_query.format(
            self.channel_id, yesterday.isoformat(), today_midnight.isoformat())

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
        df['s1_s2_average_pm10'] = df[[
            's1_pm10', 's2_pm10']].mean(axis=1).round(2)
        df['battery_voltage'] = pd.to_numeric(
            df['battery_voltage'], errors='coerce')
        return df

    def get_sensor_readings(self):
        # change frequency to days

        time_indexed_data = self.df.set_index('time')

        # change freqeuncy to hours
        final_hourly_data = time_indexed_data.resample('H').mean().round(2)
        daily_data = final_hourly_data.resample('D').mean().dropna()
        sensor_one_pm2_5_readings = daily_data['s1_pm2_5'].tolist()
        sensor_two_pm2_5_readings = daily_data['s2_pm2_5'].tolist()
        battery_voltage_readings = daily_data['battery_voltage'].tolist()
        time_readings = daily_data.index.tolist()

        return sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings

    def get_count(self):
        """
        returns:
        valid_hourly_records_with_out_null_values_count
        total_hourly_records_count, 
        sensor_one_pm2_5_readings, 
        sensor_two_pm2_5_readings, 
        battery_voltage_readings, 
        time_readings
        """

        time_indexed_data = self.df.set_index('time')

        # change freqeuncy to hours
        final_hourly_data = time_indexed_data.resample('H').mean().round(2)

        valid_hourly_records_with_out_null_values = final_hourly_data.dropna().reset_index()

        valid_hourly_records_with_out_null_values_count = valid_hourly_records_with_out_null_values.shape[
            0]

        return valid_hourly_records_with_out_null_values_count
