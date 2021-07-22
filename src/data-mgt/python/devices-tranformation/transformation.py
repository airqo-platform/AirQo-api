import os

from airqoApi import AirQoApi
from tahmo import TahmoApi
from utils import array_to_csv, array_to_json


class Transformation:
    def __init__(self, output_format):
        self.output_format = output_format
        self.tenant = os.getenv("TENANT")
        self.airqo_api = AirQoApi()
        self.tahmo_api = TahmoApi()

    def map_devices_to_tahmo_station(self):

        devices = self.airqo_api.get_devices(self.tenant)

        updated_devices = []
        summarized_updated_devices = []

        for device in devices:
            device_dict = dict(device)
            if "latitude" in device_dict and "longitude" in device_dict:
                latitude = device_dict.get("latitude")
                longitude = device_dict.get("longitude")

                closet_station = dict(self.tahmo_api.get_closest_station(latitude=latitude, longitude=longitude))

                station_data = dict({
                    "id": closet_station.get("id"),
                    "code": closet_station.get("code"),
                    "latitude": dict(closet_station.get("location")).get("latitude"),
                    "longitude": dict(closet_station.get("location")).get("longitude"),
                    "timezone": dict(closet_station.get("location")).get("timezone")
                })

                device_dict["closet_tahmo_station"] = station_data

                updated_devices.append(device_dict)
                summarized_updated_devices.append(
                    dict({
                        "_id": device_dict.get("_id"),
                        "device_number":  device_dict.get("device_number"),
                        "name": device_dict.get("name"),
                        "latitude": device_dict.get("latitude"),
                        "longitude": device_dict.get("longitude"),
                        "closest_tahmo_station": station_data
                    })
                )

        if self.output_format.strip().lower() == "csv":
            array_to_csv(data=summarized_updated_devices)

        elif self.output_format.strip().lower() == "api":
            print("Devices to be Updated", updated_devices, sep=" := ")
            # TODO Implement logic in the AirQo API class to update devices

        else:
            array_to_json(data=summarized_updated_devices)

    def map_sites_to_tahmo_station(self):

        sites = self.airqo_api.get_sites(self.tenant)

        updated_sites = []
        summarized_updated_sites = []

        limit = 0

        for site in sites:

            site_dict = dict(site)
            if "latitude" in site_dict and "longitude" in site_dict:
                if limit > 2:
                    break
                limit = limit + 1

                latitude = site_dict.get("latitude")
                longitude = site_dict.get("longitude")

                closet_station = dict(self.tahmo_api.get_closest_station(latitude=latitude, longitude=longitude))

                station_data = dict({
                    "id": closet_station.get("id"),
                    "code": closet_station.get("code"),
                    "latitude": dict(closet_station.get("location")).get("latitude"),
                    "longitude": dict(closet_station.get("location")).get("longitude"),
                    "timezone": dict(closet_station.get("location")).get("timezone")
                })

                site_dict["closet_tahmo_station"] = station_data

                updated_sites.append(site_dict)
                summarized_updated_sites.append(
                    dict({
                        "_id": site_dict.get("_id"),
                        "name":  site_dict.get("name"),
                        "description": site_dict.get("name"),
                        "latitude": site_dict.get("latitude"),
                        "longitude": site_dict.get("longitude"),
                        "closest_tahmo_station": station_data
                    })
                )

        if self.output_format.strip().lower() == "csv":
            array_to_csv(data=summarized_updated_sites)

        elif self.output_format.strip().lower() == "api":
            print("Sites to be Updated", updated_sites, sep=" := ")
            # self.airqo_api.update_sites(tenant=self.tenant, updated_sites=updated_sites)

        else:
            array_to_json(data=summarized_updated_sites)
