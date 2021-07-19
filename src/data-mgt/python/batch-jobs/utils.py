import requests

from config import configuration


def get_devices(base_url, tenant):

    api_url = f"{base_url}devices?tenant={tenant}&active=yes"
    headers = {'x-api-key': configuration.AIRQO_API_KEY}

    results = requests.get(api_url, headers=headers, verify=False)

    if results.status_code != 200:
        print(results.content)
        return []

    devices = list(results.json()["devices"])
    return devices


def filter_valid_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys() and "device_number" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def build_channel_id_filter(devices_data):
    channel_filter = "channel_id = 0"
    for device in devices_data:
        device_dict = dict(device)
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('device_number')}"

    return channel_filter
