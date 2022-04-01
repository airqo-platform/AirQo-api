import json
import math

import requests

from config import configuration


def to_float(string):
    try:
        value = float(string)
        if math.isnan(value):
            return None
        return value
    except Exception:
        return None


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


def filter_valid_kcca_devices(devices_data):
    valid_devices = []
    for device in devices_data:
        device_dict = dict(device)
        if "site" in device_dict.keys():
            valid_devices.append(device_dict)

    return valid_devices


def build_channel_id_filter(devices_data):
    channel_filter = "channel_id = 0"
    for device in devices_data:
        device_dict = dict(device)
        channel_filter = channel_filter + f" or channel_id = {device_dict.get('device_number')}"

    return channel_filter


def get_valid_devices(base_url, tenant):
    devices = get_devices(base_url, tenant)
    filtered_devices = filter_valid_devices(devices)
    return filtered_devices


class DeviceRegistry:
    def __init__(self, data, tenant, url) -> None:
        self.json_data = json.dumps(data)
        self.tenant = tenant
        self.base_url = url

    def send_to_api(self):
        self.events_collection_insertion()

    def events_collection_insertion(self):
        try:

            headers = {'Content-Type': 'application/json'}
            url = self.base_url + "devices/events?tenant=" + self.tenant

            results = requests.post(url, self.json_data, headers=headers, verify=False)

            if results.status_code == 200:
                print(results.json())
            else:
                print(f"Device registry failed to insert values. Status Code : {results.status_code}")
                print(f"Response : {results.content}")
                print(f"Request Url : {url}")
                print(f"Request body : {self.json_data}")
        except Exception as ex:
            print("Error Occurred while inserting measurements: " + str(ex))