from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import math
import requests
import logging
from dataclasses import dataclass
import urllib3

from models import Device, DeviceStatus as DeviceStatusModel
from config import configuration
from utils import str_to_date, date_to_str


_logger = logging.getLogger(__name__)

# disable tls/ssl warnings
urllib3.disable_warnings()


@dataclass
class DeviceStatus:
    is_online: bool
    elapsed_time: float
    device: dict


def get_all_devices(tenant):
    model = Device(tenant)
    results = model.get_devices()
    return [device for device in results if device.get("isActive")]


def get_device_status(device):
    print("Scheduled querying channel for", device.get("device_number"))
    channel_id = device["device_number"]
    api_url = f'{configuration.RECENT_FEEDS_URL}?channel={channel_id}'
    if not channel_id:
        return DeviceStatus(is_online=False, elapsed_time=-1, device=device)

    device_status = requests.get(api_url, verify=False)

    if device_status.status_code != 200:
        return DeviceStatus(is_online=False, elapsed_time=-1, device=device)

    result = device_status.json()

    device["_id"] = str(device.get("_id"))
    device["site_id"] = str(device.get("site_id"))

    current_datetime = datetime.utcnow()

    date_time_difference = current_datetime - datetime.strptime(result['created_at'], '%Y-%m-%dT%H:%M:%SZ')
    time_difference = date_time_difference.total_seconds()
    six_hours = 21600  # in seconds

    if time_difference < six_hours:
        return DeviceStatus(is_online=True, elapsed_time=time_difference, device=device)
    return DeviceStatus(is_online=False, elapsed_time=time_difference, device=device)


def compute_device_channel_status(tenant):
    devices = get_all_devices(tenant)
    count_of_online_devices = 0
    online_devices = []
    offline_devices = []
    count_of_offline_devices = 0
    count_of_solar_devices = 0
    count_of_alternator_devices = 0
    count_of_mains = 0
    count_due_maintenance = 0
    count_overdue_maintenance = 0
    count_unspecified_maintenance = 0

    futures = []
    executor = ThreadPoolExecutor()

    for device in devices:
        futures.append(executor.submit(get_device_status, device))

    for future in futures:
        try:
            device_status = future.result()
        except Exception as ex:
            print("Cannot process channel", ex)
            continue
        device = device_status.device

        try:
            maintenance_status = (device.get("nextMaintenance") - datetime.utcnow()).total_seconds()

            two_weeks_in_seconds = 1209600

            if maintenance_status < 0:
                device["maintenance_status"] = "overdue"
                count_overdue_maintenance += 1
            elif maintenance_status < two_weeks_in_seconds:
                device["maintenance_status"] = "due"
                count_due_maintenance += 1
            else:
                device["maintenance_status"] = "good"

        except Exception:
            device["nextMaintenance"] = None
            device["maintenance_status"] = -1
            count_unspecified_maintenance += 1

        def check_power_type(power):
            return (device.get("powerType") or device.get("power") or "").lower() == power

        if check_power_type("solar"):
            count_of_solar_devices += 1
        elif check_power_type("mains"):
            count_of_mains += 1
        elif check_power_type("alternator") or check_power_type("battery"):
            count_of_alternator_devices += 1

        device['elapsed_time'] = device_status.elapsed_time

        if device_status.is_online:
            count_of_online_devices += 1
            online_devices.append(device)
        else:
            count_of_offline_devices += 1
            offline_devices.append(device)

        print("Done processing channel", device.get("device_number"))

    device_status_results = []

    created_at = datetime.utcnow()
    record = {
        "created_at": created_at,
        "total_active_device_count": len(devices),
        "count_of_online_devices": count_of_online_devices,
        "count_of_offline_devices": count_of_offline_devices,
        "count_of_mains": count_of_mains,
        "count_of_solar_devices": count_of_solar_devices,
        "count_of_alternator_devices": count_of_alternator_devices,
        "count_due_maintenance": count_due_maintenance,
        "count_overdue_maintenance": count_overdue_maintenance,
        "count_unspecified_maintenance": count_unspecified_maintenance,
        "online_devices": online_devices,
        "offline_devices": offline_devices
    }

    device_status_results.append(record)

    device_status_model = DeviceStatusModel(tenant)
    device_status_model.save_device_status(device_status_results)
