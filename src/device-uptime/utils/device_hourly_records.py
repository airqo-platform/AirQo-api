from datetime import datetime, timedelta
import pandas as pd
import requests
import urllib3
from dataclasses import dataclass
from config import configuration

# disable tls/ssl warnings
urllib3.disable_warnings()


@dataclass
class DeviceSensorReadings:
    sensor_one_pm2_5: list
    sensor_two_pm2_5: list
    battery_voltage: list
    time: list


class DeviceChannelRecords:

    def __init__(self, tenant, device_name, channel_id):
        self.tenant = tenant
        self.device_name = device_name
        self.channel_id = channel_id
        self.records = self.get_device_daily_events()
        self.df = pd.DataFrame(self.flatten_records())

    def get_device_daily_events(self):
        yesterday = datetime.strftime(datetime.now() - timedelta(1), '%Y-%m-%d')

        api_url = f'{configuration.DAILY_EVENTS_URL}?tenant={self.tenant}&device={self.device_name}'
        api_url = f'{api_url}&startTime={yesterday}&endTime={yesterday}&recent=no'

        device_events = requests.get(api_url, verify=False)

        if device_events.status_code != 200:
            return []

        return device_events.json().get("measurements", [])

    def flatten_records(self):
        return [
            {
              "time": record["time"],
              "s1_pm2_5": record["pm2_5"]["value"],
              "s2_pm2_5": record["s2_pm2_5"]["value"],
              "voltage": record["battery"]["value"],
            }
            for record in self.records
        ]

    def get_sensor_readings(self):
        if not self.records:
            raise Exception(f"Device {self.device_name} has no records")

        self.df['time'] = pd.to_datetime(self.df['time'])
        time_indexed_data = self.df.set_index('time')

        # change frequency to hours
        hourly_data = time_indexed_data.resample('H').mean().round(2)
        daily_data = hourly_data.resample('D').mean().dropna()
        sensor_one_pm2_5 = daily_data['s1_pm2_5'].tolist()
        sensor_two_pm2_5 = daily_data['s2_pm2_5'].tolist()
        battery_voltage = daily_data['voltage'].tolist()
        time = daily_data.index.tolist()

        return DeviceSensorReadings(
            time=time,
            sensor_one_pm2_5=sensor_one_pm2_5,
            sensor_two_pm2_5=sensor_two_pm2_5,
            battery_voltage=battery_voltage
        )

    def get_record_count(self):

        time_indexed_data = self.df.set_index('time')

        # change frequency to hours
        hourly_data = time_indexed_data.resample('H').mean().round(2)

        return hourly_data.dropna().reset_index().shape[0]

    @staticmethod
    def get_expected_records_count(mobility):
        """
        We are considering hourly values
        So that means that in a day, a static device should generate 24 records
        Mobile devices should generate 12 (half of that)
        """
        total_records_per_day = 24
        if str(mobility).lower() == 'mobile' or str(mobility).lower() == "true":
            return total_records_per_day / 2
        return total_records_per_day

    def calculate_uptime(self, mobility):
        percent_100 = 100
        expected_records = self.get_expected_records_count(mobility)
        actual_records = self.get_record_count()
        uptime = round((actual_records / expected_records) * percent_100, 2)

        if uptime > percent_100:
            uptime = percent_100

        downtime = percent_100 - uptime

        return uptime, downtime
