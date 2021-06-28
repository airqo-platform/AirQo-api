import json
import os
from datetime import datetime, timedelta

import pandas as pd
import requests
from google.cloud import bigquery
from kafkaRegistry import Kafka

DEVICE_REGISTRY_URL = os.getenv("DEVICE_REGISTRY_URL")
START_TIME = os.getenv("START_TIME", "2021-01-01")
END_TIME = os.getenv("END_TIME", "2021-01-02")
INTERVAL = os.getenv("INTERVAL", "1")
os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"

BOOT_STRAP_SERVERS = os.getenv("BOOT_STRAP_SERVERS", "34.123.249.54:31000")
TOPIC = os.getenv("TOPIC", "airqo-raw-device-measurements-topic")


class DataConstants:
    DEVICE = "device"
    CHANNEL_ID = "channelID"
    LATITUDE = "latitude"
    LONGITUDE = "longitude"
    FREQUENCY = "frequency"
    TIME = "created_at"
    PM2_5 = "pm2_5"
    PM10 = "pm10"
    S2_PM2_5 = "s2_pm2_5"
    S2_PM10 = "s2_pm10"
    BATTERY = "battery"
    ALTITUDE = "altitude"
    SPEED = "speed"
    SATELLITES = "satellites"
    HDOP = "hdop"
    INTERNAL_TEMP = "internalTemperature"
    INTERNAL_HUM = "internalHumidity"
    EXTERNAL_TEMP = "externalTemperature"
    EXTERNAL_HUM = "ExternalHumidity"
    EXTERNAL_PRESSURE = "ExternalPressure"


def get_device_measurements(devices):

    interval = INTERVAL + "H"

    dates = pd.date_range(START_TIME, END_TIME, freq=interval)

    for date in dates:

        start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
        end_time = datetime.strftime(date + timedelta(hours=int(INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

        print(start_time + " : " + end_time)

        device_measurements_data = get_airqo_device_data(start_time, end_time, devices)

        transform_airqo_data(device_measurements_data, devices)


def get_airqo_devices():
    api_url = DEVICE_REGISTRY_URL + "devices?tenant=airqo&active=yes"

    results = requests.get(api_url)

    if results.status_code == 200:
        response_data = results.json()

        if "devices" not in response_data:
            print("Error : Device Registry didnt return any devices")
            return []
        return response_data["devices"]
    else:
        print(f"Device Registry failed to return airqo devices. Status Code : {str(results.status_code)}")
        return []


def filter_valid_devices(devices_data):
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
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('channelID')}"

    return channel_filter


def str_to_date(string):
    return datetime.strptime(string, '%Y-%m-%dT%H:%M:%SZ').isoformat()


def get_airqo_device_data(start_time, end_time, devices):
    client = bigquery.Client()

    query = """
             SELECT channel_id, created_at, pm2_5, pm10 , s2_pm2_5,
              s2_pm10, temperature , humidity, voltage, altitude, latitude, longitude, no_sats, hdope, wind 
              FROM airqo-250220.thingspeak.clean_feeds_pms where ({0}) 
              AND created_at BETWEEN '{1}' AND '{2}'
                """.format(build_channel_id_filter(devices), str_to_date(start_time), str_to_date(end_time))

    dataframe = (
        client.query(query).result().to_dataframe()
    )

    return dataframe


def to_str(value):
    return f"{value}"


def transform_airqo_data(data, devices):

    for device in devices:
        transformed_data = []
        device = dict(device)
        device_data = data.loc[data['channel_id'] == int(device.get("channelID", "0"))]

        for index, device_row in device_data.iterrows():
            device_data = dict({

                DataConstants.DEVICE: to_str(device.get("name", "")),
                DataConstants.CHANNEL_ID: to_str(device_row["channel_id"]),
                DataConstants.LATITUDE: to_str(device_row["latitude"]),
                DataConstants.LONGITUDE: to_str(device_row["longitude"]),
                DataConstants.FREQUENCY: "raw",
                DataConstants.TIME: pd.Timestamp(device_row["created_at"]).isoformat(),
                DataConstants.PM2_5: to_str(device_row["pm2_5"]),
                DataConstants.PM10: to_str(device_row["pm10"]),
                DataConstants.S2_PM2_5: to_str(device_row["s2_pm2_5"]),
                DataConstants.S2_PM10: to_str(device_row["s2_pm10"]),
                DataConstants.BATTERY: to_str(device_row["voltage"]),
                DataConstants.ALTITUDE: to_str(device_row["altitude"]),
                DataConstants.SPEED: to_str(device_row["wind"]),
                DataConstants.SATELLITES: to_str(device_row["no_sats"]),
                DataConstants.HDOP: to_str(device_row["hdope"]),
                DataConstants.INTERNAL_TEMP: to_str(device_row["temperature"]),
                DataConstants.INTERNAL_HUM: to_str(device_row["humidity"]),
            })

            transformed_data.append(device_data)

        if transformed_data:
            n = 20
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                kafka = Kafka(boot_strap_servers=BOOT_STRAP_SERVERS, topic=TOPIC)
                kafka.produce(json.dumps(sub_list))


if __name__ == "__main__":
    airqo_devices = get_airqo_devices()
    filtered_devices = filter_valid_devices(airqo_devices)
    get_device_measurements(filtered_devices)
