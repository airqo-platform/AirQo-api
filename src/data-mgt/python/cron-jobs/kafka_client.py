import os

from confluent_avro import SchemaRegistry, AvroKeyValueSerde
from kafka import KafkaProducer

from schema import schema_str


class MeasurementsClient:

    def __init__(self):
        self.__bootstrap_servers = [os.getenv("BOOTSTRAP_SERVERS")]
        self.__output_topic = os.getenv("OUTPUT_TOPIC")
        self.__schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL")

        self.__registry_client = SchemaRegistry(
            self.__schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )

    def produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
        producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer.send(self.__output_topic, bytes_data)
