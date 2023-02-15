import argparse
import json
import traceback

from kafka import KafkaConsumer
from pymongo import MongoClient

from config import Config


class MessageBroker:
    @staticmethod
    def listen_to_message_broker(tenant: str):

        client = MongoClient(Config.GP_MODEL_DB_URI)
        db_client = client[f"{Config.GP_MODEL_DB}"]

        consumer = KafkaConsumer(
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        consumer.subscribe(
            [Config.MEASUREMENTS_TOPIC, Config.AIRQLOUDS_TOPIC, Config.DEVICES_TOPIC]
        )

        print(f"Listening to {consumer.topics()} .....")

        for msg in consumer:
            try:
                data = msg.value
                topic = msg.topic

                if topic == Config.MEASUREMENTS_TOPIC:
                    data = [{"device": row["device_id"], "tenant": row.get("tenant"),
                             "pm2_5_calibrated": row["pm2_5_calibrated_value"],
                             "pm2_5_raw": row["pm2_5_raw_value"],
                             "timestamp": row["timestamp"],
                             "longitude": row.get("device_longitude", None),
                             "latitude": row.get("device_latitude")
                             }
                            for row in data]

                    data = list(filter(lambda y: y["network"] == tenant, data))

                    db_client.measurements.insert_many(data)

                elif topic == Config.AIRQLOUDS_TOPIC:
                    # data = [{"id": row["_id"], "airqloud": row.get("long_name"),
                    #          "admin_level": row.get("admin_level")
                    #          , "coordinates": row.get("location").get("coordinates")
                    #          }
                    #         for row in data]

                    data = list(filter(lambda y: y["network"] == tenant, data))

                    db_client.airqlouds.insert_many(data)

                elif topic == Config.DEVICES_TOPIC:
                    # data = [
                    #     {"device": row["device_id"], "tenant": row.get("tenant")}
                    #     for row in data
                    # ]

                    data = list(filter(lambda y: y["tenant"] == tenant, data))

                    db_client.deivces.insert_many(data)
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
    MessageBroker.listen_to_message_broker(args.tenant)
