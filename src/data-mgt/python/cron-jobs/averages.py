import traceback
from datetime import datetime, timedelta

import urllib3
from dotenv import load_dotenv

from airqoApi import AirQoApi
from utils import average_values, format_measurements

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class AveragesJob:
    airqo_api = None
    raw_events = []
    averaged_measurements = []

    def __init__(self):
        self.airqo_api = AirQoApi()
        self.hours = 48

    def average(self):
        self.get_events()
        self.average_measurements()
        self.save_averaged_measurements()

    def get_events(self):

        # ####
        # Getting devices
        # ####

        devices = self.airqo_api.get_devices(tenant='airqo')
        devices_list = list(devices)

        if len(devices_list) == 0:
            print("devices empty")
            return

        # ####
        # Getting events
        # ####

        time = datetime.utcnow()
        start_time = (time - timedelta(hours=self.hours)).strftime('%Y-%m-%dT00:00:00Z')
        end_time = (datetime.strptime(start_time, '%Y-%m-%dT00:00:00Z') + timedelta(hours=self.hours-1)) \
            .strftime('%Y-%m-%dT23:59:00Z')

        print(f'UTC start time : {start_time}')
        print(f'UTC end time : {end_time}')

        for device in devices_list:

            try:
                if 'name' not in device.keys():
                    print(f'name missing in device keys : {device}')
                    continue

                device_name = device['name']
                events = self.airqo_api.get_events(tenant='airqo', start_time=start_time, frequency="hourly",
                                                   end_time=end_time, device=device_name)

                if not events:
                    print(f"No measurements for {device_name} : startTime {start_time} : endTime : {end_time}")
                    continue

                self.raw_events.extend(events)
            except:
                traceback.print_exc()

    def average_measurements(self):
        # ####
        # Averaging
        # ####

        if len(self.raw_events) == 0:
            print("events list is empty")
            return

        self.averaged_measurements = average_values(self.raw_events, '24H')

    def save_averaged_measurements(self):
        # ####
        # Saving averaged values
        # ####
        if not self.averaged_measurements:
            print("averaged measurements list is empty")
            return
        formatted_measurements = format_measurements(self.averaged_measurements, "daily")
        self.airqo_api.post_events(formatted_measurements, 'airqo')


def main():
    averages_job = AveragesJob()
    averages_job.average()
