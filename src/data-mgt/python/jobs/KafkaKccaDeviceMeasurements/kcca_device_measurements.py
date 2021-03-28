import json
import os
import pandas as pd
import requests
from datetime import datetime, timedelta
from kafka import KafkaProducer
from kafka.errors import KafkaError
import traceback

CLARITY_API_KEY = os.getenv("CLARITY_API_KEY")
CLARITY_API_BASE_URL = os.getenv("CLARITY_API_BASE_URL")
KAFKA_TOPIC = os.getenv("KAFKA_TOPIC")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS")

"""
:Clarity Api Documentation: https://api-guide.clarity.io/
"""


def get_kcca_device_measurements():

    # get kcca devices
    devices_codes = get_devices_codes()

    # get kcca devices measurements
    device_measurements = get_devices_measurements(devices_codes)

    data = pd.DataFrame(device_measurements)

    for index, row in data.iterrows():

        location = row["location"]["coordinates"]

        transformed_data = dict({
            'id': row["_id"],
            'time': row["time"],
            'device': row["device"],
            'deviceCode': row["deviceCode"],
            'location': dict({
                "longitude": location[0], "latitude": location[1]})
        })

        measurements = pd.Series(row["characteristics"])

        transformed_measurements = []

        for component in measurements.keys():

            details = dict({ component : {
                'value': measurements[component]["raw"],
            }})

            if "calibratedValue" in measurements[component].keys():
                details[component]['calibratedValue'] = measurements[component]["calibratedValue"]
            else:
                details[component]['calibratedValue'] = measurements[component]["value"]

            transformed_measurements.append(details)

        transformed_data['measurements'] = transformed_measurements

        send_to_kafka(transformed_data)


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%SZ')


def get_devices_measurements(devices_codes):

    """
    :return: current kcca device measurements
    """

    # get current date and time 5 minutes ago : %Y-%m-%dT%H:%M:%SZ
    # the cron job must be scheduled to run as the time interval stated here
    date = date_to_str(datetime.now() - timedelta(hours=5, minutes=0))

    # compose a url to get device measurements for all the devices
    api_url = CLARITY_API_BASE_URL + "measurements?startTime=" + date + "&code="

    for code in devices_codes:
        api_url = api_url + code + ","

    api_url = api_url[:-1]

    # get the device measurements
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    results = requests.get(api_url, headers=headers)

    return results.json()


def send_to_kafka(data):

    try:
        producer = KafkaProducer(bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                                 value_serializer=lambda m: json.dumps(m).encode('utf-8'))
        producer.send(KAFKA_TOPIC, data)
    except KafkaError:
        traceback.print_exc()


def get_devices_codes():
    """
    gets all kcca devices
    :return: list of device codes
    """
    headers = {'x-api-key': CLARITY_API_KEY, 'Accept-Encoding': 'gzip'}
    api_url = CLARITY_API_BASE_URL + "devices"
    results = requests.get(api_url, headers=headers)

    device_data = pd.DataFrame(results.json())

    device_codes = []

    for index, row in device_data.iterrows():
        device_codes.append(row['code'])

    return device_codes


if __name__ == "__main__":
    get_kcca_device_measurements()