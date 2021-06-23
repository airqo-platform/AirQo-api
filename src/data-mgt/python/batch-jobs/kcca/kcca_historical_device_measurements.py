import json
import os
from datetime import datetime, timedelta

import pandas as pd
import requests

from kafkaRegistry import KafkaOnRegistry, Kafka

CLARITY_API_KEY = os.getenv("CLARITY_API_KEY", None)
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL", "https://clarity-data-api.clarity.io/v1/")
DEVICE_REGISTRY_URL = os.getenv("DEVICE_REGISTRY_PRODUCTION_URL", "https://staging-platform.airqo.net/api/v1/")
FREQUENCY = os.getenv("FREQUENCY", "raw")
START_TIME = os.getenv("START_TIME", "2019-09-01")
END_TIME = os.getenv("END_TIME", "2021-12-31")
INTERVAL = os.getenv("INTERVAL", "1")
os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"

BOOT_STRAP_SERVERS = os.getenv("BOOT_STRAP_SERVERS", "127.0.0.1:9092")
TOPIC = os.getenv("TOPIC", "quickstart-events")
SCHEMA_REGISTRY = os.getenv("SCHEMA_REGISTRY", "127.0.0.1:8081")

"""
:Api Documentation: https://api-guide.clarity.io/
"""


def get_kcca_device_measurements():

    interval = INTERVAL + "H"

    dates = pd.date_range(START_TIME, END_TIME, freq=interval)

    for date in dates:

        start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
        end_time = datetime.strftime(date + timedelta(hours=int(INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

        print(start_time + " : " + end_time)

        # get all kcca device measurements
        # device_measurements_data = get_kcca_device_data(start_time, end_time)
        #
        # # process all kcca device measurements
        # transform_kcca_data(device_measurements_data)


def get_kcca_device_data(start_time, end_time):

    """
    :return: current kcca device measurements
    """
    api_url = f"{CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}"

    frequency = FREQUENCY.strip().lower()
    if frequency == "hour":
        api_url = f"{api_url}&average=hour"
    elif frequency == "day":
        api_url = f"{api_url}&average=day"
    else:
        pass

    # get the device measurements
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    results = requests.get(api_url, headers=headers)
    if results.status_code != 200:
        print(f"{results}")
        return []
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
    devices = get_kcca_devices()
    for name, group in device_groups:
        transform_group_plain(group, devices)


def transform_group_plain(group, devices):

    device_name = group.iloc[0]['deviceCode']
    site_id = get_site_id(device_name, devices)
    transformed_data = []

    # loop through the device measurements, transform and insert
    for index, row in group.iterrows():

        row_data = row

        row_data["average"] = row.get("average", "raw")
        row_data["tenant"] = 'kcca'
        row_data["channelID"] = row.get("deviceCode", None)
        row_data["site_id"] = site_id

        transformed_data.append(row_data.to_json())

    if transformed_data:
        n = 20
        sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

        for sub_list in sub_lists:
            # print(sub_list)
            # kafka = KafkaRegistry(boot_strap_servers=BOOT_STRAP_SERVERS, topic=TOPIC, schema_registry_url=SCHEMA_REGISTRY)
            kafka = Kafka(boot_strap_servers=BOOT_STRAP_SERVERS, topic=TOPIC)
            kafka.produce(json.dumps(sub_list))


def transform_group(group, devices):

    device_name = group.iloc[0]['deviceCode']
    site_id = get_site_id(device_name, devices)
    transformed_data = []

    # loop through the device measurements, transform and insert
    for index, row in group.iterrows():

        location = row["location"]["coordinates"]

        frequency = row.get("average", "raw")

        time = str(row.get("time"))

        if frequency == "hour":
            frequency = "hourly"
            # time = time.replace("00:00.000Z", "59:00.000Z")

        if frequency == "day":
            frequency = "daily"
            # time = time.replace("00:00:00.000Z", "23:59:00.000Z")

        row_data = dict({
            'frequency': frequency,
            'time': time,
            'tenant': 'kcca',
            'channelID': row["deviceCode"],
            'site_id': site_id,
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
        n = 20
        sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

        for sub_list in sub_lists:
            kafka = KafkaOnRegistry(boot_strap_servers=BOOT_STRAP_SERVERS, topic=TOPIC, schema_registry_url=SCHEMA_REGISTRY)
            kafka.produce("", sub_list)


def get_site_id(name, devices):

    result = list(filter(lambda device: (device["name"] == name), devices))
    if result is not None:
        return result[0]["site_id"]
    return None


def get_kcca_devices():
    """
    gets all kcca devices from netmanager
    :return: list of devices
    """
    api_url = DEVICE_REGISTRY_URL + "devices?tenant=kcca&active=yes"
    results = requests.get(api_url, verify=False)

    if results.status_code != 200:
        return []

    device_data = pd.DataFrame(results.json()["devices"])

    devices = []

    for index, row in device_data.iterrows():
        try:
            devices.append({
                "name": row['name'],
                 "site_id": row['site']["_id"] if 'site' in row else None
            })
        except KeyError:
            pass

    return devices


if __name__ == "__main__":
    get_kcca_device_measurements()
