import json
from datetime import timedelta

import pandas as pd

from config import configuration
from date import date_to_str
from utils import build_channel_id_filter, get_valid_devices, get_airqo_device_data, get_devices_or_sites, \
    get_column_value, \
    get_device


def clean_airqo_data(data, devices):
    transformed_data = []

    columns = data.columns

    for _, data_row in data.iterrows():
        device = get_device(devices, channel_id=data_row["channel_id"])
        if not device:
            continue

        device_data = dict({
            "device": device.get("name", ""),
            "device_id": device.get("_id", ""),
            "site_id": device.get("site").get("_id"),
            "device_number": data_row["channel_id"],
            "tenant": "airqo",
            "location": {
                "latitude": {"value": get_column_value("latitude", data_row, columns, "latitude")},
                "longitude": {"value": get_column_value("longitude", data_row, columns, "longitude")}
            },
            "frequency": "raw",
            "time": pd.Timestamp(data_row["created_at"]).isoformat(),
            "pm2_5": {"value": get_column_value("pm2_5", data_row, columns, "pm2_5")},
            "pm10": {"value": get_column_value("pm10", data_row, columns, "pm10")},
            "s2_pm2_5": {"value": get_column_value("s2_pm2_5", data_row, columns, "s2_pm2_5")},
            "s2_pm10": {"value": get_column_value("s2_pm10", data_row, columns, "s2_pm10")},
            "battery": {"value": get_column_value("voltage", data_row, columns, "battery")},
            "altitude": {"value": get_column_value("altitude", data_row, columns, "altitude")},
            "speed": {"value": get_column_value("wind", data_row, columns, "speed")},
            "satellites": {"value": get_column_value("no_sats", data_row, columns, "satellites")},
            "hdop": {"value": get_column_value("hdope", data_row, columns, "hdop")},
            "externalTemperature": {"value": get_column_value("temperature", data_row, columns,
                                                              "externalTemperature")},
            "externalHumidity": {"value": get_column_value("humidity", data_row, columns, "externalHumidity")},
        })

        transformed_data.append(device_data)

    return transformed_data


def add_weather_data(input_file, output_file, frequency):
    # TODO implement addition of weather values
    data = pd.read_csv(input_file)
    measurements = pd.DataFrame(data)
    measurements.to_csv(path_or_buf=output_file, index=False)
    return


def clean_airqo_measurements(input_file, output_file):
    data = pd.read_csv(input_file)
    if data.empty:
        print("No Data for cleaning")
        data.to_csv(output_file, index=False)
        return

    devices = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'airqo')
    cleaned_data = clean_airqo_data(data, devices)

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_data, f, ensure_ascii=False, indent=4)


def retrieve_airqo_raw_measurements(start_time, end_time, output_file):
    valid_devices = get_valid_devices(configuration.AIRQO_BASE_URL, 'airqo')

    channel_ids = build_channel_id_filter(valid_devices)

    dates = pd.date_range(start_time, end_time, freq='12H')
    measurements = []

    for date in dates:
        start_time = date_to_str(date)
        end_time = date_to_str(date + timedelta(hours=int(2)))

        print(start_time + " : " + end_time)

        range_measurements = get_airqo_device_data(start_time, end_time, channel_ids)
        measurements.extend(range_measurements)

    measurements_df = pd.DataFrame(measurements)
    measurements_df.to_csv(path_or_buf=output_file, index=False)
    return
