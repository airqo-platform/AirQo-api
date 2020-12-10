import base64
import datetime as dt
from bson import json_util, ObjectId
import json
from datetime import datetime, timedelta
from pymongo import MongoClient
from models import DeviceStatus, Device
import requests
import math
import os
from flask import Blueprint, request, jsonify
import logging
from config import db_connection, config
from helpers import convert_dates


MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client['airqo_netmanager']

_logger = logging.getLogger(__name__)
device_status_bp = Blueprint('device_status', __name__)


def function_to_execute(event, context):
    """Triggered from a message on a Cloud Pub/Sub topic.
    Args:
         event (dict): Event payload.
         context (google.cloud.functions.Context): Metadata for the event.
    """
    action = base64.b64decode(event['data']).decode('utf-8')

    if (action == "check_device_status"):
        get_device_channel_status()


def convert_seconds_to_days_hours_minutes_seconds(seconds_to_convert):
    day = seconds_to_convert // (24 * 3600)
    seconds_to_convert = seconds_to_convert % (24 * 3600)
    hour = seconds_to_convert // 3600
    seconds_to_convert %= 3600
    minutes = seconds_to_convert // 60
    seconds_to_convert %= 60
    seconds = seconds_to_convert
    result = str(int(day)) + " days " + str(int(hour)) + " hours " + \
        str(int(minutes)) + " minutes " + str(int(seconds)) + " seconds"
    return result


def get_all_devices():
    model = Device.Device()
    tenant = request.args.get('tenant')
    if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        results = model.get_devices(tenant)
        active_devices = []
        for device in results:
            print(device['name'])
            if(device['isActive'] == True):
                active_devices.append(device)
        return active_devices

@device_status_bp.route(api.route['all_devices_latest_status'], methods=['POST'])
def get_device_channel_status():
    # api_url = '{0}{1}'.format(config.BASE_API_URL, 'channels')
    api_url = '{0}'.format(config.BASE_API_URL, 'channels')
    print(api_url)
    results = get_all_devices()
    count = 0
    count_of_online_devices = 0
    online_devices = []
    offline_devices = []
    count_of_offline_devices = 0
    ####
    count_of_solar_devices = 0
    count_of_alternator_devices = 0
    count_of_mains = 0
    count_due_maintenance=0
    count_overdue_maintenance=0

    for channel in results:
        print(channel['channelID'])
        # update the number of solar devices
          # calculate the maintenance due periods
        current_datetime = datetime.now()
        maintenance_due_period = current_datetime - \
            datetime.strptime(channel['nextMaintenance'], '%Y-%m-%dT%H:%M:%SZ')
        maintenance_due_period_in_days = maintenance_due_period.total_seconds() / (24 * 3600)
        if channel['Solar']: 
            count_of_solar_devices +=1
        elif channel['Mains']:
            count_of_mains +=1
        elif channel['Alternator']:
            count_of_alternator_devices +=1
        elif (maintenance_due_period_in_days<8 and maintenance_due_period_in_days>1):
            count_due_maintenance+=1
        elif maintenance_due_period_in_days>8:
            count_overdue_maintenance +=1
            
        latest_device_status_request_api_url = '{0}{1}{2}'.format(
            BASE_API_URL, 'feeds/recent/', channel['channelID'])
        latest_device_status_response = requests.get(
            latest_device_status_request_api_url)
        if latest_device_status_response.status_code == 200:
            print(latest_device_status_response.json())
            result = latest_device_status_response.json()
            count += 1
            current_datetime = datetime.now()

            date_time_difference = current_datetime - \
                datetime.strptime(result['created_at'], '%Y-%m-%dT%H:%M:%SZ')
            date_time_difference_in_hours = date_time_difference.total_seconds() / 3600
            date_time_difference_in_seconds = date_time_difference.total_seconds()
            date_time_difference_in_days = date_time_difference.total_seconds() / (24 * 3600)

            print(date_time_difference_in_hours)
            if date_time_difference_in_hours > 24:
                count_of_offline_devices += 1
                time_offline = convert_seconds_to_days_hours_minutes_seconds(
                    date_time_difference_in_seconds)
                time_offline_in_hours = date_time_difference_in_hours
                channel['time_offline'] = time_offline
                channel['time_offline_in_hours'] = time_offline_in_hours
                offline_devices.append(channel)
            else:
                count_of_online_devices += 1
                online_devices.append(channel)

    print(count)
    print(count_of_online_devices)
    print(count_of_offline_devices)

    online_devices_percentage = math.floor(
        (count_of_online_devices/count) * 100)
    offline_devices_percentage = math.floor(
        (count_of_offline_devices/count) * 100)
    print('online device percentage is : {}%'.format(online_devices_percentage))
    print('offline device percentage is: {}%'.format(offline_devices_percentage))

    device_status_results = []

    created_at = convert_dates.str_to_date(convert_dates.date_to_str(datetime.now()))
    record = {"online_devices_percentage": online_devices_percentage,
              "offline_devices_percentage": offline_devices_percentage, "created_at": created_at,
              "total_active_device_count": count, "count_of_online_devices": count_of_online_devices,
              "count_of_offline_devices": count_of_offline_devices, "online_devices": online_devices, "offline_devices": offline_devices}
    device_status_results.append(record)

    print(device_status_results)

    save_hourly_device_status_check_results(device_status_results)


def save_hourly_device_status_check_results(data, tenant):
    """
    """
    DeviceStatusModel =  DeviceStatus.DeviceStatus(tenant)
    for i in data:
        print(i)
        DeviceStatusModel.device_status_hourly_check_results.insert_one(i)
        print('saved')


if __name__ == '__main__':
    get_device_channel_status()

