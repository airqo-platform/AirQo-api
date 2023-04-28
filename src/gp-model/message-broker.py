import argparse
import json
import traceback

from kafka import KafkaConsumer
from pymongo import MongoClient

from config import Config


class MessageBroker:
    @staticmethod
    def listen_to_message_broker():
        client = MongoClient(Config.GP_MODEL_DB_URI)
        db_client = client[f"{Config.GP_MODEL_DB}"]

        consumer = KafkaConsumer(
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        consumer.subscribe(topics=[Config.MEASUREMENTS_TOPIC, Config.AIRQLOUDS_TOPIC])

        print(f"\n\nListening to {consumer.topics()} .....\n\n")

        for msg in consumer:
            try:
                data = msg.value
                topic = msg.topic

                if topic == Config.MEASUREMENTS_TOPIC:
                    print(f"\n\nReceived measurements: {data}\n\n")
                    try:
                        formatted_data = [
                            {
                                "site_id": row.get("site_id", None),
                                "network": row.get("network", None),
                                "pm2_5_calibrated_value": row.get(
                                    "pm2_5_calibrated_value", None
                                ),
                                "pm2_5_raw_value": row.get("pm2_5_raw_value", None),
                                "pm10_calibrated_value": row.get(
                                    "pm10_calibrated_value", None
                                ),
                                "pm10_raw_value": row.get("pm10_raw_value", None),
                                "timestamp": row.get("timestamp", None),
                                "site_longitude": row.get("site_longitude", None),
                                "site_latitude": row.get("site_latitude", None),
                            }
                            for row in data["data"]
                        ]

                        db_client.measurements.insert_many(formatted_data)
                        print(f"\n\nSaved measurements: {formatted_data}\n\n")
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

                elif topic == Config.AIRQLOUDS_TOPIC:
                    try:
                        print(f"\n\nReceived airqlouds: {data}\n\n")
                        formatted_data = [
                            {
                                "_id": row["_id"],
                                "long_name": row.get("long_name", ""),
                                "network": row.get("network"),
                                "admin_level": row.get("admin_level"),
                                "name": row.get("name", ""),
                                "sites": row.get("sites"),
                                "center_point": row.get("center_point", {}),
                                "coordinates": row.get("location").get("coordinates"),
                            }
                            for row in data
                        ]

                        db_client.airqlouds.insert_many(formatted_data)
                        print(f"\n\nSaved airqlouds data {formatted_data}\n\n")
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

            except Exception as ex:
                print(ex)
                traceback.print_exc()


if __name__ == "__main__":
    MessageBroker.listen_to_message_broker()
