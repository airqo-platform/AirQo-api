import json
import traceback

from kafka import KafkaConsumer

from bigquery_api import BigQueryAPI
from config import Config
from models import Site, Device, AirQloud, AirQloudSite


class MessageBroker:
    @staticmethod
    def listen_to_sites():
        connector = KafkaConsumer(
            Config.SITES_TOPIC,
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        bigquery_api = BigQueryAPI()

        print("listening to sites.....")

        for msg in connector:
            try:
                data = msg.value
                site = Site(
                    id=data.get("_id", None),
                    latitude=data.get("latitude", None),
                    longitude=data.get("longitude", None),
                    tenant=data.get("network", None),
                    name=data.get("name", None),
                    location=data.get("location", None),
                    city=data.get("city", None),
                    region=data.get("region", None),
                    country=data.get("country", None),
                    approximate_latitude=data.get("approximate_latitude", None),
                    approximate_longitude=data.get("approximate_longitude", None),
                    display_name=data.get("search_name", None),
                    display_location=data.get("location_name", None),
                    description=data.get("description", None),
                )
                if site.is_valid():
                    bigquery_api.update(site)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
                continue

    @staticmethod
    def listen_to_devices():
        connector = KafkaConsumer(
            Config.DEVICES_TOPIC,
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        bigquery_api = BigQueryAPI()

        print("listening to devices.....")

        for msg in connector:
            try:
                data = msg.value
                device = Device(
                    device_id=data.get("name", None),
                    latitude=data.get("latitude", None),
                    longitude=data.get("longitude", None),
                    tenant=data.get("network", None),
                    name=data.get("name", None),
                    device_manufacturer=data.get("device_manufacturer", None),
                    device_category=data.get("device_category", None),
                    approximate_latitude=data.get("approximate_latitude", None),
                    approximate_longitude=data.get("approximate_longitude", None),
                    device_number=data.get("device_number", None),
                    site_id=data.get("site_id", None),
                    description=data.get("description", None),
                )
                if device.is_valid():
                    bigquery_api.update(device)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
                continue

    @staticmethod
    def listen_to_airqlouds():
        connector = KafkaConsumer(
            Config.AIRQLOUDS_TOPIC,
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        bigquery_api = BigQueryAPI()

        print("listening to airqlouds.....")

        for msg in connector:
            try:
                data = msg.value
                airqloud = AirQloud(
                    id=data.get("_id", None),
                    tenant=data.get("network", None),
                    name=data.get("name", None),
                )
                if airqloud.is_valid():
                    bigquery_api.update(airqloud)

                    sites = data.get("sites", [])
                    air_qloud_sites = list(
                        map(
                            lambda site: AirQloudSite(
                                site_id=site.get("_id", None),
                                airqloud_id=airqloud.id,
                                tenant=airqloud.tenant,
                            ),
                            sites,
                        )
                    )
                    air_qloud_sites = list(
                        filter(lambda x: x.is_valid(), air_qloud_sites)
                    )
                    bigquery_api.update_airqloud_sites(air_qloud_sites)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
                continue
