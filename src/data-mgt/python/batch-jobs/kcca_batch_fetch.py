from datetime import timedelta

import pandas as pd
import requests

from config import configuration
from date import date_to_str
from kafka_client import KafkaWithoutRegistry
from utils import get_valid_devices

"""
:Api Documentation: https://api-guide.clarity.io/
"""


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
            start_time = date_to_str(date)
            end_time = date_to_str(date + timedelta(hours=int(configuration.TIME_INTERVAL)))

            print(start_time + " : " + end_time)

            measurements = self.__get_measurements(start_time, end_time)

            measurements_df = pd.DataFrame(measurements)

            if measurements_df.empty:
                print("No Data at the moment")
                print(measurements_df)
                continue

            transformed_data = []
            for _, row in measurements_df.iterrows():

                measurement = row.to_dict()
                transformed_data.append(measurement)

            if transformed_data:
                self.kafka_client.produce(transformed_data)

    def __get_measurements(self, start_time, end_time):

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
            print(f"{results.content}")
            return []
        return results.json()

    def __get_devices_codes(self):

        device_data = list(self.devices)

        device_codes = ""

        for device in device_data:
            device_data = dict(device)
            device_codes = device_codes + f"{device_data.get('name')},"

        return device_codes[:-1]
