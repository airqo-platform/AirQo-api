import os

from dotenv import load_dotenv

from AirQoApi import AirQoApi
from Tahmo import TahmoApi
from utils import array_to_csv, array_to_json

load_dotenv()


def map_devices_to_tahmo_station():
    tenant = os.getenv("TENANT")
    output_format = os.getenv("OUTPUT_FORMAT")

    airqo_api = AirQoApi()
    tahmo_api = TahmoApi()

    devices = airqo_api.get_devices(tenant)

    formatted_devices = []
    count = 0

    for device in devices:
        if count > 5:
            break
        device_dict = dict(device)
        if "latitude" in device_dict and "longitude" in device_dict:
            latitude = device_dict.get("latitude")
            longitude = device_dict.get("longitude")

            _, closet_station = tahmo_api.get_closest_station(latitude=latitude, longitude=longitude)
            device_dict["closet_tahmo_station"] = closet_station
            count = count + 1
            formatted_devices.append(device_dict)

    if output_format.strip().lower() == "csv":
        array_to_csv(data=formatted_devices)
    else:
        array_to_json(data=formatted_devices)
