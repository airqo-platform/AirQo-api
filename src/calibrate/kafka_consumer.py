import os
import traceback
from datetime import datetime, timedelta

import pandas as pd
import requests
import urllib3
from confluent_avro import AvroKeyValueSerde, SchemaRegistry
from dotenv import load_dotenv
from kafka import KafkaConsumer, KafkaProducer
from pytz import utc

from models import regression as rg
from schema import schema_str
from jobs import regression as jobs_rg

# Ref: https://kafka-python.readthedocs.io/en/master/usage.html

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
        self.airqo_base_url = os.getenv("AIRQO_BASE_URL").removesuffix("/")
        self.airqo_api_key = os.getenv("AIRQO_API_KEY")
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

    def produce_measurements(self, measurements):
        avro_serde = AvroKeyValueSerde(self.registry_client, self.output_topic)
        producer = KafkaProducer(bootstrap_servers=self.bootstrap_servers)
        bytes_data = avro_serde.value.serialize(measurements, schema_str)
        producer.send(self.output_topic, bytes_data)

    def consume_measurements(self):

        avro_serde = AvroKeyValueSerde(self.registry_client, self.input_topic)
        # consumer = KafkaConsumer(
        #     self.input_topic,
        #     group_id=self.consumer_group,
        #     bootstrap_servers=self.bootstrap_servers,
        #     auto_offset_reset='earliest',
        #     enable_auto_commit = self.auto_commit,
        #     security_protocol=self.security_protocol,
        #     sasl_mechanism=self.sasl_mechanism,
        #     sasl_plain_username=self.sasl_plain_username,
        #     sasl_plain_password=self.sasl_plain_password)

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
                measurements_df = pd.DataFrame(dict(value).get("measurements", []))
                # measurements_time_df = pd.DataFrame(dict(value).get("measurements", []))

                if len(measurements_df) == 0:
                    print('No data')
                    continue

                # measurements_time_df['time'] = pd.to_datetime(measurements_df['time'])
                # minimum_datetime = min(measurements_time_df['time']) - timedelta(hours=int(self.time_interval))
                # minimum_datetime_str = minimum_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')

                measurements_df['time'] = pd.to_datetime(measurements_df['time'])
                minimum_datetime = min(measurements_df['time']) - timedelta(hours=int(self.time_interval))
                minimum_datetime_str = minimum_datetime.strftime('%Y-%m-%dT%H:%M:%SZ')
                measurements_df['time'] = measurements_df['time'].dt.strftime('%Y-%m-%dT%H:%M:%SZ')

                tenant = measurements_df.iloc[0]['tenant']

                devices_names = ""
                for _, row in measurements_df.iterrows():
                    devices_names = f"{devices_names},{row['device']}"
                devices_names = devices_names.strip().removeprefix(',').removesuffix(',')

                historical_data = pd.DataFrame(self.__get_hourly_historical_measurements(
                    devices_names=devices_names, start_time=minimum_datetime_str, tenant=tenant))

                if len(historical_data) == 0:
                    print('No historical data')
                    continue

                for _, measurement in measurements_df.iterrows():
                    try:
                        calibrated_measurement = dict(measurement)

                        recent_recordings = measurements_df.loc[measurements_df['device'] == measurement.get('device')]
                        historical_recordings = historical_data.loc[historical_data['device'] == measurement.get('device')]

                        combined_recordings = pd.DataFrame(recent_recordings.append(historical_recordings))
                        combined_recordings.reset_index(drop=True, inplace=True)
                        combined_recordings = pd.json_normalize(combined_recordings.to_dict(orient="records"))
                        combined_recordings.fillna(method='ffill')

                        start_time = datetime.strptime(measurement.get('time'), '%Y-%m-%dT%H:%M:%SZ').astimezone(utc) - \
                                     timedelta(hours=int(self.time_interval))

                        combined_recordings['time'] = pd.to_datetime(combined_recordings['time'])
                        combined_recordings = combined_recordings.loc[combined_recordings['time'] > start_time]
                        combined_recordings['time'] = combined_recordings['time'].dt.strftime('%Y-%m-%dT%H:%M:%SZ')

                        average_pm2_5 = combined_recordings["pm2_5.value"].mean()
                        average_pm10 = combined_recordings["pm10.value"].mean()
                        average_s2_pm25 = combined_recordings["s2_pm2_5.value"].mean()
                        average_s2_pm10 = combined_recordings["s2_pm10.value"].mean()
                        average_temperature = combined_recordings["internalTemperature.value"].mean()
                        average_humidity = combined_recordings["internalHumidity.value"].mean()
                        time = measurement.get('time')

                        if average_pm2_5 and average_pm10 and average_s2_pm25 and average_s2_pm10 and \
                                average_temperature and average_humidity and time:

                            calibrated_value = self.rg_model.compute_calibrated_val(
                                pm2_5=average_pm2_5, s2_pm2_5=average_s2_pm25, pm10=average_pm10, datetime=time,
                                s2_pm10=average_s2_pm10, temperature=average_temperature, humidity=average_humidity)

                            calibrated_measurement["pm2_5"]["calibratedValue"] = calibrated_value

                        calibrated_measurements.append(calibrated_measurement)
                    except Exception as e:
                        traceback.print_exc()
                        print(e)

                if calibrated_measurements:
                    print(dict({"calibrated measurements": calibrated_measurements}))
                    self.produce_measurements(dict({"measurements": calibrated_measurements}))

            except Exception as e:
                traceback.print_exc()
                print(e)

    def __get_hourly_historical_measurements(self, devices_names, start_time, tenant):
        try:

            headers = {
                'Content-Type': 'application/json',
                'Authorization': f'JWT {self.airqo_api_key}'
            }
            url = f"{self.airqo_base_url}/devices/events"
            params = {
                "tenant": tenant,
                "device": devices_names,
                "startTime": start_time
            }
            results = requests.get(url, headers=headers, params=params, verify=False)

            if results.status_code == 200:
                return results.json()["measurements"]
            else:
                print(f"Device registry failed to get measurements. Status Code : {results.status_code}")
                print(f"Response : {results.content}")
                print(f"Request Url : {results.request.url}")
        except Exception as ex:
            print(f"Error Occurred while getting measurements: {ex}")
            return []


def main():
    kafka_client = KafkaClient()
    kafka_client.consume_measurements()


if __name__ == "__main__":
    main()

