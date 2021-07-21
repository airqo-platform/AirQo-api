from datetime import datetime, timedelta

import pandas as pd
import requests

from config import configuration
from kafka_client import KafkaWithoutRegistry
from utils import get_valid_devices

"""
:Api Documentation: https://api-guide.clarity.io/
"""


def transform_group_plain(group, site_id, device_id):

    transformed_data = []

    for _, row in group.iterrows():

        row_data = row
        row_data["average"] = row.get("average", "raw")
        row_data["tenant"] = 'kcca'
        row_data["device"] = device_id  # overriding default kcca device id
        row_data["site_id"] = site_id

        transformed_data.append(row_data.to_dict())

    return transformed_data


class KccaBatchFetch:

    def __init__(self):
        self.kafka_client = KafkaWithoutRegistry(boot_strap_servers=configuration.BOOT_STRAP_SERVERS,
                                                 topic=configuration.OUTPUT_TOPIC)
        self.devices = get_valid_devices(configuration.AIRQO_BASE_URL, "kcca")
        self.device_codes_str = self.__get_devices_codes()
        super().__init__()

    def begin_fetch(self):
        interval = f"{configuration.TIME_INTERVAL}H"

        dates = pd.date_range(configuration.START_TIME, configuration.END_TIME, freq=interval)

        for date in dates:
            start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
            end_time = datetime.strftime(date +
                                         timedelta(hours=int(configuration.TIME_INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

            print(start_time + " : " + end_time)

            raw_measurements = self.get_raw_measurements(start_time, end_time)

            raw_measurements_df = pd.DataFrame(raw_measurements)

            if raw_measurements_df.empty:
                print("No Data at the moment")
                print(raw_measurements_df)
                continue

            raw_measurements_gps = raw_measurements_df.groupby('deviceCode')
            for _, group in raw_measurements_gps:
                device_name = group.iloc[0]['deviceCode']
                site_id, device_id = self.get_site_and_device_id(device_name)

                if site_id:
                    transformed_data = transform_group_plain(group, site_id, device_id)

                    if transformed_data:
                        self.kafka_client.produce(transformed_data)

    def get_raw_measurements(self, start_time, end_time):

        api_url = f"{configuration.CLARITY_API_BASE_URL}measurements?" \
                  f"startTime={start_time}&endTime={end_time}&code={self.device_codes_str}"

        frequency = configuration.FREQUENCY.strip().lower()
        if frequency == "hour":
            api_url = f"{api_url}&average=hour"
        elif frequency == "day":
            api_url = f"{api_url}&average=day"
        else:
            pass

        headers = {'x-api-key': configuration.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
        results = requests.get(api_url, headers=headers)
        if results.status_code != 200:
            print(f"{results}")
            return []
        return results.json()

    def __get_devices_codes(self):

        device_data = list(self.devices)

        device_codes = ""

        for device in device_data:
            device_data = dict(device)
            device_codes = device_codes + f"{device_data.get('name')},"

        return device_codes[:-1]

    def get_site_and_device_id(self, name):

        try:
            result = list(filter(lambda device: (device["name"] == name), self.devices))

            if not result:
                print("Site ID not found")
                return None

            return result[0]["site"]["_id"], result[0]["_d"]
        except Exception as ex:
            print(ex)
            print("Site ID not found")
            return None
