import os
import pandas as pd
import requests
from datetime import datetime

DEVICE_REGISTRY_STAGING_URL = os.getenv("DEVICE_REGISTRY_STAGING_URL")


def transform_data():

    device_measurements_data = get_airqo_devices_data()

    get_hourly_measurements(device_measurements_data)


def get_airqo_devices_data():

    start_date = datetime.strftime(datetime.now(), '%Y-%m-%d')

    api_url = f"{DEVICE_REGISTRY_STAGING_URL}devices/events?tenant=airqo&startTime={start_date}&limit=30"

    results = requests.get(api_url)

    return results.json()['measurements']


def get_hourly_measurements(measurements_data):

    data = pd.DataFrame(measurements_data)

    groups = data.groupby('channelID')

    for name, group in groups:

        location = dict(group.iloc[0]['location'])
        device = group.iloc[0]['device']
        channel_id = group.iloc[0]['channelID']
        frequency = "hourly"

        measurements = []
        hourly_measurements = []

        for index, row in group.iterrows():

            measurement = dict({
                's2_pm2_5': row.get('s2_pm2_5').get('value'),
                's2_pm10': row.get('s2_pm10').get('value'),
                'time': row.get('time'),
                'pm2_5': row.get('pm2_5').get('value'),
                'pm10': row.get('pm10').get('value'),
                'internalTemperature': row.get('internalTemperature').get('value'),
                'internalHumidity': row.get('internalHumidity').get('value'),
                'hdop': row.get('hdop').get('value'),
                'speed': row.get('speed').get('value')
            })

            measurements.append(measurement)

        measurements = pd.DataFrame(measurements)
        measurements.fillna(0)
        measurements['time'] = pd.to_datetime(measurements['time'])

        measurements = measurements.set_index('time').resample('60min').mean().round(2)

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

            hourly_measurements.append(hourly_data)

        if hourly_measurements:
            print(hourly_measurements)


if __name__ == "__main__":
    transform_data()
