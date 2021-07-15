import json
import os
from datetime import datetime, timedelta

import pandas as pd
import requests

from kafkaRegistry import KafkaWithoutRegistry

CLARITY_API_KEY = os.getenv("CLARITY_API_KEY", None)
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL", "https://clarity-data-api.clarity.io/v1/")
DEVICE_REGISTRY_URL = os.getenv("DEVICE_REGISTRY_URL", "https://staging-platform.airqo.net/api/v1/")
FREQUENCY = os.getenv("FREQUENCY", "raw")
START_TIME = os.getenv("START_TIME", "2019-09-01")
END_TIME = os.getenv("END_TIME", "2021-12-31")
INTERVAL = os.getenv("INTERVAL", "1")

os.environ["PYTHONWARNINGS"] = "ignore:Unverified HTTPS request"

BOOT_STRAP_SERVERS = os.getenv("BOOT_STRAP_SERVERS", "127.0.0.1:9092")
OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC", "quickstart-events")

"""
:Api Documentation: https://api-guide.clarity.io/
"""

class ProcessMeasurements:

    def __init__(self, devices) -> None:
        self.devices = devices
        super().__init__()
    
    def begin_fetch(self):
        self.get_devices_codes()
        self.kafka = KafkaWithoutRegistry(boot_strap_servers=BOOT_STRAP_SERVERS, topic=OUTPUT_TOPIC)
        self.get_device_measurements()

    def get_device_measurements(self):

        interval = INTERVAL + "H"

        dates = pd.date_range(START_TIME, END_TIME, freq=interval)

        for date in dates:

            start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
            end_time = datetime.strftime(date + timedelta(hours=int(INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

            print(start_time + " : " + end_time)

            # get all kcca device measurements
            device_measurements_data = self.get_device_data(start_time, end_time)
            
            # # process all kcca device measurements
            self.transform_kcca_data(device_measurements_data)


    def get_device_data(self, start_time, end_time):

        api_url = f"{CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}&code={self.device_codes_str}"

        frequency = FREQUENCY.strip().lower()
        if frequency == "hour":
            api_url = f"{api_url}&average=hour"
        elif frequency == "day":
            api_url = f"{api_url}&average=day"
        else:
            pass

        headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        if results.status_code != 200:
            print(f"{results}")
            return []
        return results.json()


    def get_devices_codes(self):

        device_data = list(self.devices)

        device_codes = ""

        for device in device_data:
            device_data = dict(device)
            device_codes = device_codes + f"{device_data.get('name')},"
        
        self.device_codes_str =  device_codes[:-1]


    def transform_kcca_data(self, data):

        raw_data = pd.DataFrame(data)

        if raw_data.empty:
            print("No Data at the moment")
            print(raw_data)
            return

        device_groups = raw_data.groupby('deviceCode')
        for _, group in device_groups:
            self.transform_group_plain(group)
            # self.transform_group(group)


    def transform_group_plain(self, group):

        device_name = group.iloc[0]['deviceCode']
        site_id = self.get_site_id(device_name)
        transformed_data = []

        # loop through the device measurements, transform and insert
        for _, row in group.iterrows():

            row_data = row

            row_data["average"] = row.get("average", "raw")
            row_data["tenant"] = 'kcca'
            row_data["channelID"] = row.get("deviceCode", None)
            row_data["site_id"] = site_id

            transformed_data.append(row_data.to_json())

        if transformed_data:
            n = 20
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                self.kafka.produce(json.dumps(sub_list))


    def transform_group(self, group):

        device_name = group.iloc[0]['deviceCode']
        site_id = self.get_site_id(device_name)
        transformed_data = []

        # loop through the device measurements, transform and insert
        for index, row in group.iterrows():

            location = row["location"]["coordinates"]

            frequency = row.get("average", "raw")

            time = str(row.get("time"))

            if frequency == "hour":
                frequency = "hourly"

            if frequency == "day":
                frequency = "daily"

            row_data = dict({
                'frequency': frequency,
                'time': time,
                'tenant': 'kcca',
                'channelID': row["deviceCode"],
                'site_id': site_id,
                'device':  row["deviceCode"],
                'location': dict({
                    "longitude": dict({"value":  location[0]}), "latitude": {"value": location[1]}})
            })

            # create a series to hold the device components
            device_components = pd.Series(row["characteristics"])

            # loop through each component on the device
            for component_type in device_components.keys():

                conversion_units = dict({
                    "temperature": "internalTemperature",
                    "relHumid": "internalHumidity",
                    "pm10ConcMass": "pm10",
                    "pm2_5ConcMass": "pm2_5",
                    "no2Conc": "no2",
                    "pm1ConcMass": "pm1"
                })

                try:
                    row_data[conversion_units[component_type]] = dict({
                        'value': device_components[component_type]["raw"]
                    })

                except KeyError:
                    continue

                if "calibratedValue" in device_components[component_type].keys():
                    row_data[conversion_units[component_type]]['calibratedValue'] = device_components[component_type]["calibratedValue"]
                else:
                    row_data[conversion_units[component_type]]['calibratedValue'] = device_components[component_type]["value"]

                transformed_data.append(row_data)

        if transformed_data:
            n = 20
            sub_lists = [transformed_data[i * n:(i + 1) * n] for i in range((len(transformed_data) + n - 1) // n)]

            for sub_list in sub_lists:
                self.kafka.produce(json.dumps(sub_list))


    def get_site_id(self, name):

        result = list(filter(lambda device: (device["name"] == name), self.devices))
        if result is not None:
            return result[0]["site_id"]
        return None


def get_kcca_devices():
    """
    gets all kcca devices from netmanager
    :return: list of devices
    """
    api_url = DEVICE_REGISTRY_URL + "devices?tenant=kcca&active=yes"
    results = requests.get(api_url, verify=False)

    if results.status_code != 200:
        return []

    devices = list(results.json()["devices"])
    return devices


def filter_valid_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys() and "device_number" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices



if __name__ == "__main__":

    kcca_devices = get_kcca_devices()
    filtered_devices = filter_valid_devices(kcca_devices)
    if len(filtered_devices) > 0:
        process_measurements = ProcessMeasurements(filtered_devices)
        process_measurements.begin_fetch()
    else:
        print("No valid devices")
