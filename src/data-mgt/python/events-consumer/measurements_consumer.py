import os

from confluent_kafka import DeserializingConsumer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import StringDeserializer

from event import DeviceRegistry

TENANT = os.getenv("TENANT", "")
BASE_URL = os.getenv("BASE_URL", "")
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "")
SCHEMA_REGISTRY = os.getenv("SCHEMA_REGISTRY_URL", "")
OUTPUT_TOPIC = os.getenv("TOPIC", "quick-start")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP", "quick-start-group")


def main():
    schema_registry_client = SchemaRegistryClient({'url': SCHEMA_REGISTRY})

    avro_deserializer = AvroDeserializer(schema_registry_client=schema_registry_client)
    string_deserializer = StringDeserializer('utf_8')

    consumer_conf = {'bootstrap.servers': BOOTSTRAP_SERVERS,
                     'key.deserializer': string_deserializer,
                     'value.deserializer': avro_deserializer,
                     'group.id': CONSUMER_GROUP,
                     'auto.offset.reset': "earliest"}

    consumer = DeserializingConsumer(consumer_conf)
    consumer.subscribe([OUTPUT_TOPIC])

    while True:
        try:
            msg = consumer.poll(1.0)
            if msg is None:
                continue

            msg_value = msg.value()
            if msg_value is not None:
                measurements = dict(msg_value).get("measurements")
                device_registry = DeviceRegistry(measurements, TENANT, BASE_URL)
                device_registry.insert_events()

        except KeyboardInterrupt:
            break

    consumer.close()


if __name__ == '__main__':
    main()
