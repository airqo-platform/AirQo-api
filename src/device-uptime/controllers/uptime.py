from datetime import datetime
import logging
from helpers import calculate_uptime, get_expected_records_count
from helpers.get_device_hourly_records_count import DeviceChannelRecords
from models.device import Device
from models import device_uptime
from models.network_uptime import NetworkUptime
from concurrent.futures import ThreadPoolExecutor


_logger = logging.getLogger(__name__)


def compute_device_uptime(mobility, channel_id):
    """
    specify the expected number of records
    get actual hourly records for the device
    we use the method for calculating uptime
    """

    expected_records_count = get_expected_records_count.get_expected_records_count(
        mobility)

    device_channel_records_class = DeviceChannelRecords(channel_id)
    device_hourly_records = device_channel_records_class.get_count()

    return calculate_uptime.calculate_device_uptime(expected_records_count, device_hourly_records)


def get_device_record(channel_id, device_name, mobility):

    device_channel_records_class = DeviceChannelRecords(channel_id)
    sensor_one_pm2_5_readings, sensor_two_pm2_5_readings, battery_voltage_readings, time_readings = device_channel_records_class.get_sensor_readings()
    device_uptime_in_percentage, device_downtime_in_percentage = compute_device_uptime(
        mobility, channel_id)
    created_at = datetime.now()

    record = {
        "sensor_one_pm2_5": sensor_one_pm2_5_readings and sensor_one_pm2_5_readings[0] or 0,
        "sensor_two_pm2_5": sensor_two_pm2_5_readings and sensor_two_pm2_5_readings[0] or 0,
        "battery_voltage": battery_voltage_readings and battery_voltage_readings[0] or 0,
        "device_name": device_name,
        "channel_id": channel_id,
        "uptime": device_uptime_in_percentage,
        "downtime": device_downtime_in_percentage,
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
        mobility = device.get("mobililty")
        device_name = device.get("name")
        if not (channel_id and device_name):
            print("this device could not be processed", device_name)
            continue
        futures.append(executor.submit(get_device_record,
                                       channel_id, device_name, mobility))
    for future in futures:
        try:
            records.append(future.result())
        except Exception as e:
            print("error occured while fetching data from channel", e)

    network_uptime = sum(record.get("uptime", 0.0)
                         for record in records) / len(records)

    device_uptime_model = device_uptime.DeviceUptime(tenant)
    device_uptime_model.save_device_uptime(records)

    network_uptime_record = {
        "network_name": tenant,
        "uptime": network_uptime,
        "created_at": datetime.now().isoformat()
    }

    network_uptime_model = NetworkUptime(tenant)
    print("network_uptime_record", network_uptime_record)
    network_uptime_model.save_network_uptime([network_uptime_record])



