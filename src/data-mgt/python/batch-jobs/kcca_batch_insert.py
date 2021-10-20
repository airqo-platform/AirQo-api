from datetime import datetime, timedelta

import pandas as pd
import requests

from config import configuration as config
from utils import DeviceRegistry

"""
:Api Documentation: https://api-guide.clarity.io/
"""


def transform_group(group, site_id, device):

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
            'site_id': site_id,
            "device_id": device,
            'device':  row["deviceCode"],
            'location': dict({
                "longitude": dict({"value":  location[0]}),
                "latitude": {"value": location[1]}}
            )
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

    return transformed_data


class ProcessMeasurements:

    def __init__(self, devices) -> None:
        self.devices = devices
        self.device_codes_str = self.get_devices_codes()
        super().__init__()
    
    def begin_fetch(self):
        interval = f"{config.BATCH_FETCH_TIME_INTERVAL}H"

        dates = pd.date_range(config.START_TIME, config.END_TIME, freq=interval)

        for date in dates:
            start_time = datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')
            end_time = datetime.strftime(date + timedelta(hours=int(config.BATCH_FETCH_TIME_INTERVAL)), '%Y-%m-%dT%H:%M:%SZ')

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
                    transformed_data = transform_group(group, site_id, device_id)

                    if transformed_data:
                        n = int(config.BATCH_OUTPUT_SIZE)
                        sub_lists = [transformed_data[i * n:(i + 1) * n] for i in
                                     range((len(transformed_data) + n - 1) // n)]

                        for sub_list in sub_lists:
                            device_registry = DeviceRegistry(sub_list, "kcca", config.AIRQO_BASE_URL)
                            device_registry.send_to_api()

    def get_raw_measurements(self, start_time, end_time):

        api_url = f"{config.CLARITY_API_BASE_URL}measurements?startTime={start_time}&endTime={end_time}&code={self.device_codes_str}"

        frequency = config.FREQUENCY.strip().lower()
        if frequency == "hour":
            api_url = f"{api_url}&average=hour"
        elif frequency == "day":
            api_url = f"{api_url}&average=day"
        else:
            pass

        headers = {'x-api-key': config.CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
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

        return device_codes[:-1]

    def get_site_and_device_id(self, name):
        # print(self.devices)

        try:
            result = list(filter(lambda device: (device["name"] == name), self.devices))

            if not result:
                print("Device not found")
                return None

            return result[0]["site"]["_id"], result[0]["_id"]
        except Exception as ex:
            print(ex)
            print("Site ID not found")
            return None
