import os
import traceback
import requests
from confluent_avro import AvroKeyValueSerde, SchemaRegistry
from kafka import KafkaConsumer  # Ref: https://kafka-python.readthedocs.io/en/master/usage.html
import pandas as pd

BOOTSTRAP_SERVERS = os.getenv("BOOTSTRAP_SERVERS")
SCHEMA_REGISTRY_URL = os.getenv("SCHEMA_REGISTRY_URL")
INPUT_TOPIC = os.getenv("INPUT_TOPIC")
CONSUMER_GROUP = os.getenv("CONSUMER_GROUP", "asasasa")
BASE_URL = os.getenv("BASE_URL", "https://staging-platform.airqo.net/api/v1/")


def post_measurements(measurements, tenant, device):
    try:

        headers = {'Content-Type': 'application/json'}
        url = f"{BASE_URL}devices/events/add?device={device}&tenant={tenant}"
        results = requests.post(url, measurements, headers=headers, verify=False)

        if results.status_code == 200:
            print(results.json())
        else:
            print('\n')
            print(
                f"Device registry failed to insert values. Status Code : {str(results.status_code)}, Url : {url}")
            print(results.content)
            print('\n')

    except Exception as ex:
        traceback.print_exc()
        print(f"Error Occurred while inserting measurements: {str(ex)}")


def consume_measurements(registry):

    avro_serde = AvroKeyValueSerde(registry, INPUT_TOPIC)
    consumer = KafkaConsumer(INPUT_TOPIC,  group_id=CONSUMER_GROUP, bootstrap_servers=[BOOTSTRAP_SERVERS])

    for msg in consumer:

        value = avro_serde.value.deserialize(msg.value)

        try:

            measurements = pd.DataFrame(dict(value).get("measurements"))
            measurements_groups = measurements.groupby(by=["device"])
            for index, group in measurements_groups:
                tenant = group["tenant"].values[0]
                device = group["device"].values[0]
                print(tenant)
                print(device)
                print(group.to_json())
                # post_measurements(group.to_json(), tenant=tenant, device=device)

        except Exception as e:
            traceback.print_exc()
            print(e)


if __name__ == "__main__":
    registry_client = SchemaRegistry(
        SCHEMA_REGISTRY_URL,
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
    )
    consume_measurements(registry_client)
