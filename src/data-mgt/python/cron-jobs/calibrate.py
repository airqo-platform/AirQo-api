import traceback
from datetime import datetime, timedelta

import pandas as pd
import urllib3
from dotenv import load_dotenv

from config import configuration
from airqoApi import AirQoApi
from date import date_to_str2, date_to_str_hours
from utils import to_double

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

    def calibrate(self, start_time=None, end_time=None):
        self.get_measurements(start_time, end_time)
        self.average_measurements()
        self.calibrate_measurements()
        self.save_calibrated_measurements()

    def get_measurements(self, start_time=None, end_time=None):

        # ####
        # Getting measurements
        # ####

        devices = self.airqo_api.get_devices(tenant='airqo')
        devices_list = list(devices)

        if len(devices_list) == 0:
            print("devices empty")
            return

        # ####
        # Getting events
        # ####

        if start_time is None or end_time is None:
            time = datetime.utcnow()
            start_time = date_to_str_hours(time - timedelta(hours=self.hours))
            end_time = date_to_str_hours(datetime.strptime(start_time, '%Y-%m-%dT%H:00:00Z') +
                                         timedelta(hours=self.hours))

        interval = f"{self.hours}H"
        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')
        dates = pd.date_range(start_time, end_time, freq=interval)

        for device in devices_list:

            try:
                if 'name' not in device.keys():
                    print(f'name missing in device keys : {device}')
                    continue

                for date in dates:
                    start_datetime = date_to_str2(date)
                    end_datetime = date_to_str2(date + timedelta(hours=int(self.hours)))

                    device_name = device['name']
                    events = self.airqo_api.get_events(tenant='airqo', start_time=start_datetime, frequency="raw",
                                                       end_time=end_datetime, device=device_name)

                    if not events:
                        print(f"No measurements for {device_name} : "
                              f"startTime {start_datetime} : endTime : {end_datetime}")
                        continue

                    self.raw_events.extend(events)
            except:
                traceback.print_exc()

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

                averages = pd.DataFrame(measurement_readings.resample('1H', on='time').mean())

                if 'pm2_5.value' not in averages.columns and 's1_pm2_5.value' in averages.columns:
                    averages['pm2_5.value'] = averages['s1_pm2_5.value']
                if 'pm10.value' not in averages.columns and 's1_pm10.value' in averages.columns:
                    averages['pm10.value'] = averages['s1_pm10.value']

                if "pm2_5.value" not in averages.columns or "s2_pm2_5.value" not in averages.columns or\
                        "pm10.value" not in averages.columns or "s2_pm10.value" not in averages.columns:
                    continue

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

            data = time_group[time_group["pm2_5.value"].notna()]
            data = data[data["s2_pm2_5.value"].notna()]
            data = data[data["pm10.value"].notna()]
            data = data[data["s2_pm10.value"].notna()]
            data = data[data["externalTemperature.value"].notna()]
            data = data[data["externalHumidity.value"].notna()]

            try:
                date_time = data.iloc[0]["time"]
                data["pm2_5"] = data["pm2_5.value"]
                data["s2_pm2_5"] = data["s2_pm2_5.value"]
                data["pm10"] = data["pm10.value"]
                data["s2_pm10"] = data["s2_pm10.value"]
                data["temperature"] = data["externalTemperature.value"]
                data["humidity"] = data["externalHumidity.value"]

                calibrate_body = data.to_dict(orient="records")

                for i in range(0, len(calibrate_body), int(configuration.CALIBRATE_REQUEST_BODY_SIZE)):
                    values = calibrate_body[i:i + int(configuration.CALIBRATE_REQUEST_BODY_SIZE)]

                    calibrated_values = self.airqo_api.get_calibrated_values(date_time, values)

                    for value in calibrated_values:
                        try:
                            data.loc[data['device'] == value["device_id"], 'average_pm2_5.calibratedValue'] \
                                = value["calibrated_PM2.5"]
                            data.loc[data['device'] == value["device_id"], 'average_pm10.calibratedValue'] \
                                = value["calibrated_PM10"]
                        except:
                            traceback.print_exc()
                            pass

                    self.hourly_calibrated_measurements.extend(data.to_dict(orient='records'))

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

        cleaned_df = hourly_calibrated_measurements_df[
            hourly_calibrated_measurements_df['average_pm2_5.calibratedValue'].notna()
        ]

        for _, row in cleaned_df.iterrows():
            try:
                columns = hourly_calibrated_measurements_df.columns

                calibrated_measurement = dict({
                    "tenant": "airqo",
                    "frequency": "hourly",
                    "time": row['time'],
                    "device": row['device'],
                    "device_number": row['device_number'],
                    "device_id": row['device_id'],
                    "site_id": row['site_id'],
                    "internalTemperature": {
                        "value": get_value("internalTemperature.value", row, columns),
                    },
                    "internalHumidity": {
                        "value": get_value("internalHumidity.value", row, columns),
                    },
                    "externalTemperature": {
                        "value": get_value("externalTemperature.value", row, columns),
                    },
                    "externalHumidity": {
                        "value": get_value("externalHumidity.value", row, columns),
                    },
                    "externalPressure": {
                        "value": get_value("externalPressure.value", row, columns),
                    },
                    "speed": {
                        "value": get_value("speed.value", row, columns),
                    },
                    "altitude": {
                        "value": get_value("altitude.value", row, columns),
                    },
                    "battery": {
                        "value": get_value("battery.value", row, columns),
                    },
                    "satellites": {
                        "value": get_value("satellites.value", row, columns),
                    },
                    "hdop": {
                        "value": get_value("hdop.value", row, columns),
                    },
                    "pm10": {
                        "value": get_value("pm10.value", row, columns),
                        "uncertaintyValue": get_value("pm10.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("pm10.standardDeviationValue", row, columns),
                    },
                    "pm2_5": {
                        "value": get_value("pm2_5.value", row, columns),
                        "uncertaintyValue": get_value("pm2_5.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("pm2_5.standardDeviationValue", row, columns),
                    },
                    "no2": {
                        "value": get_value("no2.value", row, columns),
                        "calibratedValue": get_value("no2.calibratedValue", row, columns),
                        "uncertaintyValue": get_value("no2.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("no2.standardDeviationValue", row, columns),
                    },
                    "pm1": {
                        "value": get_value("pm1.value", row, columns),
                        "calibratedValue": get_value("pm1.calibratedValue", row, columns),
                        "uncertaintyValue": get_value("pm1.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("pm1.standardDeviationValue", row, columns),
                    },
                    "s2_pm10": {
                        "value": get_value("s2_pm10.value", row, columns),
                        "uncertaintyValue": get_value("s2_pm10.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("s2_pm10.standardDeviationValue", row, columns),
                    },
                    "s2_pm2_5": {
                        "value": get_value("s2_pm2_5.value", row, columns),
                        "uncertaintyValue": get_value("s2_pm2_5.uncertaintyValue", row, columns),
                        "standardDeviationValue": get_value("s2_pm2_5.standardDeviationValue", row, columns),
                    },
                    "average_pm2_5": {
                        "value": get_value("average_pm2_5.value", row, columns),
                        "calibratedValue": get_value("average_pm2_5.calibratedValue", row, columns),
                    },
                    "average_pm10": {
                        "value": get_value("average_pm10.value", row, columns),
                        "calibratedValue": get_value("average_pm10.calibratedValue", row, columns),
                    }
                })
                calibrated_measurements.append(calibrated_measurement)
            except:
                traceback.print_exc()

        print(calibrated_measurements)
        self.airqo_api.post_events(calibrated_measurements, 'airqo')


def get_value(column_name, series, columns_names):
    if column_name in columns_names:
        return to_double(series[column_name])
    return None


def main():
    calibration_job = CalibrationJob()
    calibration_job.calibrate()


def main_historical_data(start_time, end_time):
    calibration_job = CalibrationJob()
    calibration_job.calibrate(start_time, end_time)