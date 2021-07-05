import os

# from confluent_kafka.avro import AvroProducer, loads
import traceback

from confluent_avro import AvroKeyValueSerde, SchemaRegistry

# Ref: https://github.com/confluentinc/confluent-kafka-python
# Ref: https://kafka-python.readthedocs.io/en/master/usage.html

from kafka import KafkaConsumer, KafkaProducer

from models import regression
from schema import schema_str

BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")
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


# def produce_measurements(measurement):
#     value_schema = loads(schema_str)
#
#     avr_producer = AvroProducer({
#         'bootstrap.servers': BOOTSTRAP_SERVERS,
#         'on_delivery': delivery_report,
#         'schema.registry.url': SCHEMA_REGISTRY_URL
#     }, default_value_schema=value_schema)
#     avr_producer.produce(topic=OUTPUT_TOPIC, value=measurement)
#     avr_producer.flush()


def produce_measurements(measurements):
    avro_serde = AvroKeyValueSerde(registry_client, INPUT_TOPIC)
    producer = KafkaProducer(bootstrap_servers=[BOOTSTRAP_SERVERS])
    bytes_data = avro_serde.value.serialize(measurements, schema_str)
    producer.send(OUTPUT_TOPIC, bytes_data)


def consume_measurements(registry):

    avro_serde = AvroKeyValueSerde(registry, INPUT_TOPIC)
    consumer = KafkaConsumer(INPUT_TOPIC, bootstrap_servers=[BOOTSTRAP_SERVERS])

    rg_model = regression.Regression()
    hourly_combined_dataset = rg_model.hourly_combined_dataset

    for msg in consumer:
        print(msg)
        value = avro_serde.value.deserialize(msg.value)
        calibrated_measurements = []

        try:

            measurements = list(dict(value).get("measurements"))
            for measure in measurements:

                try:
                    measurement = dict(measure)

                    pm25 = measurement.get('pm2_5').get('value', None)
                    pm10 = measurement.get('pm10').get('value', None)
                    temperature = measurement.get('internalTemperature').get('value', None)
                    humidity = measurement.get('internalHumidity').get('value', None)
                    datetime = measurement.get('time', None)

                    if pm25 and pm10 and temperature and humidity and datetime:
                        calibrated_value = rg_model.random_forest(datetime, pm25, pm10, temperature,
                                                                  humidity, hourly_combined_dataset)
                        measurement["pm_2_5"]["calibratedValue"] = calibrated_value

                    calibrated_measurements.append(measurement)

                except Exception as ex:
                    traceback.print_exc()
                    print(ex)
                    continue

            if calibrated_measurements:
                produce_measurements(dict({"measurements": calibrated_measurements}))

        except Exception as e:
            traceback.print_exc()
            print(e)


if __name__ == "__main__":
    registry_client = SchemaRegistry(
        SCHEMA_REGISTRY_URL,
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
    )
    consume_measurements(registry_client)
