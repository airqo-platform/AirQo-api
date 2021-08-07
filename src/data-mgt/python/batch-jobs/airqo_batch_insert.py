import os
from datetime import timedelta

import pandas as pd
from google.cloud import bigquery

from config import configuration as config
from date import str_to_date, date_to_str
from event import DeviceRegistry
from utils import build_channel_id_filter

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"


class DataConstants:
    DEVICE = "device"
    DEVICE_ID = "device_id"
    TENANT = "tenant"
    SITE_ID = "site_id"
    DEVICE_NUMBER = "device_number"
    LATITUDE = "latitude"
    LONGITUDE = "longitude"
    FREQUENCY = "frequency"
    TIME = "time"
    LOCATION = "location"
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
    EXTERNAL_HUM = "externalHumidity"
    EXTERNAL_PRESSURE = "externalPressure"


def get_device_measurements(devices):
    interval = config.BATCH_FETCH_TIME_INTERVAL + "H"

    dates = pd.date_range(config.START_TIME, config.END_TIME, freq=interval)

    for date in dates:
        start_time = date_to_str(date)
        end_time = date_to_str(date + timedelta(hours=int(config.BATCH_FETCH_TIME_INTERVAL)))

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


def transform_airqo_data(data, devices):
    for device in devices:
        transformed_data = []
        device = dict(device)
        device_data = data.loc[data['channel_id'] == int(device.get("device_number", "0"))]

        for _, device_row in device_data.iterrows():
            device_data = dict({
                DataConstants.DEVICE: device.get("name", ""),
                DataConstants.DEVICE_ID: device.get("_id", ""),
                DataConstants.SITE_ID: device.get("site").get("_id"),
                DataConstants.DEVICE_NUMBER: device_row["channel_id"],
                DataConstants.TENANT: "airqo",
                DataConstants.LOCATION: {"latitude":
                                             {"value": device_row["latitude"]},
                                         "longitude":
                                             {"value": device_row["longitude"]}
                                         },
                DataConstants.FREQUENCY: "raw",
                DataConstants.TIME: pd.Timestamp(device_row["created_at"]).isoformat(),
                DataConstants.PM2_5: {"value": device_row["pm2_5"]},
                DataConstants.PM10: {"value": device_row["pm10"]},
                DataConstants.S2_PM2_5: {"value": device_row["s2_pm2_5"]},
                DataConstants.S2_PM10: {"value": device_row["s2_pm10"]},
                DataConstants.BATTERY: {"value": device_row["voltage"]},
                DataConstants.ALTITUDE: {"value": device_row["altitude"]},
                DataConstants.SPEED: {"value": device_row["wind"]},
                DataConstants.SATELLITES: {"value": device_row["no_sats"]},
                DataConstants.HDOP: {"value": device_row["hdope"]},
                DataConstants.INTERNAL_TEMP: {"value": device_row["temperature"]},
                DataConstants.INTERNAL_HUM: {"value": device_row["humidity"]},
            })

            transformed_data.append(device_data)

        if transformed_data:
            n = int(config.BATCH_OUTPUT_SIZE)
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                device_registry = DeviceRegistry(sub_list, "airqo", config.AIRQO_BASE_URL)
                device_registry.send_to_api()
