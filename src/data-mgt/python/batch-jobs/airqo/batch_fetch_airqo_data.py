import json
import math
import os

import requests
import luigi
import pandas as pd
from google.cloud import bigquery
import traceback

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
CALIBRATE_URL = os.getenv("CALIBRATE_URL")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"


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

        results = requests.get(api_url)

        devices_data = results.json()["devices"]

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

        details = []

        for device_index, device_row in devices.iterrows():

            query = """
            SELECT created_at as time, pm2_5, pm10 , s2_pm2_5,
             s2_pm10, temperature as internalTemperature, humidity as internalHumidity, voltage as battery, altitude,
             no_sats as satellites, hdope as hdop, wind as speed FROM airqo-250220.thingspeak.clean_feeds_pms WHERE
             channel_id={0} ORDER BY created_at
               """.format(int(device_row["channelID"]))

            dataframe = (
                client.query(query).result().to_dataframe()
            )

            for index, row in dataframe.iterrows():

                data = dict({

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

                details.append(data)

        with self.output().open('w') as f:
            json.dump(list(details), f)


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

    post_request = requests.post(url=CALIBRATE_URL, json=data)
    response = post_request.json()

    calibrated_value = None

    for result in response:
        if "calibrated_value" in result:
            calibrated_value = result["calibrated_value"]
            break

    return calibrated_value


class AddCalibratedValues(luigi.Task):

    def requires(self):
        return GetDeviceMeasurements()

    def output(self):
        return luigi.LocalTarget("data/device_measurements_with_calibrated_values.json")

    def run(self):

        device_measurements = pd.read_json('data/device_measurements.json')

        calibrated_data = []

        for index, row in device_measurements.iterrows():

            data = row.to_dict()

            calibrated_value = get_calibrated_value(row[DataConstants.CHANNEL_ID],
                                                    row[DataConstants.TIME],
                                                    row[DataConstants.PM2_5]["value"])

            data[DataConstants.PM2_5]["calibratedValue"] = calibrated_value

            calibrated_data.append(data)

        with self.output().open('w') as f:
            json.dump(list(calibrated_data), f)


def events_collection_insertion(data, tenant):

    try:

        device = data.pop(DataConstants.DEVICE)

        json_data = json.dumps([data])

        headers = {'Content-Type': 'application/json'}
        url = DEVICE_REGISTRY_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers, verify=False)

        print(results.json())

    except Exception:
        print("================ Error Occurred ==================")
        traceback.print_exc()
        print("================ Error End =======================")


class AddValuesToEventsCollection(luigi.Task):

    def requires(self):
        return AddCalibratedValues()

    def output(self):
        return luigi.LocalTarget("data/output.json")

    def run(self):
        device_measurements = pd.read_json('data/device_measurements_with_calibrated_values.json')

        for index, row in device_measurements.iterrows():
            events_collection_insertion(row.to_dict(), "airqo")

        with self.output().open('w') as f:
            json.dump(list([]), f)


if __name__ == '__main__':
    luigi.run()
