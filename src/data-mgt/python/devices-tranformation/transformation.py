import os

from airqoApi import AirQoApi
from tahmo import TahmoApi
from utils import array_to_csv, array_to_json, is_valid_double


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

        for site in sites:
            site_dict = dict(site)

            if "latitude" in site_dict and "longitude" in site_dict:
                longitude = site_dict.get("longitude")
                latitude = site_dict.get("latitude")

                nearest_station = dict(self.tahmo_api.get_closest_station(latitude=latitude, longitude=longitude))

                station_data = dict({
                    "id": nearest_station.get("id"),
                    "code": nearest_station.get("code"),
                    "latitude": dict(nearest_station.get("location")).get("latitude"),
                    "longitude": dict(nearest_station.get("location")).get("longitude"),
                    "timezone": dict(nearest_station.get("location")).get("timezone")
                })

                update = dict({
                    "nearest_tahmo_station": station_data,
                    "_id": site_dict.get("_id"),
                    "tenant": self.tenant
                })

                updated_sites.append(update)
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
            self.airqo_api.update_sites(updated_sites=updated_sites)

        else:
            array_to_json(data=summarized_updated_sites)

    def get_devices_invalid_measurement_values(self):
        devices = self.airqo_api.get_devices(tenant='airqo', is_active=True)

        errors = []
        for device in devices:
            device_data = dict(device)
            current_measurements = dict(self.airqo_api.get_airqo_device_current_measurements(
                device_number=device_data["device_number"]
            ))

            created_at = current_measurements.get("created_at")

            for key, value in current_measurements.items():
                key_str = str(key).strip().lower()

                if key_str == 'externaltemperature' or key_str == 'externalhumidity' or 'pm2_5' or key_str == 'pm10' \
                        or key_str == 's2_pm2_5' or key_str == 's2_pm10' or key_str == 'internaltemperature' \
                        or key_str == 'internalhumidity':

                    has_error = False

                    if not is_valid_double(value=value):
                        has_error = True

                    if key_str == 'pm2_5' and not has_error:
                        value = float(value)
                        if value < 0 or value > 500.5:
                            has_error = True

                    if has_error:
                        error = dict({
                            "channelID": device_data["device_number"],
                            "device": device_data["name"],
                            "isActive": device_data["isActive"],
                            key: value,
                            "created_at": created_at,
                        })
                        errors.append(error)

        array_to_csv(data=errors)
