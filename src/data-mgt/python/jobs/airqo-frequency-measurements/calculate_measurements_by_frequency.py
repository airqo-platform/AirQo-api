import json
import os
import traceback

import pandas as pd
import requests
from datetime import datetime

DEVICE_REGISTRY_URL = os.getenv("DEVICE_REGISTRY_URL")
FREQUENCY = os.getenv("FREQUENCY")


def get_frequency_value(frequency):

    if str(frequency).lower() == 'hourly':
        return '60min'
    elif str(frequency).lower() == 'minute':
        return '1min'
    elif str(frequency).lower() == 'daily':
        return '1440min'
    else:
        raise Exception('Invalid Frequency.')


def transform_data():

    measurements = get_measurements()

    if len(measurements) == 0:
        print(f"measurements not available")
        return

    compute_frequency(measurements)


def get_measurements():

    start_date = datetime.strftime(datetime.now(), '%Y-%m-%d')

    api_url = f"{DEVICE_REGISTRY_URL}devices/events?tenant=airqo&startTime={start_date}"

    try:
        results = requests.get(api_url)

        if results.status_code != 200:
            print(f"Device Url returned error code : ${str(results.status_code)}, Content : ${str(results.content)}")
            return []

        return results.json()['measurements']

    except Exception as ex:
        print(f"Device Url returned an error : ${str(ex)}")
        return []


def check_null(value):
    if value is None:
        return 0
    return value


def compute_frequency(measurements_data):

    data = pd.DataFrame(measurements_data)

    groups = data.groupby('channelID')

    for name, group in groups:

        location = dict(group.iloc[0]['location'])
        device = group.iloc[0]['device']
        channel_id = int(group.iloc[0]['channelID'])
        frequency = str(FREQUENCY)

        measurements = []
        frequency_measurements = []

        for index, row in group.iterrows():

            measurement = dict({
                's2_pm2_5': check_null(row.get('s2_pm2_5').get('value')),
                's2_pm10': check_null(row.get('s2_pm10').get('value')),
                'time': row.get('time'),
                'pm2_5': check_null(row.get('pm2_5').get('value')),
                'pm10': check_null(row.get('pm10').get('value')),
                'internalTemperature': check_null(row.get('internalTemperature').get('value')),
                'internalHumidity': check_null(row.get('internalHumidity').get('value')),
                'hdop': check_null(row.get('hdop').get('value')),
                'speed': check_null(row.get('speed').get('value'))
            })

            measurements.append(measurement)

        measurements = pd.DataFrame(measurements)
        measurements.fillna(0)
        measurements['time'] = pd.to_datetime(measurements['time'])

        measurements = measurements.set_index('time').resample(get_frequency_value(FREQUENCY)).mean().round(2)

        for hourly_index, hourly_row in measurements.iterrows():
 
            hourly_data = dict({
                "device": device,
                "channelID": channel_id,
                "frequency": frequency,
                "time": datetime.strftime(hourly_index, '%Y-%m-%dT%H:%M:%SZ'),
                "pm2_5": {"value": hourly_row["pm2_5"]},
                "pm10": {"value": hourly_row["pm10"]},
                "s2_pm2_5": {"value": hourly_row["s2_pm2_5"]},
                "s2_pm10": {"value": hourly_row["s2_pm10"]},
                "location": location,
                "speed": {"value": hourly_row["speed"]},
                "hdop": {"value": hourly_row["hdop"]},
                "internalTemperature": {"value": hourly_row["internalTemperature"]},
                "internalHumidity": {"value": hourly_row["internalHumidity"]},
            })

            frequency_measurements.append(hourly_data)

        if frequency_measurements:
            for i in range(0, len(frequency_measurements), 200):
                chunk = frequency_measurements[i:i + 200]

                print(chunk)

                add_to_events_collection(chunk, device)


def add_to_events_collection(measurements, device_name):

    try:

        json_data = json.dumps(list(measurements))

        headers = {'Content-Type': 'application/json'}

        base_url = f"{DEVICE_REGISTRY_URL}devices/events/add?device={device_name}&tenant=airqo"

        results = requests.post(base_url, json_data, headers=headers, verify=False)

        if results.status_code == 200:
            print(results.json())
        else:
            print('\n')
            print(f"Device registry failed to insert values. Status Code : {str(results.status_code)},"
                  f" Url : {base_url}")
            print(results.content)
            print('\n')

    except Exception as ex:
        traceback.print_exc()
        print(f"Error Occurred while inserting measurements: {str(ex)}")


if __name__ == "__main__":
    transform_data()
