import os
import threading

from confluent_kafka import DeserializingConsumer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import StringDeserializer
from dotenv import load_dotenv
import pandas as pd

from event import DeviceRegistry


load_dotenv()

AIRQO_BASE_URL = os.getenv("AIRQO_BASE_URL")
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")
TOPIC = os.getenv("TOPIC")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP")
SIZE = os.getenv("SIZE")


def main():
    schema_registry_client = SchemaRegistryClient({'url': SCHEMA_REGISTRY_URL})

    avro_deserializer = AvroDeserializer(schema_registry_client=schema_registry_client)
    string_deserializer = StringDeserializer('utf_8')

    consumer_conf = {'bootstrap.servers': BOOTSTRAP_SERVERS,
                     'key.deserializer': string_deserializer,
                     'value.deserializer': avro_deserializer,
                     'group.id': CONSUMER_GROUP,
                     'auto.offset.reset': "earliest"}

    consumer = DeserializingConsumer(consumer_conf)
    consumer.subscribe([TOPIC])

    while True:
        try:
            msg = consumer.poll(1.0)
            if msg is None:
                continue

            msg_value = msg.value()
            if msg_value is not None:
                measurements = list(dict(msg_value).get("measurements"))
                measurements_df = pd.DataFrame(measurements)

                groups = measurements_df.groupby("tenant")

                for _, group in groups:
                    tenant = group.iloc[0]['tenant']
                    device_registry = DeviceRegistry(tenant, AIRQO_BASE_URL)

                    group_measurements = list(group.to_dict(orient="records"))
                    for i in range(0, len(group_measurements), int(SIZE)):
                        measurements_list = group_measurements[i:i + int(SIZE)]

                        insertion_thread = threading.Thread(
                            target=device_registry.insert_events, args=(measurements_list,))
                        insertion_thread.start()

        except KeyboardInterrupt:
            break

    consumer.close()


if __name__ == '__main__':
    main()
