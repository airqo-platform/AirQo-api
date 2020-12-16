import base64
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
from models import device_status_hourly_check_results, device, device_status
from models.device_status import DeviceStatus as DeviceStatusModel
from routes import api
import requests
import math
import os
from flask import Blueprint, request, jsonify
import logging
from config import db_connection, constants
from helpers import convert_dates
from dataclasses import dataclass
_logger = logging.getLogger(__name__)


@dataclass
class DeviceStatus:
    is_online: bool
    elapsed_time: int


def get_all_devices(tenant):
    model = device.Device()
    results = model.get_devices(tenant)
    return [device for device in results if device.get("isActive")]


def get_device_status(channel_id):
    api_url = '{0}{1}{2}'.format(
        constants.configuration.BASE_API_URL, 'feeds/recent/', channel_id)
    latest_device_status_response = requests.get(api_url)
    if latest_device_status_response.status_code == 200:
        print(latest_device_status_response.json())
        result = latest_device_status_response.json()
        current_datetime = datetime.now()

        date_time_difference = current_datetime - \
            datetime.strptime(result['created_at'], '%Y-%m-%dT%H:%M:%SZ')
        time_difference = date_time_difference.total_seconds()
        six_hours = 21600  # in seconds

        if time_difference < six_hours:
            return DeviceStatus(is_online=True, elapsed_time=time_difference)
        return DeviceStatus(is_online=False, elapsed_time=time_difference)
    return DeviceStatus(is_online=False, elapsed_time=-1)


def compute_device_channel_status(tenant):
    results = get_all_devices(tenant)
    count_of_online_devices = 0
    online_devices = []
    offline_devices = []
    count_of_offline_devices = 0
    ####
    count_of_solar_devices = 0
    count_of_alternator_devices = 0
    count_of_mains = 0
    count_due_maintenance = 0
    count_overdue_maintenance = 0

    for channel in results:
        print(f'the type for channel is {type(channel)}')
        # print(channel['channelID'])
        # update the number of solar devices
        # calculate the maintenance due periods

        try:
            maintenance_status = (channel.get(
                "nextMaintenance") - datetime.now()).total_seconds()

            two_weeks_in_seconds = 1209600

            if maintenance_status < 0:
                channel["maintenance_status"] = "overdue"
                count_overdue_maintenance += 1
            elif maintenance_status < two_weeks_in_seconds:
                channel["maintenance_status"] = "due"
                count_due_maintenance += 1
            else:
                channel["maintenance_status"] = "good"
        except:
            channel["maintenance_status"] = -1

        def check_power_type(power):
            return (channel.get("powerType") or channel.get("power") or "").lower() == power

        if check_power_type("solar"):
            count_of_solar_devices += 1
        elif check_power_type("mains"):
            count_of_mains += 1
        elif check_power_type("alternator"):
            count_of_alternator_devices += 1

        device_status = get_device_status(channel.get("channelID"))
        channel['elapsed_time'] = device_status.elapsed_time
        if device_status.is_online:
            count_of_online_devices += 1
            online_devices.append(channel)
        else:
            count_of_offline_devices += 1
            offline_devices.append(channel)

    print(count_of_online_devices)
    print(count_of_offline_devices)

    device_status_results = []

    created_at = convert_dates.str_to_date(
        convert_dates.date_to_str(datetime.now()))
    record = {"created_at": created_at,
              "total_active_device_count": len(results),
              "count_of_online_devices": count_of_online_devices,
              "count_of_offline_devices": count_of_offline_devices,
              "online_devices": online_devices,
              "offline_devices": offline_devices}
    device_status_results.append(record)

    print(device_status_results)

    device_status_model = DeviceStatusModel(tenant)
    device_status_model.save_device_status(device_status_results)
