import json

# from confluent_kafka.avro import AvroProducer, AvroConsumer, SerializerError
from confluent_kafka import Producer

from schema import schema_str


# class KafkaWithRegistry:
#
#     boot_strap_servers = None
#     schema_registry_url = None
#     topic = None
#
#     def __init__(self, boot_strap_servers, schema_registry_url, topic) -> None:
#         self.boot_strap_servers = boot_strap_servers
#         self.schema_registry_url = schema_registry_url
#         self.topic = topic
#         super().__init__()
#
#     def delivery_report(self, err, msg):
#         if err is not None:
#             print(f'Message delivery to Bootstrap servers `{self.boot_strap_servers}`, '
#                   f'topic `{self.topic}` failed. Error : {err}')
#         else:
#             print(f'Message successfully delivered to {msg.topic()} [{msg.partition()}]')
#
#     def produce(self, key, value):
#
#         value_schema = avro.loads(schema_str)
#
#         avro_producer = AvroProducer({
#             'bootstrap.servers': self.boot_strap_servers,
#             'on_delivery': self.delivery_report,
#             'schema.registry.url': self.schema_registry_url
#         }, default_value_schema=value_schema)
#
#         try:
#             avro_producer.produce(topic=self.topic, value=value)
#             avro_producer.flush()
#         except Exception as e:
#             print("Message sending failed for : {}".format(e))
#
#     def consume(self):
#         c = AvroConsumer({
#             'bootstrap.servers': self.boot_strap_servers,
#             'group.id': 'consumer-test-group',
#             'schema.registry.url': self.schema_registry_url})
#
#         c.subscribe([self.topic])
#
#         while True:
#             try:
#                 msg = c.poll(10)
#             except SerializerError as e:
#                 print("Message deserialization failed for : {}".format(e))
#                 break
#
#             if msg is None:
#                 continue
#
#             if msg.error():
#                 print("AvroConsumer error: {}".format(msg.error()))
#                 continue
#
#             print(msg.value())
#
#         c.close()


class KafkaWithoutRegistry:

    boot_strap_servers = None
    topic = None

    def __init__(self, boot_strap_servers, topic) -> None:
        self.boot_strap_servers = boot_strap_servers
        self.topic = topic
        super().__init__()

    def delivery_report(self, err, msg):
        if err is not None:
            print(f'Message delivery to Bootstrap servers `{self.boot_strap_servers}`, '
                  f'topic `{self.topic}` failed. Error : {err}')
        else:
            print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))

    def produce(self, value):
        data = json.dumps(value)
        p = Producer({'bootstrap.servers': self.boot_strap_servers})
        p.produce(self.topic, data.encode('utf-8'), callback=self.delivery_report)

        p.flush()
