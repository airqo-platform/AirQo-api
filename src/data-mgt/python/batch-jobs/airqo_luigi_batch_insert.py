import json
import math
import os
from datetime import datetime
from threading import Thread

import requests
import luigi
import pandas as pd
from google.cloud import bigquery
import traceback

from date import str_to_date

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
CALIBRATE_URL = os.getenv("CALIBRATE_URL")
START_DATE_TIME = os.getenv("START_DATE_TIME")
STOP_DATE_TIME = os.getenv("STOP_DATE_TIME")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"
os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"


class DataConstants:
    DEVICE = "device"
    CHANNEL_ID = "channelID"
    LOCATION = "location"
    FREQUENCY = "frequency"
    TIME = "time"
    PM2_5 = "pm2_5"
    PM10 = "pm10"
    S2_PM2_5 = "s2_pm2_5"
    S2_PM10 = "s2_pm10"
    BATTERY = "battery"
    ALTITUDE = "altitude"
    SPEED = "speed"
    SATELLITES = "satellites"
    HDOP = "hdop"
    INTERNAL_TEMP = "internalTemperature"
    INTERNAL_HUM = "internalHumidity"


class GetAirqoDevices(luigi.Task):
    """
    Luigi task to fetch all airqo devices
    """

    def run(self):

        api_url = DEVICE_REGISTRY_BASE_URL + "devices?tenant=airqo"

        try:
            results = requests.get(api_url)
            devices_data = results.json()["devices"]
        except Exception as ex:
            print("Devices Url returned an error : " + str(ex))
            devices_data = {}

        with self.output().open('w') as f:
            json.dump(list(devices_data), f)

    def output(self):
        return luigi.LocalTarget("data/devices.json")


def check_float(string):
    """
    formatting all values to float else null
    """

    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


class GetDeviceMeasurements(luigi.Task):

    def requires(self):
        return GetAirqoDevices()

    def output(self):
        return luigi.LocalTarget("data/device_measurements.json")

    def run(self):

        client = bigquery.Client()

        devices = pd.read_json('data/devices.json')

        transformed_data = []

        for device_index, device_row in devices.iterrows():

            query = """
            SELECT created_at as time, pm2_5, pm10 , s2_pm2_5,
             s2_pm10, temperature as internalTemperature, humidity as internalHumidity, voltage as battery, altitude,
             no_sats as satellites, hdope as hdop, wind as speed FROM airqo-250220.thingspeak.clean_feeds_pms WHERE
             channel_id={0} AND created_at BETWEEN '{1}' AND '{2}' ORDER BY created_at 
               """.format(int(device_row["channelID"]), str_to_date(START_DATE_TIME), str_to_date(STOP_DATE_TIME))

            dataframe = (
                client.query(query).result().to_dataframe()
            )

            for index, row in dataframe.iterrows():

                device_data = dict({

                    DataConstants.DEVICE: device_row['name'],
                    DataConstants.CHANNEL_ID: device_row["channelID"],
                    DataConstants.LOCATION: {"latitude":
                                                 {"value": check_float(device_row["latitude"])},
                                             "longitude":
                                                 {"value": check_float(device_row["longitude"])}
                                             },
                    DataConstants.FREQUENCY: "minute",
                    DataConstants.TIME: pd.Timestamp(row["time"]).isoformat(),
                    DataConstants.PM2_5: {"value": check_float(row["pm2_5"])},
                    DataConstants.PM10: {"value": check_float(row["pm10"])},
                    DataConstants.S2_PM2_5: {"value": check_float(row["s2_pm2_5"])},
                    DataConstants.S2_PM10: {"value": check_float(row["s2_pm10"])},
                    DataConstants.BATTERY: {"value": check_float(row["battery"])},
                    DataConstants.ALTITUDE: {"value": check_float(row["altitude"])},
                    DataConstants.SPEED: {"value": check_float(row["speed"])},
                    DataConstants.SATELLITES: {"value": check_float(row["satellites"])},
                    DataConstants.HDOP: {"value": check_float(row["hdop"])},
                    DataConstants.INTERNAL_TEMP: {"value": check_float(row["internalTemperature"])},
                    DataConstants.INTERNAL_HUM: {"value": check_float(row["internalHumidity"])},
                })

                transformed_data.append(device_data)

        with self.output().open('w') as f:
            json.dump(list(transformed_data), f)


def get_calibrated_value(channel_id, time, value):

    data = {
        "datetime": time,
        "raw_values": [
            {
                "raw_value": value,
                "sensor_id": channel_id
            }
        ]
    }

    try:
        post_request = requests.post(url=CALIBRATE_URL, json=data)
    except Exception as ex:
        print("Calibrate Url returned an error : " + str(ex))
        return None

    if post_request.status_code != 200:
        return None

    response = post_request.json()
    calibrated_value = None

    for result in response:
        if "calibrated_value" in result:
            calibrated_value = result["calibrated_value"]
            break

    return calibrated_value


class AddValuesToEventsCollection(luigi.Task):

    def requires(self):
        return GetDeviceMeasurements()

    def output(self):
        return luigi.LocalTarget("data/device_measurements_with_calibrated_values.json")

    def run(self):

        threads = []

        device_measurements = pd.read_json('data/device_measurements.json')

        calibrated_data = []

        for index, row in device_measurements.iterrows():

            data = row.to_dict()

            calibrated_value = get_calibrated_value(row[DataConstants.CHANNEL_ID],
                                                    row[DataConstants.TIME],
                                                    row[DataConstants.PM2_5]["value"])

            if calibrated_value is not None:
                data[DataConstants.PM2_5]["calibratedValue"] = calibrated_value

            calibrated_data.append(data)

            # Add Values To Events Collection
            thread = Thread(target=events_collection_insertion, args=(data, "airqo"))
            threads.append(thread)
            thread.start()

        for thread in threads:
            thread.join()

        with self.output().open('w') as f:
            json.dump(list(calibrated_data), f)


def events_collection_insertion(data, tenant):

    try:

        device = data.pop(DataConstants.DEVICE)

        json_data = json.dumps([data])

        headers = {'Content-Type': 'application/json'}
        url = DEVICE_REGISTRY_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers, verify=False)

        if results.status_code == 200:
            print(results.json())
        else:
            print("Device registry failed to insert values. Status Code : " + str(results.status_code))

    except Exception as ex:
        print("Error Occurred while inserting measurements: " + str(ex))

# Insertions have been transferred to the the above class since the time it takes to get
# calibrated values is equal or less to the time it takes to insert measurements
#
# class AddValuesToEventsCollection(luigi.Task):
#
#     def requires(self):
#         return AddCalibratedValues()
#
#     def output(self):
#         return luigi.LocalTarget("data/output.json")
#
#     def run(self):
#         device_measurements = pd.read_json('data/device_measurements_with_calibrated_values.json')
#
#         for index, row in device_measurements.iterrows():
#             events_collection_insertion(row.to_dict(), "airqo")
#
#         with self.output().open('w') as f:
#             json.dump(list([]), f)


if __name__ == '__main__':
    luigi.run()
