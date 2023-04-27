import json

import numpy as np
import pandas as pd
from kafka import KafkaProducer

from .config import configuration
from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.constants import Tenant
from .date import date_to_str


class MessageBrokerUtils:
    def __init__(self):
        self.__partitions = configuration.TOPIC_PARTITIONS
        self.__bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        self.__partitions = [0, 1, 2]
        self.bam_measurements_topic = configuration.BAM_MEASUREMENTS_TOPIC

    def __get_partition(self, current_partition) -> int:
        current_partition = current_partition + 1
        if current_partition in self.__partitions:
            return current_partition
        return self.__partitions[0]

    @classmethod
    def __on_success(cls, record_metadata):
        print("\nSuccessfully sent message")
        print(f"Topic : {record_metadata.topic}")
        print(f"Partition : {record_metadata.partition}")
        print(f"Offset : {record_metadata.offset}")

    @classmethod
    def __on_error(cls, exception):
        print("\nFailed to send message")
        print(exception)

    def __send_data(self, topic: str, data: pd.DataFrame, partition: int = None):
        producer = KafkaProducer(
            bootstrap_servers=self.__bootstrap_servers,
            api_version_auto_timeout_ms=300000,
            retries=5,
            request_timeout_ms=300000,
        )

        print("Dataframe info : ")
        print(data.info())
        print("Dataframe description : ")
        print(data.describe())
        data = data.replace(np.nan, None)

        chunks = int(len(data) / 50)
        chunks = chunks if chunks > 0 else 1
        dataframes = np.array_split(data, chunks)
        current_partition = -1
        for dataframe in dataframes:
            message = {"data": pd.DataFrame(dataframe).to_dict("records")}

            current_partition = (
                partition
                if partition or partition == 0
                else self.__get_partition(current_partition=current_partition)
            )

            producer.send(
                topic=topic,
                value=json.dumps(message, allow_nan=True).encode("utf-8"),
                partition=current_partition,
            ).add_callback(self.__on_success).add_errback(self.__on_error)

    @staticmethod
    def update_hourly_data_topic(data: pd.DataFrame):
        devices = AirQoApi().get_devices(tenant=Tenant.ALL)
        devices = pd.DataFrame(devices)
        devices = devices[["mongo_id", "name", "device_number", "site_id"]]
        devices.rename(
            columns={"mongo_id": "device_id", "name": "device_name"}, inplace=True
        )

        del data["device_id"]

        data = pd.merge(
            left=data, right=devices, on=["device_number", "site_id"], how="left"
        )
        data["network"] = data["tenant"]
        data["tenant"] = str(Tenant.AIRQO)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        MessageBrokerUtils().__send_data(
            topic=configuration.HOURLY_MEASUREMENTS_TOPIC, data=data
        )
