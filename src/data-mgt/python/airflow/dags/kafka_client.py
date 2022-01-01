import traceback

import simplejson
from confluent_avro import SchemaRegistry
from kafka import KafkaProducer

from config import configuration


class KafkaBrokerClient:

    def __init__(self):
        self.__bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        self.__schema_registry_url = configuration.SCHEMA_REGISTRY_URL

        self.__registry_client = SchemaRegistry(
            self.__schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )

    def send_data(self, data, topic):
        try:
            # avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
            # bytes_data = avro_serde.value.serialize(measurements, schema_str)
            producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers)
            producer.send(topic, simplejson.dumps(data).encode('utf-8'))
        except Exception as ex:
            print(ex)
            traceback.print_exc()
