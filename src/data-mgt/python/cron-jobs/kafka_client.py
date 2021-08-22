import json
import os
import traceback

from confluent_avro import SchemaRegistry
from kafka import KafkaProducer


class KafkaClient:

    def __init__(self):
        self.__bootstrap_servers = [os.getenv("BOOTSTRAP_SERVERS")]
        self.__output_topic = os.getenv("OUTPUT_TOPIC")
        self.__schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL")

        self.__registry_client = SchemaRegistry(
            self.__schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )

    def produce_measurements(self, measurements):
        try:
            # avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
            # bytes_data = avro_serde.value.serialize(measurements, schema_str)
            producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers)
            producer.send(self.__output_topic, json.dumps(measurements).encode('utf-8'))
        except:
            traceback.print_exc()
