import pandas as pd
import requests
from threading import Thread

from events import DeviceRegistry
import numpy as np
import os
import math

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_STAGING_URL")
FEEDS_BASE_URL = os.getenv("FEEDS_BASE_URL")
CALIBRATE_URL = os.getenv("CALIBRATE_URL")


def get_airqo_device_measurements():
    # get all airqo devices
    devices = get_airqo_devices()

    # get feeds for the devices
    feeds = get_feeds(devices)

    # transform feeds and insert into netmanager
    transform_airqo_data(feeds)


def get_feeds(device_codes):
    """
    :return: feeds
    """

    devices = pd.DataFrame(device_codes)

    data = []

    for index, row in devices.iterrows():

        channel_id = row['channelID']

        api_url = FEEDS_BASE_URL + "data/feeds/transform/recent?channel={}".format(channel_id)

        try:
            results = requests.get(api_url)
        except Exception as ex:
            print("Feeds Url returned an error")
            print(ex)
            continue

        if results.status_code != 200:
            continue

        response = results.json()
        response["channelID"] = channel_id
        response["device"] = row['name']

        data.append(response)

    return data


def transform_airqo_data(data):

    # create a dataframe to hold all the data
    raw_data = pd.DataFrame(data)

    # divide the dataframe into chucks of ten
    chunks = np.array_split(raw_data, 10)

    threads = []

    # process each chuck on a separate thread
    for chunk in chunks:
        thread = Thread(target=transform_chunk, args=(chunk,))
        threads.append(thread)
        thread.start()

    # wait for all threads to terminate before ending the function
    for thread in threads:
        thread.join()


def check_float(string):
    # formatting all values to float else None
    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


def get_calibrated_value(channel_id, time, value):

    data = {
        "datetime": time,
        "raw_values": [
            {
                "raw_value": value,
                "sensor_id": channel_id
            }
        ]
    }

    try:
        post_request = requests.post(url=CALIBRATE_URL, json=data)
    except Exception as ex:
        print("Calibrate Url returned an error")
        print(ex)
        return None

    if post_request.status_code != 200:
        return None

    response = post_request.json()

    calibrated_value = None

    for result in response:
        if "calibrated_value" in result:
            calibrated_value = result["calibrated_value"]
            break

    return calibrated_value


def transform_chunk(chunk):
    # create a dataframe to hold the chunk
    data = pd.DataFrame(chunk)

    # loop through the devices in the chunk
    for index, row in data.iterrows():

        device_name = row['device']

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

        # add calibrated value
        # calibrated_value = None
        #
        # if data["pm2_5"]["value"] is not None:
        #     calibrated_value = get_calibrated_value(data["channelID"], data["time"], data["pm2_5"]["value"])
        #
        # if calibrated_value is not None:
        #     data["pm2_5"]["calibratedValue"] = calibrated_value

        # insert device measurements into events collection
        device_registry = DeviceRegistry([data], "airqo", device_name)
        device_registry.insert_measurements()


def get_airqo_devices():
    """
    gets all airqo devices
    :return: list of devices
    """
    api_url = DEVICE_REGISTRY_BASE_URL + "devices?tenant=airqo"

    results = requests.get(api_url)

    if results.status_code == 200:
        response_data = results.json()

        if "devices" not in response_data:
            print("Error : Device Registry didnt return any devices")
            return {}
        devices = response_data["devices"]
        return devices
    else:
        print("Device Registry failed to return airqo devices. Status Code : " + str(results.status_code))
        return {}


if __name__ == "__main__":
    get_airqo_device_measurements()


