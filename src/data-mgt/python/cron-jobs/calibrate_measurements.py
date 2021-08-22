from datetime import datetime, timedelta

import pandas as pd

from airqo_api import AirQoApi
from kafka_client import MeasurementsClient


def get_measurements():
    time = datetime.utcnow()
    start_time = (time - timedelta(hours=1)).strftime('%Y-%m-%dT%H:00:00Z')
    end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=1)).strftime('%Y-%m-%dT%H:00:00Z')

    airqo_api = AirQoApi()

    events = airqo_api.get_events(tenant='airqo', start_time=start_time, end_time=end_time)

    if events.count == 0:
        print("empty")
        return

    events_df = pd.DataFrame(events)
    device_groups = events_df.groupby('device')

    # grouper = events_df.groupby(['device', pd.Grouper(freq='1H')])
    # print(grouper.head())

    hourly_measurements = []
    for _, device_group in device_groups:

        columns = device_group.columns

        device = device_group.iloc[0]['device'] if 'device' in columns else ''
        device_id = device_group.iloc[0]['device_id'] if 'device_id' in columns else ''
        site_id = device_group.iloc[0]['site_id'] if 'site_id' in columns else ''
        device_number = device_group.iloc[0]['device_number'] if 'device_number' in columns else ''
        location = device_group.iloc[0]['location'] if 'location' in columns else ''

        measurements = pd.json_normalize(device_group.to_dict(orient='records'))
        measurements['time'] = pd.to_datetime(measurements['time'])
        measurements.set_index('time')
        measurements = measurements.fillna(0)

        averages = measurements.resample('1H', on='time').mean().round(2)
        columns = averages.columns

        for index, row in averages.iterrows():
            hourly_measurement = dict({

                "tenant": "airqo",
                "frequency": "hourly",
                "time": datetime.strftime(index, '%Y-%m-%dT%H:%M:%SZ'),
                "device": device,
                "device_id": device_id,
                "site_id": site_id,
                "device_number": device_number,
                "location": location,
                "internalTemperature": {
                    "value": row["internalTemperature.value"] if "internalTemperature.value" in columns else None
                },
                "internalHumidity": {
                    "value": row["internalHumidity.value"] if "internalHumidity.value" in columns else None
                },
                "externalTemperature": {
                    "value": row["externalTemperature.value"] if "externalTemperature.value" in columns else None
                },
                "externalHumidity": {
                    "value": row["externalHumidity.value"] if "externalHumidity.value" in columns else None
                },
                "externalPressure": {
                    "value": row["externalPressure.value"] if "externalPressure.value" in columns else None
                },
                "speed": {
                    "value": row["speed.value"] if "speed.value" in columns else None
                },
                "altitude": {
                    "value": row["altitude.value"] if "altitude.value" in columns else None
                },
                "battery": {
                    "value": row["battery.value"] if "battery.value" in columns else None
                },
                "satellites": {
                    "value": row["satellites.value"] if "satellites.value" in columns else None
                },
                "hdop": {
                    "value": row["hdop.value"] if "hdop.value" in columns else None
                },
                "pm10": {
                    "value": row["pm10.value"] if "pm10.value" in columns else None,
                    "calibratedValue": row["pm10.calibratedValue"]
                    if "pm10.calibratedValue" in columns else None,
                    "uncertaintyValue": row["pm10.uncertaintyValue"]
                    if "pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm10.standardDeviationValue"]
                    if "pm10.standardDeviationValue" in columns else None
                },
                "pm2_5": {
                    "value": row["pm2_5.value"] if "pm2_5.value" in columns else None,
                    "calibratedValue": row["pm2_5.calibratedValue"] if "pm2_5.calibratedValue" in columns else None,
                    "uncertaintyValue": row["pm2_5.uncertaintyValue"] if "pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm2_5.standardDeviationValue"]
                    if "pm2_5.standardDeviationValue" in columns else None
                },
                "no2": {
                    "value": row["no2.value"] if "no2.value" in columns else None,
                    "calibratedValue": row["no2.calibratedValue"] if "no2.calibratedValue" in columns else None,
                    "uncertaintyValue": row["no2.uncertaintyValue"] if "no2.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["no2.standardDeviationValue"]
                    if "no2.standardDeviationValue" in columns else None
                },
                "pm1": {
                    "value": row["pm1.value"] if "pm1.value" in columns else None,
                    "calibratedValue": row["pm1.calibratedValue"] if "pm1.calibratedValue" in columns else None,
                    "uncertaintyValue": row["pm1.uncertaintyValue"] if "pm1.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm1.standardDeviationValue"]
                    if "pm1.standardDeviationValue" in columns else None
                },
                "s2_pm10": {
                    "value": row["s2_pm10.value"] if "s2_pm10.value" in columns else None,
                    "calibratedValue": row["s2_pm10.calibratedValue"]
                    if "s2_pm10.calibratedValue" in columns else None,
                    "uncertaintyValue": row["s2_pm10.uncertaintyValue"]
                    if "s2_pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["s2_pm10.standardDeviationValue"]
                    if "s2_pm10.standardDeviationValue" in columns else None
                },
                "s2_pm2_5": {
                    "value": row["s2_pm2_5.value"] if "s2_pm2_5.value" in columns else None,
                    "calibratedValue": row["s2_pm2_5.calibratedValue"]
                    if "s2_pm2_5.calibratedValue" in columns else None,
                    "uncertaintyValue": row["s2_pm2_5.uncertaintyValue"]
                    if "s2_pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["s2_pm2_5.standardDeviationValue"]
                    if "s2_pm2_5.standardDeviationValue" in columns else None
                }
            })
            hourly_measurements.append(hourly_measurement)

    if hourly_measurements:
        print(hourly_measurements)
        measurements_client = MeasurementsClient()
        measurements_client.produce_measurements(hourly_measurements)
