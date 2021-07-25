import os
import traceback

from confluent_avro import AvroKeyValueSerde, SchemaRegistry
from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer
from models import regression
from schema import schema_str
from datetime import datetime, timedelta

# Ref: https://kafka-python.readthedocs.io/en/master/usage.html

load_dotenv()

BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")
INPUT_TOPIC = os.getenv("INPUT_TOPIC")
OUTPUT_TOPIC = os.getenv("OUTPUT_TOPIC")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP")
AUTO_COMMIT = os.getenv("AUTO_COMMIT")


class KafkaClient:

    rg_model = None
    hourly_combined_dataset = None
    next_initialization = None

    def __init__(self):
        self.registry_client = SchemaRegistry(
            SCHEMA_REGISTRY_URL,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )
        self.bootstrap_servers = [BOOTSTRAP_SERVERS]
        self.input_topic = INPUT_TOPIC
        self.output_topic = OUTPUT_TOPIC
        self.consumer_group = CONSUMER_GROUP
        self.auto_commit = True if f"{AUTO_COMMIT}".strip().lower() == "true" else False

        self.reload()

    def reload(self):
        self.rg_model = regression.Regression()
        self.hourly_combined_dataset = self.rg_model.hourly_combined_dataset
        self.next_initialization = datetime.now() + timedelta(hours=1)

    def produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.registry_client, self.output_topic)
        producer = KafkaProducer(bootstrap_servers=self.bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer.send(self.output_topic, bytes_data)

    def consume_measurements(self):

        avro_serde = AvroKeyValueSerde(self.registry_client, self.input_topic)
        consumer = KafkaConsumer(
            self.input_topic,
            group_id=self.consumer_group,
            bootstrap_servers=self.bootstrap_servers,
            auto_offset_reset='earliest',
            enable_auto_commit=self.auto_commit)

        for msg in consumer:
            value = avro_serde.value.deserialize(msg.value)
            calibrated_measurements = []

            if datetime.now() > self.next_initialization:
                self.reload()

            try:
                measurements = list(dict(value).get("measurements"))
                for measure in measurements:

                    try:
                        measurement = dict(measure)

                        pm25 = measurement.get('pm2_5').get('value')
                        pm10 = measurement.get('pm10').get('value')
                        temperature = measurement.get('internalTemperature').get('value')
                        humidity = measurement.get('internalHumidity').get('value')
                        time = measurement.get('time')

                        if pm25 and pm10 and temperature and humidity and time:
                            calibrated_value = self.rg_model.random_forest(time, pm25, pm10, temperature,
                                                                           humidity, self.hourly_combined_dataset)
                            measurement["pm2_5"]["calibratedValue"] = calibrated_value

                        calibrated_measurements.append(measurement)

                    except Exception as ex:
                        traceback.print_exc()
                        print(ex)
                        continue

                if calibrated_measurements:
                    print(dict({"calibrated measurements": calibrated_measurements}))
                    self.produce_measurements(dict({"measurements": calibrated_measurements}))

            except Exception as e:
                traceback.print_exc()
                print(e)


if __name__ == "__main__":
    kafka_client = KafkaClient()
    kafka_client.consume_measurements()
