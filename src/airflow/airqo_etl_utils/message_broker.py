import simplejson
from kafka import KafkaProducer

from airqo_etl_utils.config import configuration


class KafkaBrokerClient:
    def __init__(self):
        self.__partitions = configuration.TOPIC_PARTITIONS
        self.__bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        # self.__schema_registry_url = configuration.SCHEMA_REGISTRY_URL
        # self.__registry_client = SchemaRegistry(
        #     self.__schema_registry_url,
        #     headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        # )

    def send_data(
        self,
        topic,
        info: dict,
    ):
        data = info["data"]
        tenant = info["tenant"] if "tenant" in info.keys() else ""
        # avro_serde = AvroKeyValueSerde(self.__registry_client, self.__output_topic)
        # bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer = KafkaProducer(
            bootstrap_servers=self.__bootstrap_servers,
            api_version_auto_timeout_ms=300000,
        )

        # partition_size = len(self.__partitions)
        # partition_index = 0

        if len(data) > 50:
            action = info["action"]

            for i in range(0, len(data), 50):
                # partition = int(self.__partitions[partition_index])
                range_data = data[i : i + 50]

                message = {"data": range_data, "action": action, "tenant": tenant}

                producer.send(
                    topic=topic, value=simplejson.dumps(message).encode("utf-8")
                )

                # if partition_index + 1 < partition_size:
                #     partition_index = partition_index + 1
                # else:
                #     partition_index = 0
        else:
            producer.send(topic=topic, value=simplejson.dumps(info).encode("utf-8"))
