import os
from datetime import timedelta

import pandas as pd
from google.cloud import bigquery

from config import configuration as config
from date import str_to_date, date_to_str
from utils import build_channel_id_filter, to_float, DeviceRegistry

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"


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
        data_df = data.loc[data['channel_id'] == int(device.get("device_number", "0"))]

        for _, data_row in data_df.iterrows():
            device_data = dict({
                "device": device.get("name", ""),
                "device_id": device.get("_id", ""),
                "site_id": device.get("site").get("_id"),
                "device_number": data_row["channel_id"],
                "tenant": "airqo",
                "location": {
                    "latitude": {"value": to_float(data_row["latitude"])},
                    "longitude": {"value": to_float(data_row["longitude"])}
                },
                "frequency": "raw",
                "time": pd.Timestamp(data_row["created_at"]).isoformat(),
                "pm2_5": {"value": to_float(data_row["pm2_5"])},
                "pm10": {"value": to_float(data_row["pm10"])},
                "s2_pm2_5": {"value": to_float(data_row["s2_pm2_5"])},
                "s2_pm10": {"value": to_float(data_row["s2_pm10"])},
                "battery": {"value": to_float(data_row["voltage"])},
                "altitude": {"value": to_float(data_row["altitude"])},
                "speed": {"value": to_float(data_row["wind"])},
                "satellites": {"value": to_float(data_row["no_sats"])},
                "hdop": {"value": to_float(data_row["hdope"])},
                "internalTemperature": {"value": to_float(data_row["temperature"])},
                "internalHumidity": {"value": to_float(data_row["humidity"])},
            })

            transformed_data.append(device_data)

        if transformed_data:
            n = int(config.BATCH_OUTPUT_SIZE)
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                device_registry = DeviceRegistry(sub_list, "airqo", config.AIRQO_BASE_URL)
                device_registry.send_to_api()
