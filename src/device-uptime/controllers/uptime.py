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
from helpers.get_device_hourly_records_count import DeviceChannelRecords
from models import network_uptime_analysis_results, device, raw_feeds_pms, device_uptime
from concurrent.futures import ThreadPoolExecutor


_logger = logging.getLogger(__name__)
uptime_bp = Blueprint('uptime', __name__)


def compute_device_uptime(mobility, channel_id):
    """
    specify the expected number of records
    get actual hourly records for the device
    we use the method for calculating uptime
    """

    expected_records_count = get_expected_records_count.get_expected_records_count(
        mobility)

    device_channel_records_class = DeviceChannelRecords(channel_id)
    device_hourly_records = device_channel_records_class.get_count()

    return calculate_uptime.calculate_device_uptime(expected_records_count, device_hourly_records)


def save_device_uptime(tenant):
    """
    get channel ID from devices fetched
    and then afterwards, save the corresponding device DAILY uptimes and sensor readings
    """
    def get_device_record(channel_id, device_name, mobility):

        device_channel_records_class = DeviceChannelRecords(channel_id)
        sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings = device_channel_records_class.get_sensor_readings()
        device_uptime_in_percentage, device_downtime_in_percentage = compute_device_uptime(
            mobility, channel_id)
        created_at = datetime.now()

        record = {
            "sensor_one_pm2_5": sensor_one_pm2_5_readings[0],
            "sensor_two_pm2_5": sensor_two_pm2_5_readings[0],
            "battery_voltage": battery_voltage_readings[0],
            "device_name": device_name,
            "channel_id": channel_id,
            "uptime": device_uptime_in_percentage,
            "downtime": device_downtime_in_percentage,
            "created_at": created_at.isoformat()
        }
        return record
    devices = get_all_devices(tenant)
    records = []
    futures = []
    executor = ThreadPoolExecutor()

    for device in devices:
        channel_id = device.get("channelID")
        mobility = device.get("mobililty")
        device_name = device.get("name")
        if not (channel_id and device_name):
            print("this device could not be processed", device_name)
            continue
        futures.append(executor.submit(get_device_record,
                                       channel_id, device_name, mobility))
    for future in futures:
        records.append(future.result())
    device_uptime_model = device_uptime.DeviceUptime(tenant)
    device_uptime_model.save_device_uptime(records)


def get_all_devices(tenant):
    device_model = device.Device(tenant)
    results = device_model.get_all()
    active_devices = [device for device in results if device.get("isActive")]
    return active_devices
