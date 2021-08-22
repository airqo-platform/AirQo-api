import math
import os
import traceback
from datetime import datetime, timedelta

import pandas as pd
import urllib3
from confluent_avro import AvroKeyValueSerde, SchemaRegistry
from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer

from jobs import regression as jobs_rg
from models import regression as rg
from schema import schema_str

load_dotenv()
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


class KafkaClient:
    rg_model = None
    next_initialization = None

    def __init__(self):
        self.bootstrap_servers = [os.getenv("BOOTSTRAP_SERVERS")]
        self.input_topic = os.getenv("INPUT_TOPIC")
        self.output_topic = os.getenv("OUTPUT_TOPIC")
        self.consumer_group = os.getenv("CONSUMER_GROUP")
        self.schema_registry_url = os.getenv("SCHEMA_REGISTRY_URL")
        self.auto_commit = True if f"{os.getenv('AUTO_COMMIT', False)}".strip().lower() == "true" else False
        self.reload_interval = os.getenv("RELOAD_INTERVAL")
        self.time_interval = os.getenv("TIME_INTERVAL")
        self.average_frequency = os.getenv("AVERAGE_FREQUENCY")
        self.airqo_base_url = os.getenv("AIRQO_BASE_URL").removesuffix("/")
        self.airqo_api_key = os.getenv("AIRQO_API_KEY")
        # self.security_protocol = os.getenv("SECURITY_PROTOCOL")
        # self.sasl_mechanism = os.getenv("SASL_MECHANISM")
        # self.sasl_plain_username = os.getenv("SASL_USERNAME")
        # self.sasl_plain_password = os.getenv("SASL_PASSWORD")

        self.registry_client = SchemaRegistry(
            self.schema_registry_url,
            headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        )
        self.reload()

    def reload(self):
        print("Generating pkl file")
        jobs_rg.main()
        print("Finished generating pkl file")
        self.rg_model = rg.Regression()
        self.next_initialization = datetime.now() + timedelta(days=int(self.reload_interval))

    def produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.registry_client, self.output_topic)
        producer = KafkaProducer(bootstrap_servers=self.bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer.send(self.output_topic, bytes_data)

    def consume_measurements(self):

        avro_serde = AvroKeyValueSerde(self.registry_client, self.input_topic)

        #     security_protocol=self.security_protocol,
        #     sasl_mechanism=self.sasl_mechanism,
        #     sasl_plain_username=self.sasl_plain_username,
        #     sasl_plain_password=self.sasl_plain_password

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
                measurements_list = list(dict(value).get("measurements", []))

                if len(measurements_list) == 0:
                    print('No data')
                    continue

                for measurement in measurements_list:

                    calibrated_measurement = dict(measurement)
                    measurement_df = pd.DataFrame(calibrated_measurement)

                    try:
                        measurement_df = pd.json_normalize(measurement_df.to_dict(orient="records"))
                        measurement_dict = measurement_df.to_dict(orient="records")

                        average_pm2_5 = measurement_dict.get("pm2_5.value")
                        average_pm10 = measurement_dict.get("pm10.value")
                        average_s2_pm25 = measurement_dict.get("s2_pm2_5.value")
                        average_s2_pm10 = measurement_dict.get("s2_pm10.value")
                        average_temperature = measurement_dict.get("internalTemperature.value")
                        average_humidity = measurement_dict.get("internalHumidity.value")
                        time = measurement_df.get('time')

                        if (average_pm2_5 and not math.isnan(average_pm2_5)) and \
                                (average_pm10 and not math.isnan(average_pm10)) and \
                                (average_s2_pm25 and not math.isnan(average_s2_pm25)) and \
                                (average_s2_pm10 and not math.isnan(average_s2_pm10)) and \
                                (average_temperature and not math.isnan(average_temperature)) and \
                                (average_humidity and not math.isnan(average_humidity)) and \
                                time:
                            calibrated_value = self.rg_model.compute_calibrated_val(
                                pm2_5=average_pm2_5, s2_pm2_5=average_s2_pm25, pm10=average_pm10, datetime=time,
                                s2_pm10=average_s2_pm10, temperature=average_temperature, humidity=average_humidity)

                            calibrated_measurement["pm2_5"]["calibratedValue"] = calibrated_value

                    except Exception as e:
                        traceback.print_exc()
                        print(e)

                    calibrated_measurements.append(calibrated_measurement)

                if calibrated_measurements:
                    print(dict({"calibrated measurements": calibrated_measurements}))
                    self.produce_measurements(dict({"measurements": calibrated_measurements}))

            except Exception as e:
                traceback.print_exc()
                print(e)


def main():
    kafka_client = KafkaClient()
    kafka_client.consume_measurements()


if __name__ == "__main__":
    main()
