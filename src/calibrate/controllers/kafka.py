import os

from confluent_kafka.avro import AvroConsumer, AvroProducer
from confluent_kafka.avro.serializer import SerializerError

# Ref: https://github.com/confluentinc/confluent-kafka-python

BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "127.0.0.1:9092")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL", "http://127.0.0.1:8081")
INPUT_TOPIC = os.getenv("INPUT_TOPIC")
OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP")


def delivery_report(err, msg):
    """ Called once for each message produced to indicate delivery result.
        Triggered by poll() or flush(). """
    if err is not None:
        print('Message delivery failed: {}'.format(err))
    else:
        print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))


def produce_measurements(measurements, key):

    avr_producer = AvroProducer({
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'on_delivery': delivery_report,
        'schema.registry.url': SCHEMA_REGISTRY_URL
    })
    avr_producer.produce(topic=OUTPUT_TOPIC, value=measurements, key=key)
    avr_producer.flush()


def consume_measurements():
    consumer = AvroConsumer({
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'group.id': CONSUMER_GROUP,
        'schema.registry.url': SCHEMA_REGISTRY_URL})

    consumer.subscribe([INPUT_TOPIC])

    while True:
        try:
            msg = consumer.poll(10)

        except SerializerError as e:
            print("Message deserialization failed for {}: {}".format(msg, e))
            break

        if msg is None:
            continue

        if msg.error():
            print("AvroConsumer error: {}".format(msg.error()))
            continue

        print(msg.value())
        produce_measurements(msg.value(), "tenant")

    consumer.close()


if __name__ == "__main__":
    consume_measurements()
