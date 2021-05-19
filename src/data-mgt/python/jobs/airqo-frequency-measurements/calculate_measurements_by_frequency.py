import json
import os
import traceback

import pandas as pd
import requests
from datetime import datetime

DEVICE_REGISTRY_URL = os.getenv("DEVICE_REGISTRY_URL", "https://staging-platform.airqo.net/api/v1/")
FREQUENCY = os.getenv("FREQUENCY", "hourly")
START_TIME = os.getenv("START_TIME", datetime.strftime(datetime.now(), '%Y-%m-%d'))
os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


def get_frequency_value(frequency):

    if str(frequency).lower() == 'minute':
        return '1min'
    elif str(frequency).lower() == 'hourly':
        return '60min'
    elif str(frequency).lower() == 'daily':
        return '1440min'
    elif str(frequency).lower() == 'weekly':
        return '10080min'
    elif str(frequency).lower() == 'monthly':
        return '43800min'
    else:
        raise Exception('Invalid Frequency.')


def transform_data():

    measurements = get_measurements(START_TIME, DEVICE_REGISTRY_URL)

    if not measurements:
        print(f"measurements not available")
        return

    measurements_with_frequency = compute_frequency(measurements, FREQUENCY)

    if measurements_with_frequency:
        add_to_events_collection(measurements_with_frequency)


def get_measurements(start_time, device_registry_url):

    try:

        start_date = datetime.strptime(start_time, '%Y-%m-%d').strftime('%Y-%m-%d')

        api_url = f"{device_registry_url}devices/events?tenant=airqo&startTime={start_date}"

        results = requests.get(api_url, verify=False)

        if results.status_code != 200:
            print(f"Device Url returned error code : ${str(results.status_code)}, Content : ${str(results.content)}")
            return []

        return results.json()['measurements']

    except Exception as ex:
        print(f"Device Url returned an error : ${str(ex)}")
        return []


def check_null(value):
    if value is None or str(value).strip().lower() == 'null':
        return 0
    return value


def compute_frequency(measurements_data, frequency):

    raw_measurements_df = pd.DataFrame(measurements_data)

    groups = raw_measurements_df.groupby('channelID')

    measurements_with_frequency = []

    for name, group in groups:

        location = dict(group.iloc[0]['location'])
        device = group.iloc[0]['deviceDetails']['name']
        channel_id = int(group.iloc[0]['channelID'])

        measurements = []

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

        measurements = measurements.set_index('time').resample(get_frequency_value(frequency)).mean().round(2)

        for index, row in measurements.iterrows():
 
            data = dict({
                "device": device,
                "channelID": channel_id,
                "frequency": frequency,
                "time": datetime.strftime(index, '%Y-%m-%dT%H:%M:%SZ'),
                "pm2_5": {"value": row["pm2_5"]},
                "pm10": {"value": row["pm10"]},
                "s2_pm2_5": {"value": row["s2_pm2_5"]},
                "s2_pm10": {"value": row["s2_pm10"]},
                "location": location,
                "speed": {"value": row["speed"]},
                "hdop": {"value": row["hdop"]},
                "internalTemperature": {"value": row["internalTemperature"]},
                "internalHumidity": {"value": row["internalHumidity"]},
            })

            measurements_with_frequency.append(data)

    return measurements_with_frequency


def add_to_events_collection(measurements):
    if measurements:

        data = pd.DataFrame(measurements)

        if 'device' not in data.columns:
            raise Exception("device is missing")

        groups = data.groupby('device')

        for name, group in groups:

            device = group.iloc[0]['device']

            data = group.to_dict()

            try:

                json_data = json.dumps(data)

                headers = {'Content-Type': 'application/json'}

                base_url = f"{DEVICE_REGISTRY_URL}devices/events/add?device={device}&tenant=airqo"

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
