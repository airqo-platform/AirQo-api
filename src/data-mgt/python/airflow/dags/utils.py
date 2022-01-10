import json
import math
import os
from datetime import timedelta, datetime

import requests
import simplejson
from google.cloud import bigquery

from config import configuration
from date import str_to_date, date_to_str
from kafka_client import KafkaBrokerClient


def save_insights_data(insights_data=None, action="insert", start_time=datetime(year=2020, month=1, day=1),
                       end_time=datetime(year=2020, month=1, day=1)):
    if insights_data is None:
        insights_data = []

    print("saving insights .... ")

    data = {
        "data": insights_data,
        "action": action,
        "startTime": date_to_str(start_time),
        "endTime": date_to_str(end_time),
    }

    kafka = KafkaBrokerClient()
    kafka.send_data(info=data, topic=configuration.INSIGHTS_MEASUREMENTS_TOPIC)


def get_last_datetime(year, month):
    next_month = int(month) + 1
    next_year = int(year) + 1 if next_month > 12 else year
    next_month = 1 if next_month > 12 else next_month

    date_time = datetime(int(next_year), int(next_month), 1) - timedelta(days=1)

    return datetime.strftime(date_time, '%Y-%m-%dT00:00:00Z')


def get_first_datetime(year, month):
    month_value = 1 if int(month) > 12 else month
    date_time = datetime(int(year), int(month_value), 1)

    return datetime.strftime(date_time, '%Y-%m-%dT00:00:00Z')


def get_month(value):
    if value == 1:
        return "Jan"
    elif value == 2:
        return "Feb"
    elif value == 3:
        return "Mar"
    elif value == 4:
        return "Apr"
    elif value == 5:
        return "May"
    elif value == 6:
        return "Jun"
    elif value == 7:
        return "July"
    elif value == 8:
        return "Aug"
    elif value == 9:
        return "Sept"
    elif value == 10:
        return "Oct"
    elif value == 11:
        return "Nov"
    elif value == 12:
        return "Dec"
    else:
        Exception("Invalid month value")


def to_float(string):
    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


def save_measurements(input_file, tenant):
    # TODO Implement saving to API
    file = open(input_file)
    base_url = configuration.AIRQO_BASE_URL
    data = json.load(file)

    for i in range(0, len(data), int(configuration.POST_EVENTS_BODY_SIZE)):
        json_data = simplejson.dumps(data[i:i + int(configuration.POST_EVENTS_BODY_SIZE)])
        try:
            headers = {'Content-Type': 'application/json'}
            url = base_url + "devices/events?tenant=" + tenant
            print(json_data)
            print(url)

            # results = requests.post(url, json_data, headers=headers, verify=False)
            #
            # if results.status_code == 200:
            #     print(results.json())
            # else:
            #     print(f"Device registry failed to insert values. Status Code : {results.status_code}")
            #     print(f"Response : {results.content}")
            #     print(f"Request Url : {url}")
            #     print(f"Request body : {json_data}")
        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))


def to_double(x):
    try:
        value = float(x)
        if math.isnan(value):
            return None
        return value
    except Exception as ex:
        print(ex)
        return None


def get_column_value(column_name, series, columns_names, data_name=None):
    if column_name in columns_names:
        value = to_double(series[column_name])

        if not data_name or not value:
            return value

        if data_name == "pm2_5" or data_name == "s2_pm2_5" or data_name == "pm10" or data_name == "s2_pm10":
            if value < 1 or value > 1000:
                return None
        elif data_name == "latitude":
            if value < -90 or value > 90:
                return None
        elif data_name == "longitude":
            if value < -180 or value > 180:
                return None
        elif data_name == "battery":
            if value < 2.7 or value > 5:
                return None
        elif data_name == "altitude" or data_name == "hdop":
            if value < 0:
                return None
        elif data_name == "satellites":
            if value < 0 or value > 50:
                return None
        elif data_name == "externalTemperature":
            if value < 0 or value > 45:
                return None
        elif data_name == "externalHumidity":
            if value < 0 or value > 100:
                return None
        elif data_name == "pressure":
            if value < 30 or value > 110:
                return None
        else:
            return value

        return value
    return None


def clean_up_task(list_of_files):
    for item in list_of_files:
        try:
            os.remove(item)
        except Exception as ex:
            print(ex)


def get_site_and_device_id(devices, channel_id=None, device_name=None):
    try:
        if channel_id is not None:
            result = list(filter(lambda device: (device["device_number"] == channel_id), devices))
        elif device_name is not None:
            result = list(filter(lambda device: (device["name"] == device_name), devices))
        else:
            return None, None

        if not result:
            print("Device not found")
            return None, None

        return result[0]["site"]["_id"], result[0]["_id"]
    except Exception as ex:
        print(ex)
        print("Site ID not found")
        return None, None


def get_airqo_device_data(start_time, end_time, channel_ids):
    client = bigquery.Client()

    query = """
             SELECT channel_id, created_at, pm2_5, pm10 , s2_pm2_5,
              s2_pm10, temperature , humidity, voltage, altitude, latitude, longitude, no_sats, hdope, wind
              FROM airqo-250220.thingspeak.clean_feeds_pms where ({0})
              AND created_at BETWEEN '{1}' AND '{2}' ORDER BY created_at
                """.format(channel_ids, str_to_date(start_time), str_to_date(end_time))

    dataframe = (
        client.query(query).result().to_dataframe()
    )

    return dataframe.to_dict(orient='records')


def get_device(devices=None, channel_id=None):
    if devices is None:
        devices = []

    if channel_id:
        result = list(filter(lambda x: x["device_number"] == channel_id, devices))
        if not result:
            return None
        return result[0]

    return None


def get_devices_or_sites(base_url, tenant, sites=False):
    if sites:
        api_url = f"{base_url}devices/sites?tenant={tenant}"
    else:
        api_url = f"{base_url}devices?tenant={tenant}&active=yes"

    headers = {'x-api-key': ''}

    results = requests.get(api_url, headers=headers, verify=False)

    if results.status_code != 200:
        print(results.content)
        return []

    if sites:
        sites = list(results.json()["sites"])
        return sites
    else:
        devices = list(results.json()["devices"])
        return devices


def filter_valid_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys() and "device_number" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def filter_valid_kcca_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def handle_api_error(api_request):
    try:
        print(api_request.request.url)
        print(api_request.request.body)
    except Exception as ex:
        print(ex)
    finally:
        print(api_request.content)
        print('API request failed with status code %s' % api_request.status_code)


def build_channel_id_filter(devices_data):
    channel_filter = "channel_id = 0"
    for device in devices_data:
        device_dict = dict(device)
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('device_number')}"

    return channel_filter


def get_valid_devices(base_url, tenant):
    devices = get_devices_or_sites(base_url, tenant)
    filtered_devices = filter_valid_devices(devices)
    return filtered_devices
