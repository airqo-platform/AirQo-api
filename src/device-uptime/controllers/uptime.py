from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor
from helpers.get_device_hourly_records_count import DeviceChannelRecords
from models import Device, NetworkUptime, DeviceUptime


_logger = logging.getLogger(__name__)


def get_device_records(tenant, channel_id, device_name, mobility):
    device_channel_records = DeviceChannelRecords(tenant, device_name, channel_id)
    device_records = device_channel_records.get_sensor_readings()
    uptime, downtime = device_channel_records.calculate_uptime(mobility)
    created_at = datetime.now()
    sensor_one_pm2_5 = device_records.sensor_one_pm2_5
    sensor_two_pm2_5 = device_records.sensor_two_pm2_5
    battery_voltage = device_records.battery_voltage

    record = {
        "sensor_one_pm2_5": sensor_one_pm2_5 and sensor_one_pm2_5[0] or 0,
        "sensor_two_pm2_5": sensor_two_pm2_5 and sensor_two_pm2_5[0] or 0,
        "battery_voltage": battery_voltage and battery_voltage[0] or 0,
        "device_name": device_name,
        "channel_id": channel_id,
        "uptime": uptime,
        "downtime": downtime,
        "created_at": created_at.isoformat()
    }

    return record


def save_device_uptime(tenant):
    device_model = Device(tenant)
    devices = device_model.get_active_devices()
    records = []
    futures = []
    executor = ThreadPoolExecutor()

    for device in devices:
        channel_id = device.get("channelID")
        mobility = device.get("mobility")
        device_name = device.get("name")
        if not (channel_id and device_name):
            print("this device could not be processed", device_name)
            continue
        futures.append(
            executor.submit(
                get_device_records,
                tenant,
                channel_id,
                device_name,
                mobility
            )
        )
    for future in futures:
        try:
            records.append(future.result())
        except Exception as e:
            print("error occurred while fetching data -", e)

    network_uptime = 0.0

    if records:
        network_uptime = sum(record.get("uptime", 0.0) for record in records) / len(records)

    device_uptime_model = DeviceUptime(tenant)
    device_uptime_model.save_device_uptime(records)

    network_uptime_record = {
        "network_name": tenant,
        "uptime": network_uptime,
        "created_at": datetime.now().isoformat()
    }

    print("network uptime", network_uptime_record)
    network_uptime_model = NetworkUptime(tenant)
    network_uptime_model.save_network_uptime([network_uptime_record])



