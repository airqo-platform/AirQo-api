from confluent_kafka import avro
from confluent_kafka.avro import AvroProducer


class Kafka:

    boot_strap_servers = None
    schema_registry_url = None
    value_schema = None
    key_schema = None
    topic = None

    def __init__(self, boot_strap_servers, schema_registry_url, value_schema_str, key_schema_str, topic) -> None:
        self.boot_strap_servers = boot_strap_servers
        self.schema_registry_url = schema_registry_url
        self.value_schema = avro.loads(value_schema_str)
        self.key_schema = avro.loads(key_schema_str)
        self.topic = topic
        super().__init__()

    def delivery_report(self, err, msg):
        """ Called once for each message produced to indicate delivery result.
            Triggered by poll() or flush(). """
        if err is not None:
            print(f'Message delivery to Bootstrap servers `{self.boot_strap_servers}`, '
                  f'topic `{self.topic}` failed. Error : {err}')
        else:
            print(f'Message successfully delivered to {msg.topic()} [{msg.partition()}]')

    def produce(self, key, value):
        avro_producer = AvroProducer({
            'bootstrap.servers': self.boot_strap_servers,
            'on_delivery': self.delivery_report,
            'schema.registry.url': self.schema_registry_url
        }, default_key_schema=self.key_schema, default_value_schema=self.value_schema)

        avro_producer.produce(topic=self.topic, value=value, key=key)
        avro_producer.flush()

    # value_schema_str = """
    # {
    #    "namespace": "my.test",
    #    "name": "value",
    #    "type": "record",
    #    "fields" : [
    #      {
    #        "name" : "name",
    #        "type" : "string"
    #      }
    #    ]
    # }
    # """
    #
    # key_schema_str = """
    # {
    #    "namespace": "my.test",
    #    "name": "key",
    #    "type": "record",
    #    "fields" : [
    #      {
    #        "name" : "name",
    #        "type" : "string"
    #      }
    #    ]
    # }
    # """
    #
    #
    # value = {"name": "Value"}
    # key = {"name": "Key"}
