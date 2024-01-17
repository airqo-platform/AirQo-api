import simplejson
from kafka import KafkaProducer

from .config import configuration


class KafkaBrokerClient:
    def __init__(self):
        self.__partitions = configuration.TOPIC_PARTITIONS
        self.__bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        self.__partitions = [0, 1, 2]
        self.bam_measurements_topic = configuration.BAM_MEASUREMENTS_TOPIC
        # self.__schema_registry_url = configuration.SCHEMA_REGISTRY_URL
        # self.__registry_client = SchemaRegistry(
        #     self.__schema_registry_url,
        #     headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        # )

    def get_partition(self, current_partition) -> int:
        current_partition = current_partition + 1
        if current_partition in self.__partitions:
            return current_partition
        return self.__partitions[0]

    @staticmethod
    def on_success(record_metadata):
        print("\nSuccessfully sent message")
        print(f"Topic : {record_metadata.topic}")
        print(f"Partition : {record_metadata.partition}")
        print(f"Offset : {record_metadata.offset}")

    @staticmethod
    def on_error(exception):
        print("\nFailed to send message")
        print(exception)

    def send_data(self, topic: str, data: list, partition: int = None):
        # avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
        # bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer = KafkaProducer(
            bootstrap_servers=self.__bootstrap_servers,
            api_version_auto_timeout_ms=300000,
            retries=5,
            request_timeout_ms=300000,
        )

        if len(data) > 50:
            current_partition = -1
            for i in range(0, len(data), 50):
                range_data = data[i : i + 50]

                message = {"data": range_data}

                current_partition = (
                    partition
                    if partition or partition == 0
                    else self.get_partition(current_partition=current_partition)
                )

                producer.send(
                    topic=topic,
                    value=simplejson.dumps(message, ignore_nan=True).encode("utf-8"),
                    partition=current_partition,
                ).add_callback(self.on_success).add_errback(self.on_error)

        else:
            value = simplejson.dumps(data, ignore_nan=True).encode("utf-8")
            if partition:
                producer.send(
                    topic=topic,
                    value=value,
                    partition=partition,
                ).add_callback(self.on_success).add_errback(self.on_error)
            else:
                producer.send(topic=topic, value=value).add_callback(
                    self.on_success
                ).add_errback(self.on_error)
