import argparse

from config import configuration
from kafka_connector import KafkaConnector


def stream_purple_air_data():
    kafka_connector = KafkaConnector()
    kafka_connector.stream_data(
        topic=configuration.PURPLE_AIR_RAW_MEASUREMENTS_DATA_TOPIC,
        group_id=configuration.PURPLE_AIR_DATA_GROUP_ID,
    )


if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Stream functions configuration")

    parser.add_argument(
        "--task",
        required=True,
        type=str.lower,
        choices=[
            "stream-purple-air-data",
        ],
    )

    args = parser.parse_args()

    if args.task == "stream-purple-air-data":
        stream_purple_air_data()

    else:
        pass
