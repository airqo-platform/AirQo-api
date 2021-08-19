import os
from datetime import datetime, timedelta

import pandas as pd
from google.cloud import bigquery

from airqoApi import AirQoApi
from tahmo import TahmoApi
from utils import array_to_csv, array_to_json, is_valid_double, str_to_date


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

        self.__print(data=updated_sites)

    def get_sites_without_a_primary_device(self):

        sites = self.airqo_api.get_sites(tenant=self.tenant)
        sites_without_primary_devices = []

        for site in sites:
            site_dict = dict(site)
            if 'devices' not in site_dict:
                print(f"site doesnt have devices => {site_dict}")
                continue

            devices = site_dict.get('devices')
            has_primary = False

            for device in devices:
                device_dict = dict(device)
                if device_dict.get("isPrimaryInLocation", False) is True:
                    has_primary = True
                    break

            if not has_primary:
                site_summary = dict({
                    "name": site.get("name", None),
                    "generated_name": site.get("name", None),
                    "description": site.get("name", None),
                    "formatted_name": site.get("Unnamed Road, Uganda", None),
                    "latitude": site.get("latitude", None),
                    "longitude": site.get("longitude", None)
                })
                sites_without_primary_devices.append(site_summary)

        self.__print(data=sites_without_primary_devices)

    def get_devices_invalid_measurement_values(self):
        devices = self.airqo_api.get_devices(tenant='airqo', active=True)
        print(devices)

        errors = []
        for device in devices:
            device_data = dict(device)
            try:
                current_measurements = dict(self.airqo_api.get_airqo_device_current_measurements(
                    device_number=device_data["device_number"]
                ))
            except Exception as ex:
                error = dict({
                    "self_link": f"{os.getenv('AIRQO_BASE_URL')}data/feeds/transform/recent?channel={device_data['device_number']}",
                    "channelID": device_data["device_number"]
                })
                errors.append(error)
                continue

            created_at = str_to_date(current_measurements.get("created_at"))
            check_date = datetime.utcnow() - timedelta(days=30)
            error = dict({
                "channelID": device_data["device_number"],
                "device": device_data["name"],
                "isActive": device_data["isActive"],
                "siteName": device_data["siteName"],
                "created_at": f"{created_at}",
            })

            for key, value in current_measurements.items():
                key_str = f"{key}".strip().lower()

                if key_str == 'externaltemperature' or key_str == 'externalhumidity' or key_str == 'pm10' \
                        or key_str == 's2_pm2_5' or key_str == 's2_pm10' or key_str == 'internaltemperature' \
                        or key_str == 'internalhumidity':

                    has_error = False

                    if not is_valid_double(value=value):
                        has_error = True

                    if key_str == 'pm2_5' and not has_error:
                        value = float(value)
                        if value < 0 or value > 500.5:
                            has_error = True

                    if not has_error and (key_str == 'pm2_5' or key_str == 's2_pm2_5' or key_str == 's2_pm10'
                                          or key_str == 'pm10'):
                        value = float(value)
                        if value < 0 or value > 500.5:
                            has_error = True

                    if not has_error and (key_str == 'externaltemperature' or key_str == 'internalhumidity'
                                          or key_str == 'internaltemperature' or key_str == 'externalhumidity'):
                        value = float(value)
                        if value < 0 or value > 50:
                            has_error = True

                    if not has_error and (check_date > created_at):
                        has_error = True

                    if has_error:
                        error[key] = value

            if len(error.keys()) > 5:
                error["self_link"] = f"{os.getenv('AIRQO_BASE_URL')}data/feeds/transform/recent?channel={device_data['device_number']}"
                errors.append(error)

        self.__print(data=errors)

    def get_devices_not_up_to_date_on_big_query(self):
        client = bigquery.Client()

        query = """SELECT distinct channel_id FROM airqo-250220.thingspeak.clean_feeds_pms"""

        channel_ids_df = (
            client.query(query).result().to_dataframe()
        )

        channel_ids_list = [row["channel_id"] for _, row in channel_ids_df.iterrows()]

        devices = self.airqo_api.get_devices(tenant="airqo")
        devices_df = pd.DataFrame(devices)

        missing_devices = [row["device_number"] for _, row in devices_df.iterrows()
                           if row["device_number"] not in channel_ids_list]

        self.__print(missing_devices)

    def __print(self, data):
        if self.output_format.strip().lower() == "csv":
            array_to_csv(data=data)

        elif self.output_format.strip().lower() == "api":
            print("Data to be Updated", data, sep=" := ")
            self.airqo_api.update_sites(updated_sites=data)
        else:
            array_to_json(data=data)

