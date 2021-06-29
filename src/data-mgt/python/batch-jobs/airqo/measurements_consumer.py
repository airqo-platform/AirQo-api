import argparse
import os

from confluent_kafka import DeserializingConsumer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from confluent_kafka.serialization import StringDeserializer

from event import send_to_api


def main(args):
    topic = args.topic

    sr_conf = {'url': args.schema_registry}
    schema_registry_client = SchemaRegistryClient(sr_conf)

    schema_str = """
    {
        "namespace": "confluent.io.examples.serialization.avro",
        "name": "User",
        "type": "record",
        "fields": [
            {"name": "name", "type": "string"},
            {"name": "favorite_number", "type": "int"},
            {"name": "favorite_color", "type": "string"}
        ]
    }
    """

    avro_deserializer = AvroDeserializer(schema_registry_client=schema_registry_client)
    string_deserializer = StringDeserializer('utf_8')

    consumer_conf = {'bootstrap.servers': args.bootstrap_servers,
                     'key.deserializer': string_deserializer,
                     'value.deserializer': avro_deserializer,
                     'group.id': args.group,
                     'auto.offset.reset': "earliest"}

    consumer = DeserializingConsumer(consumer_conf)
    consumer.subscribe([topic])

    while True:
        try:
            # SIGINT can't be handled when polling, limit timeout to 1 second.
            msg = consumer.poll(1.0)
            if msg is None:
                continue

            msg_value = msg.value()
            if msg_value is not None:
                send_to_api(msg_value)

        except KeyboardInterrupt:
            break

    consumer.close()


if __name__ == '__main__':
    bootstrapServers = os.getenv("BOOTSTRAP_SERVERS", "34.123.249.54:31000")
    schema_registry = os.getenv("SCHEMA_REGISTRY_URL", "http://34.123.249.54:31081")
    topic = os.getenv("TOPIC", "airqo-transformed-device-measurements-topic")

    parser = argparse.ArgumentParser(description="Consumer Example client with "
                                                 "serialization capabilities")
    parser.add_argument('-b', dest="bootstrap_servers", default=bootstrapServers,
                        help="Bootstrap broker(s) (host[:port])")
    parser.add_argument('-s', dest="schema_registry", default=schema_registry,
                        help="Schema Registry (http(s)://host[:port]")
    parser.add_argument('-t', dest="topic", default=topic,
                        help="Topic name")
    parser.add_argument('-g', dest="group", default="example_serde_avro",
                        help="Consumer group")

    main(parser.parse_args())