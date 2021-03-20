import pandas as pd
import requests
from threading import Thread
from device_registry import events_collection_insertion
import numpy as np
import os
import math

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
FEEDS_BASE_URL = os.getenv("FEEDS_BASE_URL")


def process_airqo_device_data():
    # get all airqo devices
    device_data = get_airqo_devices()

    # get feeds
    feeds = get_feeds(device_data)

    # transform feeds and insert into netmanager
    process_airqo_data(feeds)


def get_feeds(device_codes):
    """
    :return: feeds
    """

    devices = pd.DataFrame(device_codes)

    data = []

    for index, row in devices.iterrows():

        channel_id = row['channelID']

        api_url = FEEDS_BASE_URL + "data/feeds/transform/recent?channel={}".format(channel_id)

        results = requests.get(api_url)

        if results.status_code != 200:
            continue

        response = results.json()
        response["channelID"] = channel_id
        response["device"] = row['name']

        data.append(response)

    return data


def process_airqo_data(data):

    # create a dataframe to hold all the data
    raw_data = pd.DataFrame(data)

    # divide the dataframe into chucks of ten
    chunks = np.array_split(raw_data, 10)

    threads = []

    # process each chuck on a separate thread
    for chunk in chunks:
        thread = Thread(target=process_chunk, args=(chunk,))
        threads.append(thread)
        thread.start()

    # wait for all threads to terminate before ending the function
    for thread in threads:
        thread.join()


def check_float(string):
    # formatting all values to float else null
    try:
        value = float(string)
        if math.isnan(value):
            return 'null'
        return value
    except Exception:
        return 'null'


def process_chunk(chunk):
    # create a dataframe to hold the chunk
    data = pd.DataFrame(chunk)

    # create a to hold all threads
    threads = []

    # loop through the devices in the chunk
    for index, row in data.iterrows():

        # print(row.keys())

        data = dict({
            "device": row['device'],
            "channelID": row["channelID"],
            "frequency": "minute",
            "time": row["created_at"],
            "pm2_5": {"value": check_float(row["pm2_5"])},
            "pm10": {"value": check_float(row["pm10"])},
            "s2_pm2_5": {"value": check_float(row["s2_pm2_5"])},
            "s2_pm10": {"value": check_float(row["s2_pm10"])},
            "location": {"latitude": {"value": check_float(row["latitude"])},
                         "longitude": {"value": check_float(row["longitude"])}},
            "battery": {"value": check_float(row["battery"])},
            "altitude": {"value": check_float(row["altitude"])},
            "speed": {"value": check_float(row["speed"])},
            "satellites": {"value": check_float(row["satellites"])},
            "hdop": {"value": check_float(row["hdop"])},
            "internalTemperature": {"value": check_float(row["internalTemperature"])},
            "internalHumidity": {"value": check_float(row["internalHumidity"])},
        })

        # post the component data to events table using a separate thread
        # :function: single_component_insertion(args=(component data, tenant))
        thread = Thread(target=events_collection_insertion, args=(data, "airqo",))
        threads.append(thread)
        thread.start()

        # print(data)

    # wait for all threads to terminate before ending the function
    for thread in threads:
        thread.join()


def get_airqo_devices():
    """
    gets all airqo devices
    :return: list of devices
    """
    api_url = AIRQO_API_BASE_URL + "devices?tenant=airqo"

    results = requests.get(api_url)

    response_data = results.json()

    devices = response_data["devices"]

    return devices


if __name__ == "__main__":
    process_airqo_device_data()


