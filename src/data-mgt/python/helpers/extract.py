from datetime import datetime, timedelta
import os
import pandas as pd
import requests
from threading import Thread
from insert import single_component_insertion, get_component_details
from convert_dates import date_to_str2
import numpy as np

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
PROCESSED_DATA_PUB_SUB_TOPIC = os.getenv("PROCESSED_DATA_PUB_SUB_TOPIC")
CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
RAW_DATA_PUB_SUB_TOPIC = os.getenv("RAW_DATA_PUB_SUB_TOPIC")


def get_kcca_device_data():
    """
    :return: current kcca device measurements
    """

    # get current date and time 5 minutes ago : %Y-%m-%dT%H:%M:%SZ
    # the cron job must be scheduled to run as the time interval stated here
    date = date_to_str2(datetime.now() - timedelta(hours=0, minutes=5))

    # get kcca devices
    device_codes = get_kcca_devices_codes()

    # compose a url to get device measurements for all the devices
    api_url = CLARITY_API_BASE_URL + "measurements?startTime=" + date + "&code="

    for code in device_codes:
        api_url = api_url + code + ","

    api_url = api_url[:-1]

    # get the device measurements
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    results = requests.get(api_url, headers=headers)

    return results.json()


def get_kcca_devices_codes():
    """
    gets all kcca devices
    :return: list of device codes
    """
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    api_url = CLARITY_API_BASE_URL + "devices"
    results = requests.get(api_url, headers=headers)

    device_data = pd.DataFrame(results.json())

    device_codes = []

    for index, row in device_data.iterrows():
        device_codes.append(row['code'])

    return device_codes
