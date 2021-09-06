import os
import traceback
from datetime import datetime, timedelta

import pandas as pd
import urllib3
from dotenv import load_dotenv

from airqo_api import AirQoApi
from jobs import regression as jobs_rg
from models import regression as rg

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class CalibrationJob:
    airqo_api = None
    rg_model = None

    def __init__(self):
        self.__init()

    def __init(self):
        self.airqo_api = AirQoApi()
        print("Generating pkl file")
        jobs_rg.main()
        print("Finished generating pkl file")
        self.rg_model = rg.Regression()

    def calibrate(self, hours=1):
        time = datetime.utcnow()
        start_time = (time - timedelta(hours=hours)).strftime('%Y-%m-%dT%H:00:00Z')
        end_time = (datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') + timedelta(hours=hours)) \
            .strftime('%Y-%m-%dT%H:00:00Z')

        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')

        devices = self.airqo_api.get_devices(tenant='airqo')
        devices_df = pd.DataFrame(devices)

        if devices_df.count == 0:
            print("devices empty")
            return

        hourly_calibrated_measurements = []

        for _, device in devices_df.iterrows():

            if 'name' not in device.keys():
                print(f'name missing in device keys : {device}')
                continue

            device_name = device['name']
            events = self.airqo_api.get_events(tenant='airqo', start_time=start_time,
                                               end_time=end_time, device=device_name)

            if not events:
                print(f"No measurements for {device_name} : startTime {start_time} : endTime : {end_time}")
                continue

            device_events = pd.DataFrame(events)

            try:
                columns = device_events.columns

                device = device_events.iloc[0]['device'] if 'device' in columns else ''
                device_id = device_events.iloc[0]['device_id'] if 'device_id' in columns else ''
                site_id = device_events.iloc[0]['site_id'] if 'site_id' in columns else ''
                device_number = int(device_events.iloc[0]['device_number']) if 'device_number' in columns else 0
                location = pd.DataFrame(device_events.iloc[0]['location'])

                measurements = pd.json_normalize(device_events.to_dict(orient='records'))
                measurements['time'] = pd.to_datetime(measurements['time'])
                measurements.set_index('time')

                averages = measurements.resample('1H', on='time').mean().round(2)

                averages = averages[averages['pm2_5.value'].notna()]
                averages = averages[averages['s2_pm2_5.value'].notna()]
                averages = averages[averages['pm10.value'].notna()]
                averages = averages[averages['s2_pm10.value'].notna()]
                averages = averages[averages['externalTemperature.value'].notna()]
                averages = averages[averages['externalHumidity.value'].notna()]

                averages["average_pm2_5.value"] = averages[['pm2_5.value', 's2_pm2_5.value']].mean(axis=1).round(2)
                averages["average_pm10.value"] = averages[['pm10.value', 's2_pm10.value']].mean(axis=1).round(2)

                columns = averages.columns

                for index, row in averages.iterrows():

                    try:
                        pm2_5 = row["pm2_5.value"]
                        pm10 = row["pm10.value"]
                        s2_pm25 = row["s2_pm2_5.value"]
                        s2_pm10 = row["s2_pm10.value"]
                        temperature = row["externalTemperature.value"]
                        humidity = row["externalHumidity.value"]
                        time = datetime.strftime(index, '%Y-%m-%dT%H:%M:%SZ')

                        calibrated_value = self.rg_model.compute_calibrated_val(
                            pm2_5=pm2_5, s2_pm2_5=s2_pm25, pm10=pm10, datetime=time,
                            s2_pm10=s2_pm10, temperature=temperature, humidity=humidity)
                        calibrated_value = round(calibrated_value, 2)

                    except:
                        traceback.print_exc()
                        continue

                    if calibrated_value is None:
                        print("calibrated value is None")
                        continue

                    hourly_calibrated_measurement = dict({
                        "tenant": "airqo",
                        "frequency": "hourly",
                        "time": time,
                        "device": device,
                        "device_number": device_number,
                        "device_id": device_id,
                        "site_id": site_id,
                        "location": location.to_dict(),
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
                        },
                        "pm2_5": {
                            "value": row["pm2_5.value"] if "pm2_5.value" in columns else None,
                            "calibratedValue": calibrated_value
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
                        },
                        "average_pm2_5": {
                            "value": row["average_pm2_5.value"] if "average_pm2_5.value" in columns else None,
                            "calibratedValue": calibrated_value,
                        },
                        "average_pm10": {
                            "value": row["average_pm10.value"] if "average_pm10.value" in columns else None,
                        }
                    })
                    hourly_calibrated_measurements.append(hourly_calibrated_measurement)

            except:
                traceback.print_exc()

        if hourly_calibrated_measurements:
            print(hourly_calibrated_measurements)
            self.airqo_api.post_events(hourly_calibrated_measurements, 'airqo')


if __name__ == "__main__":
    hours_behind = os.getenv("HOURS", 1)
    calibration_job = CalibrationJob()
    calibration_job.calibrate(int(hours_behind))
