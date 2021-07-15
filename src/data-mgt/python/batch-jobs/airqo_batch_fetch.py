import json
import os
from datetime import datetime, timedelta

import pandas as pd
from google.cloud import bigquery

from config import Config
from date import str_to_date
from kafka_client import KafkaWithoutRegistry
from utils import filter_valid_devices, get_devices, build_channel_id_filter

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"


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

    interval = f"{Config.TIME_INTERVAL}H"

    dates = pd.date_range(Config.START_TIME, Config.END_TIME, freq=interval)

    for date in dates:

        start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
        end_time = datetime.strftime(date + timedelta(hours=int(Config.TIME_INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

        print(start_time + " : " + end_time)

        device_measurements_data = get_airqo_device_data(start_time, end_time, devices)

        transform_airqo_data(device_measurements_data, devices)


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
        device_data = data.loc[data['channel_id'] == int(device.get("device_number", "0"))]

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
            n = int(Config.INSERTION_INTERVAL)
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                kafka = KafkaWithoutRegistry(boot_strap_servers=Config.BOOT_STRAP_SERVERS, topic=Config.OUTPUT_TOPIC)
                kafka.produce(json.dumps(sub_list))


if __name__ == "__main__":
    airqo_devices = get_devices(Config.DEVICE_REGISTRY_URL, "airqo")
    filtered_devices = filter_valid_devices(airqo_devices)
    
    if len(filtered_devices) > 0:
        get_device_measurements(filtered_devices)
    else:
        print("No valid devices")
