from datetime import datetime
import os
import pandas as pd
import requests
from threading import Thread
from device_registry import single_component_insertion, get_component_details
from helpers import date_to_str2
import numpy as np

GOOGLE_CLOUD_PROJECT = os.getenv("GOOGLE_CLOUD_PROJECT")
PROCESSED_DATA_PUB_SUB_TOPIC = os.getenv("PROCESSED_DATA_PUB_SUB_TOPIC")
CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
RAW_DATA_PUB_SUB_TOPIC = os.getenv("RAW_DATA_PUB_SUB_TOPIC")


def process_kcca_device_data():

    # get all kcca device measurements
    device_measurements_data = get_kcca_device_data()

    print(device_measurements_data)

    # process all kcca device measurements
    process_kcca_data(device_measurements_data)


def get_kcca_device_data():

    """
    :return: current kcca device measurements
    """

    # get current date : %Y-%m-%dT%H:%M:%SZ
    date = date_to_str2(datetime.now())

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


def process_kcca_data(data):

    # create a dataframe to hold all the device measurements
    raw_data = pd.DataFrame(data)

    # divide the dataframe into chucks of ten
    chunks = np.array_split(raw_data, 10)

    threads = []

    # process each chuck on a separate thread
    for chunk in chunks:
        print(chunk)
        thread = Thread(target=process_chunk, args=(chunk,))
        threads.append(thread)
        thread.start()

    # wait for all threads to terminate before ending the function
    for thread in threads:
        thread.join()


def process_chunk(chunk):

    # create a dataframe to hold the chunk
    data = pd.DataFrame(chunk)

    # create a list to hold all processed data
    devices_components_data = []

    # create a to hold all threads
    threads = []

    # loop through the devices in the chunk
    for index, row in data.iterrows():

        device_code = row["deviceCode"]

        device_time = row["time"]

        # create a dataframe to hold the device components
        device_components = pd.Series(row["characteristics"])

        processed_device_components = []

        # loop through each component on the device
        for component_type in device_components.keys():

            # get the component details
            try:
                component_details = get_component_details(device_code, component_type, "kcca")
            except Exception as e:
                print(e)
                continue

            # compose a post body for the component details
            component_data = dict({
                'device': device_code,
                'component': component_details[0]["name"],
                'value': device_components[component_type]["value"],
                'raw': device_components[component_type]["raw"],
                'weight': device_components[component_type]["weight"],
                'frequency': "day",
                'calibratedValue': device_components[component_type]["calibratedValue"]
                if "calibratedValue" in device_components[component_type].keys() else "23",
                'time': device_time,
                'uncertaintyValue': "23",
                'standardDeviationValue': "23",
                'measurement': {
                    "quantityKind": component_details[0]["measurement"][0]["quantityKind"],
                    "measurementUnit": component_details[0]["measurement"][0]["measurementUnit"]}})

            # append the component details to the list of processed device components
            processed_device_components.append(component_data)

            # post the component data to events table using a separate thread
            # :function: single_component_insertion(args=(component data, tenant))
            thread = Thread(target=single_component_insertion, args=(component_data, "kcca",))
            threads.append(thread)
            thread.start()

        # append the processed device data to list of processed devices
        devices_components_data.append(processed_device_components)

    # wait for all threads to terminate before ending the function
    for thread in threads:
        thread.join()
