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
        consumer.subscribe([Config.MEASUREMENTS_TOPIC, Config.AIRQLOUDS_TOPIC])

        print(f"Listening to {consumer.topics()} .....")

        for msg in consumer:
            try:
                data = msg.value
                topic = msg.topic

                if topic == Config.MEASUREMENTS_TOPIC:
                    print(f"received measurements data {data}")
                    try:
                        data = [
                            {
                                "site_id": row["site_id"],
                                "network": row.get("network"),
                                "pm2_5_calibrated_value": row["pm2_5_calibrated_value"],
                                "pm2_5_raw_value": row["pm2_5_raw_value"],
                                "pm10_calibrated_value": row["pm10_calibrated_value"],
                                "pm10_raw_value": row["pm10_raw_value"],
                                "timestamp": row["timestamp"],
                                "site_longitude": row.get("site_longitude"),
                                "site_latitude": row.get("site_latitude"),
                            }
                            for row in data
                        ]

                        db_client.measurements.insert_many(data)
                        print(f"saved measurements data {data}")
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

                elif topic == Config.AIRQLOUDS_TOPIC:
                    try:
                        print(f"received airqlouds data {data}")
                        data = [
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

                        db_client.airqlouds.insert_many(data)
                        print(f"saved airqlouds data {data}")
                    except Exception as ex:
                        print(ex)
                        traceback.print_exc()

            except Exception as ex:
                print(ex)
                traceback.print_exc()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--tenant",
        required=True,
        type=str.lower,
    )

    args = parser.parse_args()
    MessageBroker.listen_to_message_broker()
