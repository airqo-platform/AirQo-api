import json
import math
# from datetime import datetime
from datetime import timedelta, date, datetime
from config import configuration
import pandas as pd
import requests
import os
from pathlib import Path
from google.cloud import bigquery

from date import str_to_date

# BASE_DIR = Path(__file__).resolve().parent
# dotenv_path = os.path.join(BASE_DIR, '.env')
# load_dotenv(dotenv_path)


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
    file = open(input_file)
    base_url = configuration.AIRQO_BASE_URL
    data = json.load(file)

    for i in range(0, len(data), int(configuration.POST_EVENTS_BODY_SIZE)):
        json_data = json.dumps(data[i:i + int(configuration.POST_EVENTS_BODY_SIZE)])
        print(json_data)
        try:
            headers = {'Content-Type': 'application/json'}
            url = base_url + "devices/events?tenant=" + tenant
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


def get_column_value(column_name, series, columns_names):
    if column_name in columns_names:
        return to_double(series[column_name])
    return None


def clean_up_task(list_of_files):
    for item in list_of_files:
        try:
            os.remove(item)
        except Exception as ex:
            print(ex)


def get_airqo_device_data(start_time, end_time, channel_ids):
    # print(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))
    # client = bigquery.Client()
    #
    # query = """
    #          SELECT channel_id, created_at, pm2_5, pm10 , s2_pm2_5,
    #           s2_pm10, temperature , humidity, voltage, altitude, latitude, longitude, no_sats, hdope, wind
    #           FROM airqo-250220.thingspeak.clean_feeds_pms where ({0})
    #           AND created_at BETWEEN '{1}' AND '{2}'
    #             """.format(channel_ids, str_to_date(start_time), str_to_date(end_time))
    #
    # dataframe = (
    #     client.query(query).result().to_dataframe()
    # )

    return [{'name': 'noah', 'tribe': 'mutooro'}, {'name': 'peter', 'tribe': 'mutooro'}]

    # return dataframe.to_dict(orient='records')


def get_devices(base_url, tenant):

    api_url = f"{base_url}devices?tenant={tenant}&active=yes"
    headers = {'x-api-key': ''}

    results = requests.get(api_url, headers=headers, verify=False)

    if results.status_code != 200:
        print(results.content)
        return []

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


def build_channel_id_filter(devices_data):
    channel_filter = "channel_id = 0"
    for device in devices_data:
        device_dict = dict(device)
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('device_number')}"

    return channel_filter


def get_valid_devices(base_url, tenant):
    devices = get_devices(base_url, tenant)
    filtered_devices = filter_valid_devices(devices)
    return filtered_devices


class DeviceRegistry:
    def __init__(self, data, tenant, url) -> None:
        self.json_data = json.dumps(data)
        self.tenant = tenant
        self.base_url = url

    def send_to_api(self):
        self.events_collection_insertion()

    def events_collection_insertion(self):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events?tenant=" + self.tenant

            results = requests.post(url, self.json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print(f"Device registry failed to insert values. Status Code : {results.status_code}")
                print(f"Response : {results.content}")
                print(f"Request Url : {url}")
                print(f"Request body : {self.json_data}")
        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))