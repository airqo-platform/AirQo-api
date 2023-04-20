from datetime import datetime
import logging
from concurrent.futures import ThreadPoolExecutor
from dateutil.tz import UTC
from utils.device_hourly_records import DeviceChannelRecords
from models import Device, NetworkUptime, DeviceUptime


_logger = logging.getLogger(__name__)


def get_device_records(tenant, channel_id, device_name, is_active):
    device_channel_records = DeviceChannelRecords(
        tenant, device_name, channel_id)
    device_records = device_channel_records.get_sensor_readings()
    uptime, downtime = device_channel_records.calculate_uptime()
    sensor_one_pm2_5 = device_records.sensor_one_pm2_5
    sensor_two_pm2_5 = device_records.sensor_two_pm2_5
    battery_voltage = device_records.battery_voltage
    created_at = device_records.time
    created_at = created_at.replace(tzinfo=UTC)

    record = {
        "sensor_one_pm2_5": sensor_one_pm2_5 if sensor_one_pm2_5 else 0,
        "sensor_two_pm2_5": sensor_two_pm2_5 if sensor_two_pm2_5 else 0,
        "battery_voltage": battery_voltage if battery_voltage else 0,
        "device_name": device_name,
        "channel_id": channel_id,
        "uptime": uptime,
        "downtime": downtime,
        "created_at": created_at,
        "is_active": is_active,
    }

    return record


def save_device_uptime(tenant):
    device_model = Device(tenant)
    devices = device_model.get_all_devices()
    records = []
    futures = []
    executor = ThreadPoolExecutor()
    active_device_count = 0

    for device in devices:
        if device.get("network", "") != "airqo" or str(device.get("category", "")).lower() == "bam":
            continue
        if device.get('isActive', None):
            active_device_count += 1

        channel_id = device.get("device_number", None)
        device_name = device.get("name", None)

        if not (channel_id and device_name):
            print("this device could not be processed", device_name)
            continue
        futures.append(
            executor.submit(
                get_device_records,
                tenant,
                channel_id,
                device_name,
                device.get('isActive')
            )
        )
    for future in futures:
        try:
            records.append(future.result())
        except Exception as e:
            import sys
            from traceback import print_tb, print_exc
            from colored import fg, attr
            color_warning = fg('#FF6600')
            reset = attr('reset')
            print("error occurred while fetching data -", e)
            print(color_warning)
            print_exc(file=sys.stdout)
            print(reset)

    network_uptime = 0.0
    if records:
        network_uptime = (
            sum(record.get("uptime", 0.0)
                for record in records if record.get('is_active'))
            / active_device_count
        )

    device_uptime_model = DeviceUptime(tenant)
    device_uptime_model.save_device_uptime(records)

    created_at = datetime.utcnow()
    created_at = created_at.replace(tzinfo=UTC)

    network_uptime_record = {
        "network_name": tenant,
        "uptime": network_uptime,
        "created_at": created_at
    }

    print("network uptime", network_uptime_record)
    network_uptime_model = NetworkUptime(tenant)
    network_uptime_model.save_network_uptime([network_uptime_record])
