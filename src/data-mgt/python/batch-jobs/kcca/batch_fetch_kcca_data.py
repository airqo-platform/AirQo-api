import json
import os
from datetime import timedelta, datetime

import requests
import luigi
import pandas as pd

AIRQO_API_BASE_URL = os.getenv("AIRQO_API_BASE_URL")
CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")


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

        start_date = datetime.strptime('2019-09-01T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')
        stop_date = datetime.strptime('2021-01-01T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')
        stop_date = datetime.strptime('2019-10-30T00:00:00Z', '%Y-%m-%dT%H:%M:%SZ')
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
                        continue

                    if "calibratedValue" in device_components[component_type].keys():
                        data[CONVERSION_UNITS[component_type]]['calibratedValue'] = device_components[component_type][
                            "calibratedValue"]

                processed_measurements.append(data)

            except Exception as ex:
                print(ex)


        with self.output().open('w') as f:
            json.dump(list(processed_measurements), f)


class UpdateCollections(luigi.Task):

    def requires(self):
        return ProcessMeasurements()

    def output(self):
        pass

    def run(self):

        device_measurements = pd.read_json('data/processed_device_measurements.json')

        for index, data in device_measurements.iterrows():

            try:

                # extract the component name and device id from the data
                device = data.pop("device")

                # create a json object of the remaining data and post to events table
                json_data = json.dumps([data.to_dict()])
                # print(json_data)
                headers = {'Content-Type': 'application/json'}
                url = AIRQO_API_BASE_URL + "devices/events/add?device=" + device + "&tenant=" + "kcca"

                results = requests.post(url, json_data, headers=headers)

                print(results.json())

            except Exception as e:
                print("================ Error Occurred ==================")
                print(e)
                print("================ Error End ==================")


if __name__ == '__main__':
    luigi.run()
