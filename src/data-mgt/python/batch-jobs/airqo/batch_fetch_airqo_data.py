import json
import math
import os
from threading import Thread

import requests
import luigi
import pandas as pd
from google.cloud import bigquery
import traceback

DEVICE_REGISTRY_BASE_URL = os.getenv("DEVICE_REGISTRY_BASE_URL")
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "bigquery.json"

"""
Luigi task to fetch all airqo devices
"""
class GetAirqoDevices(luigi.Task):

    def run(self):

        api_url = DEVICE_REGISTRY_BASE_URL + "devices?tenant=airqo"

        results = requests.get(api_url)

        devices_data = results.json()["devices"]

        with self.output().open('w') as f:
            json.dump(list(devices_data), f)

    def output(self):
        return luigi.LocalTarget("data/devices.json")


"""
formatting all values to float else null
"""
def check_float(string):

    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


def events_collection_insertion(data, tenant):

    try:

        device = data.pop("device")

        json_data = json.dumps([data])

        headers = {'Content-Type': 'application/json'}
        url = DEVICE_REGISTRY_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers, verify=False)

        print(results.json())

    except Exception:
        print("================ Error Occurred ==================")
        traceback.print_exc()
        print("================ Error End ==================")


class GetDeviceMeasurements(luigi.Task):

    def requires(self):
        return GetAirqoDevices()

    def output(self):
        return luigi.LocalTarget("data/device_measurements.json")

    def run(self):

        client = bigquery.Client()

        devices = pd.read_json('data/devices.json')

        details = []

        # create a to hold all threads
        threads = []

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

                thread = Thread(target=events_collection_insertion, args=(data, "airqo"))
                threads.append(thread)
                thread.start()

        # wait for all threads to terminate before ending the function
        for thread in threads:
            thread.join()

        with self.output().open('w') as f:
            json.dump(list(details), f)


if __name__ == '__main__':
    luigi.run()
