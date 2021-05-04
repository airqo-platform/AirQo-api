import os
import pandas as pd
import requests
import json
from events import DeviceRegistry
from date import date_to_str2, date_to_str_hours
from datetime import datetime, timedelta

CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")

"""
:Api Documentation: https://api-guide.clarity.io/
"""


def get_kcca_device_measurements():

    # get all kcca device measurements
    device_measurements_data = get_kcca_device_data()

    # process all kcca device measurements
    transform_kcca_data(device_measurements_data)


def get_kcca_device_data():

    """
    :return: current kcca device measurements
    """

    # get current date and time an hour ago : %Y-%m-%dT%H:00:00Z
    start_time = date_to_str_hours(datetime.now() - timedelta(hours=2))

    # compose url to get device measurements for all the devices
    api_url = f"{CLARITY_API_BASE_URL}measurements?startTime={start_time}&average=hour"

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


def transform_kcca_data(data):

    # create a dataframe to hold all the device measurements
    raw_data = pd.DataFrame(data)

    if raw_data.empty:
        print("No Data at the moment")
        print(raw_data)
        return

    # group data by device names for bulk transform and insertion
    device_groups = raw_data.groupby('deviceCode')

    for name, group in device_groups:
        transform_group(group)


def transform_group(group):

    device_name = group.iloc[0]['deviceCode']
    transformed_data = []

    # loop through the device measurements, transform and insert
    for index, row in group.iterrows():

        location = row["location"]["coordinates"]

        row_data = dict({
            'frequency': "hourly",
            'time': row["time"],
            'device':  row["deviceCode"],
            'location': dict({
                "longitude": dict({"value":  location[0]}), "latitude": {"value": location[1]}})
        })

        # create a series to hold the device components
        device_components = pd.Series(row["characteristics"])

        # loop through each component on the device
        for component_type in device_components.keys():

            conversion_units = dict({
                "temperature": "internalTemperature",
                "relHumid": "internalHumidity",
                "pm10ConcMass": "pm10",
                "pm2_5ConcMass": "pm2_5",
                "no2Conc": "no2",
                "pm1ConcMass": "pm1"

            })

            try:

                row_data[conversion_units[component_type]] = dict({
                    'value': device_components[component_type]["raw"]
                })

            except KeyError:
                continue

            if "calibratedValue" in device_components[component_type].keys():
                row_data[conversion_units[component_type]]['calibratedValue'] = device_components[component_type]["calibratedValue"]
            else:
                row_data[conversion_units[component_type]]['calibratedValue'] = device_components[component_type]["value"]

            transformed_data.append(row_data)

    if transformed_data:
        device_registry = DeviceRegistry(transformed_data, 'kcca', device_name)
        device_registry.insert_measurements()


def get_kcca_devices():
    """
    gets all kcca devices
    :return: list of devices
    """
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    api_url = f"{CLARITY_API_BASE_URL}devices"

    results = requests.get(api_url, headers=headers)

    device_data = pd.DataFrame(results.json())

    devices = []

    for index, row in device_data.iterrows():

        try:
            location = row['location']['coordinates']

            device = dict({
                "channelID": row['code'],
                "name": row['code'],
                "createdAt": row['workingStartAt'],
                "longitude": location[0],
                "latitude": location[1],
                "device_manufacturer": 'CLARITY',
                "isActive": True,
                "visibility": True,
                "owner": "KCCA",
                "description": "Particulate Matter and NO2 monitor",
                "product_name": "NODE - S"
            })

        except Exception as ex:
            print(ex)
            continue

        devices.append(device)

    return json.dumps(devices)


if __name__ == "__main__":
    get_kcca_device_measurements()
