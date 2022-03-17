import os
import traceback
from datetime import datetime, timedelta

import pandas as pd
from google.cloud import bigquery

from airqoApi import AirQoApi
from tahmo import TahmoApi
from utils import array_to_csv, array_to_json, is_valid_double, str_to_date, date_to_str_v2


class Transformation:
    def __init__(self, output_format):
        self.output_format = output_format
        self.tenant = os.getenv("TENANT")
        self.airqo_api = AirQoApi()
        self.tahmo_api = TahmoApi()

    def update_primary_devices(self):

        devices = pd.read_csv("devices.csv")
        for _, device in devices.iterrows():

            device_dict = dict(device.to_dict())

            tenant = device_dict.get("tenant", "airqo")
            name = device_dict.get("deviceName", None)
            primary = f'{device_dict.get("primary")}'

            deployed = f'{device_dict.get("status", "none")}'

            is_primary = False
            if primary.strip().lower() == 'primary':
                is_primary = True

            if name and deployed.strip().lower() == "deployed":
                self.airqo_api.update_primary_device(tenant=tenant, name=name, primary=is_primary)

    def update_site_search_names(self):

        updated_site_names = []
        sites = pd.read_csv("sites.csv")
        for _, site in sites.iterrows():

            site_dict = dict(site.to_dict())

            update = dict({
                "search_name": site_dict.get("search_name"),
                "location_name": site_dict.get("location_name"),
                "tenant": self.tenant,
            })

            if "lat_long" in site_dict.keys():
                update["lat_long"] = site_dict.get("lat_long")
            elif "id" in site_dict.keys():
                update["id"] = site_dict.get("id")
            else:
                raise Exception("Missing unique key")
            updated_site_names.append(update)

        self.airqo_api.update_sites(updated_site_names)

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
                        "device_number": device_dict.get("device_number"),
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

        for site in sites:
            site_dict = dict(site)

            if "latitude" in site_dict and "longitude" in site_dict:
                longitude = site_dict.get("longitude")
                latitude = site_dict.get("latitude")

                try:
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
                        "tenant": self.tenant,
                    })

                    updated_sites.append(update)
                except:
                    traceback.print_exc()
                    pass

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

                if '_id' in site_dict:
                    site_dict.pop('_id')

                if 'nearest_tahmo_station' in site_dict:
                    site_dict.pop('nearest_tahmo_station')

                sites_without_primary_devices.append(site_dict)

        self.__print(data=sites_without_primary_devices)

    def metadata_to_csv(self, component='', tenant=None):

        if tenant is None:
            metadata = []
            for tenant in ['airqo', 'kcca']:
                tenant_metadata = self.airqo_api.get_sites(tenant=tenant) \
                    if component.strip().lower() == 'sites' \
                    else self.airqo_api.get_devices(tenant=tenant, all_devices=True)
                tenant_metadata_df = pd.DataFrame(tenant_metadata)
                tenant_metadata_df['tenant'] = tenant
                metadata.extend(tenant_metadata_df.to_dict(orient='records'))
        else:
            metadata = self.airqo_api.get_sites(tenant=tenant)\
                if component.strip().lower() == 'sites' \
                else self.airqo_api.get_devices(tenant=tenant, all_devices=True)

        metadata_df = pd.DataFrame(metadata)
        data = pd.json_normalize(metadata_df.to_dict(orient='records'))

        self.__print(data=data)

    def get_devices_without_forecast(self):

        devices = self.airqo_api.get_devices(tenant=self.tenant, active=True)
        devices_without_forecast = []

        for device in devices:
            device_dict = dict(device)
            device_number = device_dict.get("device_number", None)

            if device_number:
                time = int(datetime.utcnow().timestamp())

                forecast = self.airqo_api.get_forecast_v2(channel_id=device_number, timestamp=time)
                if not forecast:
                    device_details = {
                        "device_number": device_dict.get("device_number", None),
                        "name": device_dict.get("name", None)
                    }
                    print(device_details)
                    devices_without_forecast.append(device_details)

        self.__print(data=devices_without_forecast)

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
                error[
                    "self_link"] = f"{os.getenv('AIRQO_BASE_URL')}data/feeds/transform/recent?channel={device_data['device_number']}"
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
