import json
import os
import traceback
from datetime import datetime, timedelta

import pandas as pd
import requests
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
        self.airqo_base_url = os.getenv("AIRQO_BASE_URL")
        self.airqo_api_key = os.getenv("AIRQO_API_KEY")
        self.tenant = os.getenv("TENANT")
        self.request_body_size = os.getenv("REQUEST_BODY_SIZE")
        self.security_protocol = os.getenv("SECURITY_PROTOCOL")
        self.sasl_mechanism = os.getenv("SASL_MECHANISM")
        self.sasl_plain_username = os.getenv("SASL_USERNAME")
        self.sasl_plain_password = os.getenv("SASL_PASSWORD")

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

    def __post_events(self, measurements):

        try:
            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'JWT {self.airqo_api_key}'
            }
            url = f'{self.airqo_base_url}devices/events?tenant={self.tenant}'
            json_data = json.dumps(measurements)

            response = requests.post(url, json_data, headers=headers, verify=False)

            if response.status_code == 200:
                print(response.json())
                print(json_data)
            else:
                print("Device registry failed to insert values. Status Code : " + str(response.status_code))
                print(response.content)
                print(response.request.url)
                print(response.request.body)
        except:
            traceback.print_exc()

    def __produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.registry_client, self.output_topic)
        producer = KafkaProducer(bootstrap_servers=self.bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer.send(self.output_topic, bytes_data)

    def consume_measurements(self):

        # avro_serde = AvroKeyValueSerde(self.registry_client, self.input_topic)
        # security_protocol=self.security_protocol,
        # sasl_mechanism=self.sasl_mechanism,
        # sasl_plain_username=self.sasl_plain_username,
        # sasl_plain_password=self.sasl_plain_password

        consumer = KafkaConsumer(
            self.input_topic,
            group_id=self.consumer_group,
            bootstrap_servers=self.bootstrap_servers,
            auto_offset_reset='earliest',
            enable_auto_commit=self.auto_commit)

        for msg in consumer:
            # value = avro_serde.value.deserialize(msg.value)

            value = json.loads(msg.value.decode('ascii'))
            calibrated_measurements = []

            if datetime.now() > self.next_initialization:
                self.reload()

            try:

                value_df = pd.read_json(value)

                measurements_list = []
                for _, measurement in value_df.iterrows():
                    measurements_list.append(measurement.to_dict()["measurements"])

                print(measurements_list)
                if len(measurements_list) == 0:
                    print('No data')
                    continue

                for measurement in measurements_list:

                    calibrated_measurement = dict(measurement)

                    try:
                        pm2_5 = dict(calibrated_measurement.get("pm2_5")).get('value')
                        pm10 = dict(calibrated_measurement.get("pm10")).get('value')
                        s2_pm25 = dict(calibrated_measurement.get("s2_pm2_5")).get('value')
                        s2_pm10 = dict(calibrated_measurement.get("s2_pm10")).get('value')
                        temperature = dict(calibrated_measurement.get("internalTemperature")).get('value')
                        humidity = dict(calibrated_measurement.get("internalHumidity")).get('value')
                        time = calibrated_measurement.get('time')

                        calibrated_value = self.rg_model.compute_calibrated_val(
                            pm2_5=pm2_5, s2_pm2_5=s2_pm25, pm10=pm10, datetime=time,
                            s2_pm10=s2_pm10, temperature=temperature, humidity=humidity)

                        calibrated_measurement["pm2_5"]["calibratedValue"] = calibrated_value

                    except:
                        traceback.print_exc()

                    calibrated_measurements.append(calibrated_measurement)

                if calibrated_measurements:
                    print(dict({"calibrated measurements": calibrated_measurements}))

                    for i in range(0, len(calibrated_measurements), int(self.request_body_size)):
                        values = calibrated_measurements[i:i + int(self.request_body_size)]
                        self.__post_events(values)

                    # self.__produce_measurements(dict({"measurements": calibrated_measurements}))

            except:
                traceback.print_exc()


def main():
    kafka_client = KafkaClient()
    kafka_client.consume_measurements()


if __name__ == "__main__":
    main()
