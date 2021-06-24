from datetime import datetime
from dateutil import parser as date_parser
from dateutil.tz import UTC
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
        self.record = self.get_recent_event()

    def get_recent_event(self):
        api_url = f'{configuration.DEVICE_RECENT_EVENTS_URL}?tenant={self.tenant}&channel={self.channel_id}'

        recent_event = requests.get(api_url, verify=False)

        if recent_event.status_code != 200:
            return {}

        return recent_event.json()

    def get_sensor_readings(self):
        if not self.record:
            print(f"Device {self.device_name} has no records")
            return DeviceSensorReadings(
                time=[datetime.now()],
                sensor_one_pm2_5=[],
                sensor_two_pm2_5=[],
                battery_voltage=[]
            )

        return DeviceSensorReadings(
            time=self.record.get("created_at"),
            sensor_one_pm2_5=self.record.get("pm2_5"),
            sensor_two_pm2_5=self.record.get("s2_pm2_5"),
            battery_voltage=self.record.get("voltage")
        )

    def calculate_uptime(self):
        time = self.record.get("created_at")
        uptime, downtime = 0, 100

        if not time:
            return uptime, downtime

        time = date_parser.isoparse(time)
        now = datetime.utcnow()
        now = now.replace(tzinfo=UTC)
        minutes_diff = (now - time).total_seconds() / 60

        if minutes_diff > configuration.MONITOR_FREQUENCY_MINUTES:
            return uptime, downtime
        uptime, downtime = 100, 0

        return uptime, downtime
