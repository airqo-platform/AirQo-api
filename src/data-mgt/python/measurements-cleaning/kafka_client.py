import os
import traceback

from confluent_avro import SchemaRegistry, AvroKeyValueSerde
from kafka import KafkaProducer, KafkaConsumer


class KafkaClient:

    rg_model = None
    hourly_combined_dataset = None
    next_initialization = None

    def __init__(self):
        self.bootstrap_servers = [os.getenv("BOOTSTRAP_SERVERS")]
        self.input_topic = os.getenv("INPUT_TOPIC")
        self.output_topic = os.getenv("OUTPUT_TOPIC")
        self.consumer_group = os.getenv("CONSUMER_GROUP")
        self.schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL")
        self.auto_commit = True if f"{os.getenv('AUTO_COMMIT', True)}".strip().lower() == "true" else False
        self.reload_interval = os.getenv("RELOAD_INTERVAL", 1)

        self.registry_client = SchemaRegistry(
            self.schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )

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
            cleaned_measurements = []

            try:
                measurements = list(dict(value).get("measurements"))
                for measure in measurements:

                    try:
                        measurement = dict(measure)

                        pm25 = measurement.get('pm2_5').get('value')
                        pm10 = measurement.get('pm10').get('value')
                        temperature = measurement.get('externalTemperature').get('value')
                        humidity = measurement.get('externalHumidity').get('value')
                        time = measurement.get('time')

                        if pm25 and pm10 and temperature and humidity and time:
                            calibrated_value = self.rg_model.random_forest(time, pm25, pm10, temperature,
                                                                           humidity, self.hourly_combined_dataset)
                            measurement["pm2_5"]["calibratedValue"] = calibrated_value

                        cleaned_measurements.append(measurement)

                    except Exception as ex:
                        traceback.print_exc()
                        print(ex)
                        continue

                if cleaned_measurements:
                    print(dict({"calibrated measurements": cleaned_measurements}))
                    self.produce_measurements(dict({"measurements": cleaned_measurements}))

            except Exception as e:
                traceback.print_exc()
                print(e)


if __name__ == "__main__":
    kafka_client = KafkaClient()
    kafka_client.consume_measurements()