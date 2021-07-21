import os

from AirQoApi import AirQoApi
from Tahmo import TahmoApi
from utils import array_to_csv, array_to_json


def map_devices_to_tahmo_station(output_format):
    tenant = os.getenv("TENANT")

    airqo_api = AirQoApi()
    tahmo_api = TahmoApi()

    devices = airqo_api.get_devices(tenant)

    # formatted_devices = []
    summarized_formatted_devices = []

    for device in devices:
        device_dict = dict(device)
        if "latitude" in device_dict and "longitude" in device_dict:
            latitude = device_dict.get("latitude")
            longitude = device_dict.get("longitude")

            closet_station = dict(tahmo_api.get_closest_station(latitude=latitude, longitude=longitude))

            station_data = dict({
                "id": closet_station.get("id"),
                "code": closet_station.get("code"),
                "latitude": dict(closet_station.get("location")).get("latitude"),
                "longitude": dict(closet_station.get("location")).get("longitude"),
                "timezone": dict(closet_station.get("location")).get("timezone")
            })

            device_dict["closet_tahmo_station"] = station_data

            # formatted_devices.append(device_dict)
            summarized_formatted_devices.append(
                dict({
                    "_id": device_dict.get("_id"),
                    "device_number":  device_dict.get("device_number"),
                    "name": device_dict.get("name"),
                    "latitude": device_dict.get("latitude"),
                    "longitude": device_dict.get("longitude"),
                    "closest_tahmo_station": station_data
                })
            )

    if output_format.strip().lower() == "csv":
        # array_to_csv(data=formatted_devices)
        array_to_csv(data=summarized_formatted_devices)
    else:
        # array_to_json(data=formatted_devices)
        array_to_json(data=summarized_formatted_devices)
