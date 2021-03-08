import json
import math
import os

import requests
import luigi
import pandas as pd
from google.cloud import bigquery

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
FEEDS_BASE_URL = os.getenv("FEEDS_BASE_URL")


class GetAirqoDevices(luigi.Task):

    def run(self):
        """
        gets all airqo devices
        """
        api_url = AIRQO_API_BASE_URL + "devices?tenant=airqo"

        results = requests.get(api_url)

        devices_data = results.json()["devices"]

        with self.output().open('w') as f:
            json.dump(list(devices_data), f)

    def output(self):
        return luigi.LocalTarget("data/devices.json")


def check_float(string):
    # formatting all values to float else null
    try:
        value = float(string)
        if math.isnan(value):
            return ''
        return value
    except Exception:
        return ''


class GetDeviceMeasurements(luigi.Task):
    """
    Gets the device measurements
    """

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
             channel_id={0} ORDER BY created_at ASC
               """.format(int(device_row["channelID"]))

            dataframe = (
                client.query(query).result().to_dataframe()
            )

            for index, row in dataframe.iterrows():

                data = dict({

                    "device": device_row['name'],
                    "channelID": device_row["channelID"],

                    "location": {"latitude": {"value": check_float(device_row["latitude"])},
                                 "longitude": {"value": check_float(device_row["longitude"])}},

                    "frequency": "minute",
                    "time": pd.Timestamp(row["time"]).isoformat(),
                    "pm2_5": {"value": check_float(row["pm2_5"])},
                    "pm10": {"value": check_float(row["pm10"])},
                    "s2_pm2_5": {"value": check_float(row["s2_pm2_5"])},
                    "s2_pm10": {"value": check_float(row["s2_pm10"])},
                    "battery": {"value": check_float(row["battery"])},
                    "altitude": {"value": check_float(row["altitude"])},
                    "speed": {"value": check_float(row["speed"])},
                    "satellites": {"value": check_float(row["satellites"])},
                    "hdop": {"value": check_float(row["hdop"])},
                    "internalTemperature": {"value": check_float(row["internalTemperature"])},
                    "internalHumidity": {"value": check_float(row["internalHumidity"])},
                })

                details.append(data)

            # if device_index > 10:
            #     break

        with self.output().open('w') as f:
            json.dump(list(details), f)


class UpdateCollections(luigi.Task):

    def requires(self):
        return GetDeviceMeasurements()

    def output(self):
        pass

    def run(self):

        device_measurements = pd.read_json('/data/device_measurements.json')

        for index, data in device_measurements.iterrows():

            try:

                # extract the component name and device id from the data
                device = data.pop("device")

                # create a json object of the remaining data and post to events table
                json_data = json.dumps([data.to_dict()])
                # print(json_data)
                headers = {'Content-Type': 'application/json'}
                url = AIRQO_API_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + "airqo"

                results = requests.post(url, json_data, headers=headers)

                print(results.json())

            except Exception as e:
                print("================ Error Occurred ==================")
                print(e)
                print("================ Error End ==================")


if __name__ == '__main__':
    luigi.run()
