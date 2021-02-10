from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import math
from models.device import Device
from models.device_status import DeviceStatus as DeviceStatusModel
import requests
import logging
from config import constants
from helpers import convert_dates
from dataclasses import dataclass
_logger = logging.getLogger(__name__)


@dataclass
class DeviceStatus:
    is_online: bool
    elapsed_time: float
    channel: dict


def get_all_devices(tenant):
    model = Device()
    results = model.get_devices(tenant)
    return [device for device in results if device.get("isActive")]


def get_device_status(channel):
    print("Scheduled querying channel for", channel.get("channelID"))
    channel_id = channel.get("channelID")
    api_url = '{0}{1}{2}'.format(
        constants.configuration.BASE_API_URL, 'feeds/recent/', channel_id)
    latest_device_status_response = requests.get(api_url)
    if latest_device_status_response.status_code == 200:
        result = latest_device_status_response.json()
        try:
            channel["_id"] = str(channel.get("_id"))
            if math.isnan(channel.get("longitude")):
               channel["longitude"] = float(result.get("field6"))
            if math.isnan(channel.get("latitude")):
               channel["latitude"] = float(result.get("field5"))
        except Exception:
            pass
        current_datetime = datetime.now()

        date_time_difference = current_datetime - \
            datetime.strptime(result['created_at'], '%Y-%m-%dT%H:%M:%SZ')
        time_difference = date_time_difference.total_seconds()
        six_hours = 21600  # in seconds

        if time_difference < six_hours:
            return DeviceStatus(is_online=True, elapsed_time=time_difference, channel=channel)
        return DeviceStatus(is_online=False, elapsed_time=time_difference, channel=channel)
    return DeviceStatus(is_online=False, elapsed_time=-1, channel=channel)


def compute_device_channel_status(tenant):
    results = get_all_devices(tenant)
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

    for channel in results:
        futures.append(executor.submit(get_device_status, channel))

    for future in futures:
        try:
            device_status = future.result()
        except Exception as ex:
            print("Cannot process channel", ex)
            continue
        channel = device_status.channel

        try:
            maintenance_status = (channel.get(
                "nextMaintenance") - datetime.now()).total_seconds()

            two_weeks_in_seconds = 1209600

            if maintenance_status < 0:
                channel["maintenance_status"] = "overdue"
                count_overdue_maintenance += 1
            elif maintenance_status < two_weeks_in_seconds:
                channel["maintenance_status"] = "due"
                count_due_maintenance += 1
            else:
                channel["maintenance_status"] = "good"
        except Exception:
            channel["maintenance_status"] = -1
            count_unspecified_maintenance += 1

        def check_power_type(power):
            return (channel.get("powerType") or channel.get("power") or "").lower() == power

        if check_power_type("solar"):
            count_of_solar_devices += 1
        elif check_power_type("mains"):
            count_of_mains += 1
        elif check_power_type("alternator") or check_power_type("battery"):
            count_of_alternator_devices += 1

        channel['elapsed_time'] = device_status.elapsed_time
        if device_status.is_online:
            count_of_online_devices += 1
            online_devices.append(channel)
        else:
            count_of_offline_devices += 1
            offline_devices.append(channel)

        print("Done processing channel", channel.get("channelID"))

    device_status_results = []

    created_at = convert_dates.str_to_date(
        convert_dates.date_to_str(datetime.now()))
    record = {"created_at": created_at,
              "total_active_device_count": len(results),
              "count_of_online_devices": count_of_online_devices,
              "count_of_offline_devices": count_of_offline_devices,
              "count_of_mains": count_of_mains,
              "count_of_solar_devices": count_of_solar_devices,
              "count_of_alternator_devices": count_of_alternator_devices,
              "count_due_maintenance": count_due_maintenance,
              "count_overdue_maintenance": count_overdue_maintenance,
              "count_unspecified_maintenance": count_unspecified_maintenance,
              "online_devices": online_devices,
              "offline_devices": offline_devices}
    device_status_results.append(record)

    device_status_model = DeviceStatusModel(tenant)
    device_status_model.save_device_status(device_status_results)
