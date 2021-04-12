import copy
import glob
import json
import math
import os
from datetime import datetime

import requests
import luigi
import pandas as pd
from google.cloud import bigquery
import traceback

CALIBRATE_URL = os.getenv("CALIBRATE_URL")
START_DATE_TIME = os.getenv("START_DATE_TIME")
STOP_DATE_TIME = os.getenv("STOP_DATE_TIME")
DEVICE_REGISTRY_STAGING_URL = os.getenv("DEVICE_REGISTRY_STAGING_URL")
DEVICE_REGISTRY_PRODUCTION_URL = os.getenv("DEVICE_REGISTRY_PRODUCTION_URL")
INSERTION_ENVIRONMENT = os.getenv("INSERTION_ENVIRONMENT")
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


class Environment:
    STAGING = "staging"
    PRODUCTION = "production"
    BOTH = "both"


class DeviceRegistry:

    def __init__(self, measurements):
        self.__measurements = measurements
        self.__tenant = "airqo"

        if INSERTION_ENVIRONMENT == Environment.STAGING:
            self.__url = DEVICE_REGISTRY_STAGING_URL
        elif INSERTION_ENVIRONMENT == Environment.PRODUCTION:
            self.__url = DEVICE_REGISTRY_PRODUCTION_URL
        elif INSERTION_ENVIRONMENT == Environment.BOTH:
            self.__url = None
        else:
            raise Exception("Environment not specified")

    def insert_measurements(self):

        if self.__url is None:

            self.__add_to_events_collection(DEVICE_REGISTRY_PRODUCTION_URL)
            self.__add_to_events_collection(DEVICE_REGISTRY_STAGING_URL)

        else:
            self.__add_to_events_collection(None)

    def __add_to_events_collection(self, base_endpoint):

        data = copy.deepcopy(self.__measurements)

        if base_endpoint is None:
            base_url = self.__url
        else:
            base_url = base_endpoint

        try:
            device = data.pop("device")

            json_data = json.dumps([data])

            headers = {'Content-Type': 'application/json'}

            base_url = base_url + "devices/events/add?device=" + device + "&tenant=" + self.__tenant

            results = requests.post(base_url, json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print("Device registry failed to insert values. Status Code : " + str(results.status_code)
                      + ", Url : " + base_url
                      + ", Data : " + json_data
                      + "\n")

        except Exception as ex:
            traceback.print_exc()
            print("Error Occurred while inserting measurements: " + str(ex))


class GetAirqoDevices(luigi.Task):
    """
    Luigi task to fetch all airqo devices
    """

    def run(self):

        if INSERTION_ENVIRONMENT == Environment.PRODUCTION:
            api_url = DEVICE_REGISTRY_PRODUCTION_URL + "devices?tenant=airqo"
        else:
            api_url = DEVICE_REGISTRY_STAGING_URL + "devices?tenant=airqo"

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


def str_to_date(string):
    return datetime.strptime(string, '%Y-%m-%dT%H:%M:%SZ').isoformat()


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

        device_measurements = pd.read_json('data/device_measurements.json')

        for index, row in device_measurements.iterrows():

            data = row.to_dict()

            # calibrated_value = get_calibrated_value(row[DataConstants.CHANNEL_ID],
            #                                         row[DataConstants.TIME],
            #                                         row[DataConstants.PM2_5]["value"])
            #
            # if calibrated_value is not None:
            #     data[DataConstants.PM2_5]["calibratedValue"] = calibrated_value

            # Add Values To Events Collection
            device_registry = DeviceRegistry(data)
            device_registry.insert_measurements()

        with self.output().open('w') as f:
            json.dump(list([]), f)


class AddExistingValuesToEventsCollection(luigi.Task):

    def requires(self):
        return GetAirqoDevices()

    def output(self):
        return luigi.LocalTarget("data/output/output.json")

    def run(self):

        device_measurements_files = glob.glob('data/measurements/*.csv')

        devices = pd.read_json('data/devices.json')

        for filename in device_measurements_files:

            device_measurements = pd.read_csv(filename, index_col=None, header=0)

            for index, row in device_measurements.iterrows():

                device_name = None
                device_location = dict({
                    "latitude": None,
                    "longitude": None
                })

                for device_index, device_row in devices.iterrows():
                    if str(device_row['channelID']) == str(row["channel_id"]):
                        device_name = device_row['name']
                        if "latitude" in device_row.keys() and "longitude" in device_row.keys():
                            device_location["latitude"] = device_row["latitude"]
                            device_location["longitude"] = device_row["longitude"]
                        break

                if device_name is None:
                    continue

                device_data = dict({
                    DataConstants.DEVICE: device_name,
                    DataConstants.CHANNEL_ID: row["channel_id"],
                    DataConstants.LOCATION: {"latitude":
                                                 {"value": check_float(device_location.get("latitude"))},
                                             "longitude":
                                                 {"value": check_float(device_location.get("longitude"))}
                                             },
                    DataConstants.FREQUENCY: "minute",
                    DataConstants.TIME: pd.Timestamp(row["created_at"]).isoformat(),
                    DataConstants.PM2_5: {"value": check_float(row["pm2_5"])},
                    DataConstants.PM10: {"value": check_float(row["pm10"])},
                    DataConstants.S2_PM2_5: {"value": check_float(row["s2_pm2_5"])},
                    DataConstants.S2_PM10: {"value": check_float(row["s2_pm10"])},
                    DataConstants.BATTERY: {"value": check_float(row["voltage"])},
                    DataConstants.ALTITUDE: {"value": check_float(row["altitude"])},
                    DataConstants.SPEED: {"value": check_float(row["wind"])},
                    DataConstants.SATELLITES: {"value": check_float(row["no_sats"])},
                    DataConstants.HDOP: {"value": check_float(row["hdope"])},
                    DataConstants.INTERNAL_TEMP: {"value": check_float(row["temperature"])},
                    DataConstants.INTERNAL_HUM: {"value": check_float(row["humidity"])},
                })

                device_registry = DeviceRegistry(device_data)
                device_registry.insert_measurements()

        with self.output().open('w') as f:
            json.dump(list([]), f)


if __name__ == '__main__':
    luigi.run()
