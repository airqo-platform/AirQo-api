import os
import traceback

from confluent_avro import SchemaRegistry, AvroKeyValueSerde
from kafka import KafkaProducer, KafkaConsumer

from clean import Clean
from cleaned_measurement import cleaned_schema_str


class MeasurementsClient:

    def __init__(self):

        self.__bootstrap_servers = [os.getenv("BOOTSTRAP_SERVERS")]
        self.__input_topic = os.getenv("INPUT_TOPIC")
        self.__output_topic = os.getenv("OUTPUT_TOPIC")
        self.__consumer_group = os.getenv("CONSUMER_GROUP")
        self.__schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL")
        self.__auto_commit = True if f"{os.getenv('AUTO_COMMIT', True)}".strip().lower() == "true" else False
        self.__reload_interval = os.getenv("RELOAD_INTERVAL", 1)

        self.__registry_client = SchemaRegistry(
            self.__schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )

    def __produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
        producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, cleaned_schema_str)
        producer.send(self.__output_topic, bytes_data)

    def consume_measurements(self):

        avro_serde = AvroKeyValueSerde(self.__registry_client, self.__input_topic)
        consumer = KafkaConsumer(
            self.__input_topic,
            group_id=self.__consumer_group,
            bootstrap_servers=self.__bootstrap_servers,
            auto_offset_reset='earliest',
            enable_auto_commit=self.__auto_commit)

        for msg in consumer:
            value = avro_serde.value.deserialize(msg.value)

            try:
                measurements = dict(value).get("measurements")

                cleaning = Clean(measurements)
                cleaning.clean_measurements()
                cleaned_measurements = cleaning.get_cleaned_measurements()

                if cleaned_measurements:
                    print(dict({"cleaned measurements": cleaned_measurements}))
                    self.__produce_measurements(dict({"measurements": cleaned_measurements}))

            except Exception as e:
                traceback.print_exc()
                print(e)
