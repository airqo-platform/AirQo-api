from datetime import timedelta

import pandas as pd
import requests
import simplejson

from config import configuration
from date import date_to_str_hours
from utils import get_devices_or_sites, get_column_value, to_double, get_site_and_device_id


def clean_group(group, site_id, device_id):
    transformed_data = []
    columns = group.columns

    for index, row in group.iterrows():

        location = str(row["location.coordinates"])
        location = location.replace('[', '').replace(']', '')
        location_coordinates = location.split(",")

        frequency = str(row.get("outputFrequency", "raw"))

        if frequency.lower() == "hour":
            frequency = "hourly"
        elif frequency.lower() == "day":
            frequency = "daily"
        else:
            frequency = "raw"

        row_data = dict({
            "frequency": frequency,
            "time": row.get("time"),
            "tenant": "kcca",
            "site_id": site_id,
            "device_id": device_id,
            "device": row["deviceCode"],
            "location": dict({
                "longitude": dict({"value": to_double(location_coordinates[0])}),
                "latitude": dict({"value": to_double(location_coordinates[1])})}
            ),
            "pm2_5": {
                "value": get_column_value("characteristics.pm2_5ConcMass.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.pm2_5ConcMass.calibratedValue", row, columns),
            },
            "pm1": {
                "value": get_column_value("characteristics.pm1ConcMass.value", row, columns),
                "calibratedValue": get_column_value("characteristics.pm1ConcMass.calibratedValue", row, columns),
            },
            "pm10": {
                "value": get_column_value("characteristics.pm10ConcMass.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.pm10ConcMass.calibratedValue", row, columns),
            },
            "externalTemperature": {
                "value": get_column_value("characteristics.temperature.raw", row, columns),
            },
            "externalHumidity": {
                "value": get_column_value("characteristics.relHumid.raw", row, columns),
            },
            "no2": {
                "value": get_column_value("characteristics.no2Conc.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.no2Conc.calibratedValue", row, columns),
            },
            "speed": {
                "value": get_column_value("characteristics.windSpeed.raw", row, columns),
                "calibratedValue": get_column_value("characteristics.windSpeed.calibratedValue", row, columns),
            },
        })

        transformed_data.append(row_data)

    return transformed_data


def clean_kcca_measurements(input_file, output_file):
    data = pd.read_csv(input_file)
    if data.empty:
        print("No Data for cleaning")
        data.to_csv(output_file, index=False)
        return

    devices = get_devices_or_sites(configuration.AIRQO_BASE_URL, 'kcca')
    data_device_gps = data.groupby('deviceCode')
    cleaned_measurements = []
    for _, group in data_device_gps:
        device_name = group.iloc[0]['deviceCode']

        site_id, device_id = get_site_and_device_id(devices, device_name=device_name)

        if site_id and device_id:
            cleaned_data = clean_group(group, site_id, device_id)

            if cleaned_data:
                cleaned_measurements.extend(cleaned_data)

    with open(output_file, 'w', encoding='utf-8') as f:
        simplejson.dump(cleaned_measurements, f, ensure_ascii=False, indent=4, ignore_nan=True)
    return


def retrieve_kcca_measurements(start_time, end_time, freq, output_file):
    """
        retrieve_measurements fetch kcca data from the clarity API
        :param output_file: str
        :param freq: str
        :param end_time:
        :param start_time:
        :return: describe what it returns
    """

    if freq == "hourly":
        interval = "6H"
        time_delta = 6
    elif freq == "daily":
        interval = "48H"
        time_delta = 48
    else:
        interval = "1H"
        time_delta = 1

    dates = pd.date_range(start_time, end_time, freq=interval)
    measurements = []

    for date in dates:
        start_time = date_to_str_hours(date)
        end_time = date_to_str_hours(date + timedelta(hours=time_delta))
        print(start_time + " : " + end_time)

        range_measurements = get_kcca_measurements(freq, start_time, end_time)
        measurements.extend(range_measurements)

    measurements_df = pd.json_normalize(measurements)
    measurements_df.to_csv(path_or_buf=output_file, index=False)
    return


def get_kcca_measurements(frequency, start_time, end_time):
    api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?" \
              f"startTime={start_time}&endTime={end_time}"

    if frequency == "hourly":
        api_url = f"{api_url}&outputFrequency=hour"
    elif frequency == "daily":
        api_url = f"{api_url}&outputFrequency=day"
    else:
        api_url = f"{api_url}&outputFrequency=minute"

    headers = {'x-api-key': configuration.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    results = requests.get(api_url, headers=headers)
    if results.status_code != 200:
        print(f"{results.content}")
        return []
    return results.json()
