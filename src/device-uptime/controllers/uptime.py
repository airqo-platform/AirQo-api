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

    DeviceChannelRecordsClass = DeviceChannelRecords(channel_id)
    device_hourly_records = DeviceChannelRecordsClass.get_count()

    return calculate_uptime.calculate_device_uptime(expected_records_count, device_hourly_records)


def save_device_uptime(tenant):
    """
    get channel ID from devices fetched
    and then afterwards, save the corresponding device DAILY uptimes and sensor readings
    """
    print("saving uptime", tenant)
    devices = get_all_devices(tenant)
    print(devices)
    for device in devices:
        channel_id = device.channelID
        mobility = device.mobililty
        device_name = device.name

        DeviceChannelRecordsClass = DeviceChannelRecords(channel_id)
        sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings = DeviceChannelRecordsClass.get_sensor_readings()
        device_uptime_in_percentage, device_downtime_in_percentage = compute_device_uptime(
            mobility, channel_id)
        created_at = datetime.now().toString()

        record = {
            "sensor_one_pm2_5": sensor_one_pm2_5_readings,
            "sensor_two_pm2_5": sensor_two_pm2_5_readings,
            "battery_voltage": battery_voltage_readings,
            "device_name": device_name,
            "channel_id": channel_id,
            "uptime": device_uptime_in_percentage,
            "downtime": device_downtime_in_percentage,
            "created_at": created_at
        }
        print(record)

        DeviceUptimeModel = device_uptime.DeviceUptime(tenant)
        DeviceUptimeModel.save_device_uptime(record)


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
