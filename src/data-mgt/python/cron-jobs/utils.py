import math
import traceback
from datetime import datetime

import pandas as pd


def to_double(x):
    try:
        value = float(x)
        if math.isnan(value):
            return None
        return value
    except:
        return None


def format_measurements(measurements, frequency):

    if not measurements:
        print(" measurements list is empty")
        return

    measurements_df = pd.DataFrame(measurements)
    formatted_measurements = []

    for _, row in measurements_df.iterrows():
        try:
            columns = measurements_df.columns

            formatted_measurement = dict({
                "tenant": "airqo",
                "frequency": frequency,
                "time": row['time'],
                "device": row['device'],
                "device_number": row['device_number'],
                "device_id": row['device_id'],
                "site_id": row['site_id'],
                "internalTemperature": {
                    "value": to_double(row[
                                           "internalTemperature.value"]) if "internalTemperature.value" in columns else None
                },
                "internalHumidity": {
                    "value": to_double(
                        row["internalHumidity.value"]) if "internalHumidity.value" in columns else None
                },
                "externalTemperature": {
                    "value": to_double(row[
                                           "externalTemperature.value"]) if "externalTemperature.value" in columns else None
                },
                "externalHumidity": {
                    "value": to_double(
                        row["externalHumidity.value"]) if "externalHumidity.value" in columns else None
                },
                "externalPressure": {
                    "value": to_double(
                        row["externalPressure.value"]) if "externalPressure.value" in columns else None
                },
                "speed": {
                    "value": to_double(row["speed.value"]) if "speed.value" in columns else None
                },
                "altitude": {
                    "value": to_double(row["altitude.value"]) if "altitude.value" in columns else None
                },
                "battery": {
                    "value": to_double(row["battery.value"]) if "battery.value" in columns else None
                },
                "satellites": {
                    "value": to_double(row["satellites.value"]) if "satellites.value" in columns else None
                },
                "hdop": {
                    "value": to_double(row["hdop.value"]) if "hdop.value" in columns else None
                },
                "pm10": {
                    "value": to_double(row["pm10.value"]) if "pm10.value" in columns else None,
                    "uncertaintyValue": to_double(row["pm10.uncertaintyValue"])
                    if "pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["pm10.standardDeviationValue"])
                    if "pm10.standardDeviationValue" in columns else None
                },
                "pm2_5": {
                    "value": to_double(row["pm2_5.value"]) if "pm2_5.value" in columns else None,
                    "uncertaintyValue": to_double(row["pm2_5.uncertaintyValue"])
                    if "pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["pm2_5.standardDeviationValue"])
                    if "pm2_5.standardDeviationValue" in columns else None
                },
                "no2": {
                    "value": to_double(row["no2.value"]) if "no2.value" in columns else None,
                    "calibratedValue": to_double(row[
                                                     "no2.calibratedValue"]) if "no2.calibratedValue" in columns else None,
                    "uncertaintyValue": to_double(row[
                                                      "no2.uncertaintyValue"]) if "no2.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["no2.standardDeviationValue"])
                    if "no2.standardDeviationValue" in columns else None
                },
                "pm1": {
                    "value": to_double(row["pm1.value"]) if "pm1.value" in columns else None,
                    "calibratedValue": to_double(row[
                                                     "pm1.calibratedValue"]) if "pm1.calibratedValue" in columns else None,
                    "uncertaintyValue": to_double(row[
                                                      "pm1.uncertaintyValue"]) if "pm1.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["pm1.standardDeviationValue"])
                    if "pm1.standardDeviationValue" in columns else None
                },
                "s2_pm10": {
                    "value": to_double(row["s2_pm10.value"]) if "s2_pm10.value" in columns else None,
                    "uncertaintyValue": to_double(row["s2_pm10.uncertaintyValue"])
                    if "s2_pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["s2_pm10.standardDeviationValue"])
                    if "s2_pm10.standardDeviationValue" in columns else None
                },
                "s2_pm2_5": {
                    "value": to_double(row["s2_pm2_5.value"]) if "s2_pm2_5.value" in columns else None,
                    "uncertaintyValue": to_double(row["s2_pm2_5.uncertaintyValue"])
                    if "s2_pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": to_double(row["s2_pm2_5.standardDeviationValue"])
                    if "s2_pm2_5.standardDeviationValue" in columns else None
                },
                "average_pm2_5": {
                    "value": to_double(row["average_pm2_5.value"]) if "average_pm2_5.value" in columns else None,
                    "calibratedValue": to_double(
                        row["average_pm2_5.calibratedValue"]) if "average_pm2_5.calibratedValue"
                                                                 in columns else None,
                },
                "average_pm10": {
                    "value": to_double(row["average_pm10.value"]) if "average_pm10.value" in columns else None,
                    "calibratedValue": to_double(
                        row["average_pm10.calibratedValue"]) if "average_pm10.calibratedValue"
                                                                in columns else None,
                }
            })
            formatted_measurements.append(formatted_measurement)
        except:
            traceback.print_exc()

    return formatted_measurements


def average_values(values, frequency):
    devices_events_df = pd.DataFrame(values)
    devices_groups = devices_events_df.groupby("device")
    averaged_measurements = []

    for _, device_group in devices_groups:

        try:
            device_measurements = pd.json_normalize(device_group.to_dict(orient='records'))

            measurement_metadata = device_measurements[['site_id', 'device_id', 'device', 'device_number']].copy()

            measurement_readings = device_measurements

            del measurement_readings['site_id']
            del measurement_readings['device_id']
            del measurement_readings['frequency']
            del measurement_readings['device']
            del measurement_readings['device_number']

            measurement_readings.dropna(subset=['time'], inplace=True)
            measurement_readings['time'] = pd.to_datetime(measurement_readings['time'])
            measurement_readings.set_index('time')
            measurement_readings.sort_index(axis=0)

            averages = pd.DataFrame(measurement_readings.resample(frequency, on='time').mean())

            averages["time"] = averages.index
            averages["time"] = averages["time"].apply(lambda x: datetime.strftime(x, '%Y-%m-%dT%H:%M:%SZ'))

            for _, row in averages.iterrows():
                combined_dataset = {**row.to_dict(), **measurement_metadata.iloc[0].to_dict()}
                averaged_measurements.append(combined_dataset)
        except:
            traceback.print_exc()

    return averaged_measurements
