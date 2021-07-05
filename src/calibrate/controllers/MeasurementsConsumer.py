import os

# from confluent_kafka.avro import AvroProducer
from confluent_avro import AvroKeyValueSerde, SchemaRegistry


# Ref: https://github.com/confluentinc/confluent-kafka-python
# Ref: https://kafka-python.readthedocs.io/en/master/usage.html

from kafka import KafkaConsumer

# from models.regression import Regression
from models import regression
BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS", "34.123.249.54:31000")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL", "http://34.123.249.54:31081")
INPUT_TOPIC = os.getenv("INPUT_TOPIC", "kcca-transformed-device-measurements-topic")
OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP", "testing calibrate")


def delivery_report(err, msg):
    """ Called once for each message produced to indicate delivery result.
        Triggered by poll() or flush(). """
    if err is not None:
        print('Message delivery failed: {}'.format(err))
    else:
        print('Message delivered to {} [{}]'.format(msg.topic(), msg.partition()))


# def produce_measurements(measurements, key):
#
#     avr_producer = AvroProducer({
#         'bootstrap.servers': BOOTSTRAP_SERVERS,
#         'on_delivery': delivery_report,
#         'schema.registry.url': SCHEMA_REGISTRY_URL
#     })
#     avr_producer.produce(topic=OUTPUT_TOPIC, value=measurements, key=key)
#     avr_producer.flush()


def consume_measurements():
    registry_client = SchemaRegistry(
        SCHEMA_REGISTRY_URL,
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
    )
    avroSerde = AvroKeyValueSerde(registry_client, INPUT_TOPIC)
    consumer = KafkaConsumer(INPUT_TOPIC, bootstrap_servers=[BOOTSTRAP_SERVERS])

    rgModel = regression.Regression()
    hourly_combined_dataset = rgModel.hourly_combined_dataset

    for msg in consumer:

        value = avroSerde.value.deserialize(msg.value)
        print(value)
        calibrated_measurements = []

        try:

            measurements = list(dict(value).get("measurements"))
            for measure in measurements:

                try:
                    measurement = dict(measure)

                    pm25 = measurement.get('pm_2_5').get('value', None)
                    pm10 = measurement.get('pm10').get('value', None)
                    temperature = measurement.get('internalTemperature').get('value', None)
                    humidity = measurement.get('internalHumidity').get('value', None)
                    datetime = measurement.get('time', None)

                    if pm25 and pm10 and temperature and humidity and datetime:
                        calibrated_value = rgModel.random_forest(datetime, pm25, pm10, temperature,
                                                                 humidity, hourly_combined_dataset)
                        measurement["pm_2_5"]["calibratedValue"] = calibrated_value

                    calibrated_measurements.append(measurement)

                except Exception as ex:
                    print(ex)
                    continue

            print(dict({
                "measurements": calibrated_measurements
            }))
            # if calibrated_measurements:
            #     produce_measurements(calibrated_measurements, "tenant")

        except Exception as e:
            print(e)

        print(dict({
            "measurements": calibrated_measurements
            }))

    consumer.close()


if __name__ == "__main__":
    # registry_client = SchemaRegistry(
    #     SCHEMA_REGISTRY_URL,
    #     headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
    # )
    # avroSerde = AvroKeyValueSerde(registry_client, INPUT_TOPIC)
    # consumer = KafkaConsumer(INPUT_TOPIC, bootstrap_servers=[BOOTSTRAP_SERVERS])
    # for msg in consumer:
    #     v = avroSerde.value.deserialize(msg.value)
    #     print(v)
    consume_measurements()
