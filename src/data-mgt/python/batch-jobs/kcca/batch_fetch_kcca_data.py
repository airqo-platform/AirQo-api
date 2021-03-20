import json
import os
from datetime import timedelta, datetime
from threading import Thread

import requests
import luigi
import pandas as pd
import traceback

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
START_DATE_TIME = os.getenv("START_DATE_TIME")
STOP_DATE_TIME = os.getenv("STOP_DATE_TIME")


class GetKccaDevices(luigi.Task):

    def run(self):
        """
        gets all kcca device codes
        """

        headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        api_url = CLARITY_API_BASE_URL + "devices"
        results = requests.get(api_url, headers=headers)

        device_data = pd.DataFrame(results.json())

        device_codes = []

        for index, row in device_data.iterrows():
            device_codes.append(row['code'])

        with self.output().open('w') as f:
            json.dump(list(device_codes), f)

    def output(self):
        return luigi.LocalTarget("data/devices.json")


def events_collection_insertion(data, tenant):

    try:
        device = data.pop("device")

        json_data = json.dumps([data])
        # print(json_data)
        headers = {'Content-Type': 'application/json'}
        url = AIRQO_API_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + tenant

        results = requests.post(url, json_data, headers=headers)

        print(results.json())

    except Exception as e:
        print("================ Error Occurred ==================")
        print(e)
        traceback.print_exc()
        print("================ Error End ==================")


class GetDeviceMeasurements(luigi.Task):
    """
    Gets the device measurements
    """

    def requires(self):
        return GetKccaDevices()

    def output(self):
        return luigi.LocalTarget("data/device_measurements.json")

    def run(self):

        # get kcca devices
        device_codes = pd.read_json('data/devices.json')

        start_date = datetime.strptime(START_DATE_TIME, '%Y-%m-%dT%H:%M:%SZ')
        stop_date = datetime.strptime(STOP_DATE_TIME, '%Y-%m-%dT%H:%M:%SZ')

        end_date = start_date

        device_measurements = []

        for index, code in device_codes.iterrows():

            while stop_date > end_date:

                end_date = start_date + timedelta(days=5)

                # compose a url to get device measurements for one
                api_url = CLARITY_API_BASE_URL + "measurements?startTime=" + \
                          datetime.strftime(start_date, '%Y-%m-%dT%H:%M:%SZ') + "&endTime=" + \
                          datetime.strftime(end_date, '%Y-%m-%dT%H:%M:%SZ') + "&code=" + code.values[0]

                # get the device measurements
                headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
                results = requests.get(api_url, headers=headers)

                if results.json():
                    json_data = pd.DataFrame(results.json())

                    for data_index, data_row in json_data.iterrows():
                        device_measurements.append(data_row.to_dict())

                start_date = end_date

        with self.output().open('w') as f:
            json.dump(list(device_measurements), f)


class ProcessMeasurements(luigi.Task):

    def requires(self):
        return GetDeviceMeasurements()

    def output(self):
        return luigi.LocalTarget("data/processed_device_measurements.json")

    def run(self):

        device_measurements = pd.read_json('data/device_measurements.json')
        processed_measurements = []

        # create a to hold all threads
        threads = []

        for index, row in device_measurements.iterrows():

            try:

                location = row["location"]["coordinates"]

                data = dict({
                    'frequency': "day",
                    'time': row["time"],
                    'device': row["deviceCode"],
                    'location': dict({
                        "longitude": dict({"value": location[0]}), "latitude": {"value": location[1]}})
                })

                # create a dataframe to hold the device components
                device_components = pd.Series(row["characteristics"])

                # loop through each component on the device
                for component_type in device_components.keys():

                    CONVERSION_UNITS = dict({
                        "temperature": "internalTemperature",
                        "relHumid": "internalHumidity",
                        "pm10ConcMass": "pm10",
                        "pm2_5ConcMass": "pm2_5",
                        "no2Conc": "no2",
                        "pm1ConcMass": "pm1"

                    })

                    try:
                        data[CONVERSION_UNITS[component_type]] = dict({
                            'value': device_components[component_type]["value"]
                        })
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

                    if "calibratedValue" in device_components[component_type].keys():
                        data[CONVERSION_UNITS[component_type]]['calibratedValue'] = device_components[component_type][
                            "calibratedValue"]

                processed_measurements.append(data)

                thread = Thread(target=events_collection_insertion, args=(data, "kcca"))
                threads.append(thread)
                thread.start()

            except Exception as ex:
                print(ex)
                traceback.print_exc()

        # wait for all threads to terminate before ending the function
        for thread in threads:
            thread.join()

        with self.output().open('w') as f:
            json.dump(list(processed_measurements), f)


if __name__ == '__main__':
    luigi.run()
