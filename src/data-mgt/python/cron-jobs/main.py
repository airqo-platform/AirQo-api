import json

import urllib3
from dotenv import load_dotenv

from kafka_client import KafkaClient
from measurements import average_measurements_by_hour

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
load_dotenv()


def main():
    average_measurements_by_hour()
    hourly_measurements = average_measurements_by_hour()
    data = json.dumps(dict({"measurements": hourly_measurements}))
    print(data)
    client = KafkaClient()
    client.produce_measurements(data)


if __name__ == '__main__':
    main()
