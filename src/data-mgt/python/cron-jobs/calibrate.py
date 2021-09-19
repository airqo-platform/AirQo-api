import traceback
from datetime import datetime, timedelta

import pandas as pd
import urllib3
from dotenv import load_dotenv

from airqoApi import AirQoApi

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class CalibrationJob:
    airqo_api = None
    raw_events = []
    hourly_measurements = []
    hourly_calibrated_measurements = []

    def __init__(self):
        self.airqo_api = AirQoApi()
        self.hours = 1

    def calibrate(self):
        self.get_events()
        self.average_measurements()
        self.calibrate_measurements()
        self.save_calibrated_measurements()

    def get_events(self):

        # ####
        # Getting devices
        # ####

        devices = self.airqo_api.get_devices(tenant='airqo')
        devices_list = list(devices)

        if len(devices_list) == 0:
            print("devices empty")
            return

        # ####
        # Getting events
        # ####

        time = datetime.utcnow()
        start_time = (time - timedelta(hours=self.hours)).strftime('%Y-%m-%dT%H:00:00Z')
        end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=self.hours)) \
            .strftime('%Y-%m-%dT%H:00:00Z')

        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')

        for device in devices_list:

            if 'name' not in device.keys():
                print(f'name missing in device keys : {device}')
                continue

            device_name = device['name']
            events = self.airqo_api.get_events(tenant='airqo', start_time=start_time,
                                               end_time=end_time, device=device_name)

            if not events:
                print(f"No measurements for {device_name} : startTime {start_time} : endTime : {end_time}")
                continue

            if len(self.raw_events) >= 24:
                break

            self.raw_events.extend(events)

    def average_measurements(self):
        # ####
        # Averaging
        # ####

        if len(self.raw_events) == 0:
            print("events list is empty")
            return

        devices_events_df = pd.DataFrame(self.raw_events)
        devices_groups = devices_events_df.groupby("device")

        for _, device_group in devices_groups:

            try:

                del device_group['deviceDetails']
                device_measurements = pd.json_normalize(device_group.to_dict(orient='records'))

                measurement_metadata = device_measurements[['site_id', 'device_id',
                                                            'location.latitude.value', 'location.longitude.value',
                                                            'device', 'device_number']].copy()

                measurement_readings = device_measurements

                del measurement_readings['site_id']
                del measurement_readings['device_id']
                del measurement_readings['frequency']
                del measurement_readings['location.latitude.value']
                del measurement_readings['location.longitude.value']
                del measurement_readings['device']
                del measurement_readings['device_number']

                measurement_readings['time'] = pd.to_datetime(measurement_readings['time'])
                measurement_readings.set_index('time')
                measurement_readings.sort_index(axis=0)
                measurement_readings = measurement_readings.ffill().bfill()

                averages = pd.DataFrame(measurement_readings.resample('1H', on='time').mean().round(2))

                averages['average_pm2_5.value'] = averages[['pm2_5.value', 's2_pm2_5.value']].mean(axis=1)
                averages['average_pm10.value'] = averages[['pm10.value', 's2_pm10.value']].mean(axis=1)

                averages["time"] = averages.index
                averages["time"] = averages["time"].apply(lambda x: datetime.strftime(x, '%Y-%m-%dT%H:%M:%SZ'))

                for _, row in averages.iterrows():
                    combined_dataset = {**row.to_dict(), **measurement_metadata.iloc[0].to_dict()}
                    self.hourly_measurements.append(combined_dataset)

            except:
                traceback.print_exc()

    def calibrate_measurements(self):

        # ####
        # Calibration
        # ####

        if len(self.hourly_measurements) == 0:
            print("hourly measurements list is empty")
            return

        hourly_measurements_df = pd.DataFrame(self.hourly_measurements)
        hourly_measurements_groups = hourly_measurements_df.groupby("time")

        for _, time_group in hourly_measurements_groups:
            date_time = time_group.iloc[0]["time"]
            time_group["pm2_5"] = time_group["pm2_5.value"]
            time_group["s2_pm2_5"] = time_group["s2_pm2_5.value"]
            time_group["pm10"] = time_group["pm10.value"]
            time_group["s2_pm10"] = time_group["s2_pm10.value"]
            time_group["externalTemperature"] = time_group["externalTemperature.value"]
            time_group["humidity"] = time_group["externalHumidity.value"]

            calibrate_body = time_group.to_dict(orient="records")

            try:
                calibrated_values = self.airqo_api.get_calibrated_values(date_time, calibrate_body)

                for value in calibrated_values:
                    time_group.loc[time_group['device'] == value["device_id"], 'average_pm2_5.calibratedValue'] \
                        = value["calibrated_PM2.5"]
                    time_group.loc[time_group['device'] == value["device_id"], 'average_pm10.calibratedValue'] \
                        = value["calibrated_PM10"]

                self.hourly_calibrated_measurements.extend(time_group.to_dict(orient='records'))
            except:
                traceback.print_exc()
                pass

    def save_calibrated_measurements(self):
        # ####
        # Saving calibrated values
        # ####
        if not self.hourly_calibrated_measurements:
            print("hourly calibrated measurements list is empty")
            return

        calibrated_measurements = []
        hourly_calibrated_measurements_df = pd.DataFrame(self.hourly_calibrated_measurements)

        for _, row in hourly_calibrated_measurements_df.iterrows():
            columns = hourly_calibrated_measurements_df.columns

            calibrated_measurement = dict({
                "tenant": "airqo",
                "frequency": "hourly",
                "time": row['time'],
                "device": row['device'],
                "device_number": row['device_number'],
                "device_id": row['device_id'],
                "site_id": row['site_id'],
                "location": {
                    "latitude": {
                        "value": row['location.latitude.value']
                    },
                    "longitude": {
                        "value": row['location.longitude.value']
                    }
                },
                "internalTemperature": {
                    "value": row[
                        "internalTemperature.value"] if "internalTemperature.value" in columns else None
                },
                "internalHumidity": {
                    "value": row["internalHumidity.value"] if "internalHumidity.value" in columns else None
                },
                "externalTemperature": {
                    "value": row[
                        "externalTemperature.value"] if "externalTemperature.value" in columns else None
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
                    "uncertaintyValue": row["pm10.uncertaintyValue"]
                    if "pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm10.standardDeviationValue"]
                    if "pm10.standardDeviationValue" in columns else None
                },
                "pm2_5": {
                    "value": row["pm2_5.value"] if "pm2_5.value" in columns else None,
                    "uncertaintyValue": row["pm2_5.uncertaintyValue"]
                    if "pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm2_5.standardDeviationValue"]
                    if "pm2_5.standardDeviationValue" in columns else None
                },
                "no2": {
                    "value": row["no2.value"] if "no2.value" in columns else None,
                    "calibratedValue": row[
                        "no2.calibratedValue"] if "no2.calibratedValue" in columns else None,
                    "uncertaintyValue": row[
                        "no2.uncertaintyValue"] if "no2.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["no2.standardDeviationValue"]
                    if "no2.standardDeviationValue" in columns else None
                },
                "pm1": {
                    "value": row["pm1.value"] if "pm1.value" in columns else None,
                    "calibratedValue": row[
                        "pm1.calibratedValue"] if "pm1.calibratedValue" in columns else None,
                    "uncertaintyValue": row[
                        "pm1.uncertaintyValue"] if "pm1.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["pm1.standardDeviationValue"]
                    if "pm1.standardDeviationValue" in columns else None
                },
                "s2_pm10": {
                    "value": row["s2_pm10.value"] if "s2_pm10.value" in columns else None,
                    "uncertaintyValue": row["s2_pm10.uncertaintyValue"]
                    if "s2_pm10.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["s2_pm10.standardDeviationValue"]
                    if "s2_pm10.standardDeviationValue" in columns else None
                },
                "s2_pm2_5": {
                    "value": row["s2_pm2_5.value"] if "s2_pm2_5.value" in columns else None,
                    "uncertaintyValue": row["s2_pm2_5.uncertaintyValue"]
                    if "s2_pm2_5.uncertaintyValue" in columns else None,
                    "standardDeviationValue": row["s2_pm2_5.standardDeviationValue"]
                    if "s2_pm2_5.standardDeviationValue" in columns else None
                },
                "average_pm2_5": {
                    "value": row["average_pm2_5.value"] if "average_pm2_5.value" in columns else None,
                    "calibratedValue": row["average_pm2_5.calibratedValue"] if "average_pm2_5.calibratedValue"
                                                                               in columns else None,
                },
                "average_pm10": {
                    "value": row["average_pm10.value"] if "average_pm10.value" in columns else None,
                    "calibratedValue": row["average_pm10.calibratedValue"] if "average_pm10.calibratedValue"
                                                                              in columns else None,
                }
            })
            calibrated_measurements.append(calibrated_measurement)

        print(calibrated_measurements)
        self.airqo_api.post_events(calibrated_measurements, 'airqo')


def main():
    calibration_job = CalibrationJob()
    calibration_job.calibrate()
