import json
import logging
import sys

import numpy as np
import pandas as pd
from kafka import KafkaProducer, KafkaConsumer

from .config import configuration
from airqo_etl_utils.airqo_api import AirQoApi
from airqo_etl_utils.constants import Tenant
from .date import date_to_str

from typing import Any, Generator, Optional, List

logger = logging.getLogger(__name__)


class MessageBrokerUtils:
    """
    A utility class for interacting with a Kafka message broker, including publishing data to
    a topic and consuming messages from a topic. This class is designed for data ingestion
    and retrieval using Kafka as a transport layer.
    """

    MAX_MESSAGE_SIZE = 1 * 1024 * 1024

    def __init__(self):
        """
        Initialize the MessageBrokerUtils class with configuration settings.
        """
        self.__partitions = configuration.TOPIC_PARTITIONS
        self.__bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        self.partition_loads = {
            int(p): 0 for p in self.__partitions
        }  # Initialize partition loads

    def __get_partition(self, current_partition) -> int:
        """Get next partition to load data into -- roundrobin"""
        current_partition = current_partition + 1
        if current_partition in self.__partitions:
            return current_partition
        return self.__partitions[0]

    def __get_least_loaded_partition(self) -> int:
        """Select the least loaded partition."""
        return min(self.partition_loads, key=self.partition_loads.get)

    @classmethod
    def __on_success(cls, record_metadata):
        logger.info(
            f"Successfully sent message: Topic-{record_metadata.topic}, Partition-{record_metadata.partition}, Offset-{record_metadata.offset}"
        )

    @classmethod
    def __on_error(cls, record_metadata):
        logger.exception(
            f"Failed to send message: Topic-{record_metadata.topic}, Partition-{record_metadata.partition}, Offset-{record_metadata.offset}"
        )

    def __send_data(self, topic: str, data: pd.DataFrame, partition: int = None):
        """
        Send data in chunks to a specified Kafka topic.

        Args:
            topic: Kafka topic to send the data to.
            data: Pandas DataFrame containing the data to send.
            partition: Optional partition to which the message should be sent.
        """
        data.to_csv("message_broker_data.csv", index=False)
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

        chunks = int(len(data) / 50)
        chunks = chunks if chunks > 0 else 1
        dataframes = np.array_split(data, chunks)
        current_partition = -1
        for dataframe in dataframes:
            dataframe = pd.DataFrame(dataframe).replace(np.nan, None)
            message = {"data": dataframe.to_dict("records")}

            current_partition = (
                partition
                if partition or partition == 0
                else self.__get_partition(current_partition=current_partition)
            )
            kafka_message = json.dumps(message, allow_nan=True).encode("utf-8")

            producer.send(
                topic=topic,
                value=kafka_message,
                partition=current_partition,
            ).add_callback(self.__on_success).add_errback(self.__on_error)

    @staticmethod
    def update_hourly_data_topic(data: pd.DataFrame):
        """
        Update the hourly data topic with additional device metadata,
        including device names, latitude, longitude, and tenant information.

        Args:
            data(pandas.DataFrame): The Pandas DataFrame to update with device metadata.
        """
        devices = AirQoApi().get_devices(tenant=Tenant.ALL)
        devices = pd.DataFrame(devices)
        devices = devices[
            [
                "tenant",
                "device_id",
                "device_number",
                "site_id",
                "latitude",
                "longitude",
            ]
        ]
        devices.rename(
            columns={
                "device_id": "device_name",
                "_id": "device_id",
                "latitude": "device_latitude",
                "longitude": "device_longitude",
            },
            inplace=True,
        )

        data.rename(
            columns={
                "device_id": "device_name",
            },
            inplace=True,
        )

        del data["device_number"]

        data = pd.merge(
            left=data,
            right=devices,
            on=["device_name", "site_id", "tenant"],
            how="left",
        )
        data.rename(
            columns={
                "tenant": "network",
            },
            inplace=True,
        )
        data["tenant"] = str(Tenant.AIRQO)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        MessageBrokerUtils().__send_data(
            topic=configuration.HOURLY_MEASUREMENTS_TOPIC, data=data
        )

    @staticmethod
    def update_hourly_data_topic_(data: pd.DataFrame) -> None:
        """
        Update the hourly data topic with additional device metadata,
        including device names, latitude, longitude, and tenant information.

        Args:
            data (pandas.DataFrame): The Pandas DataFrame to update with device metadata.
        """
        # Fetch and prepare device data
        devices = AirQoApi().get_devices(tenant=Tenant.ALL)
        devices = pd.DataFrame(devices)
        devices = devices[
            [
                "tenant",
                "device_id",
                "device_number",
                "site_id",
                "latitude",
                "longitude",
            ]
        ]

        devices.rename(
            columns={
                "device_id": "device_name",
                "_id": "device_id",
                "latitude": "device_latitude",
                "longitude": "device_longitude",
            },
            inplace=True,
        )

        data.rename(
            columns={
                "device_id": "device_name",
            },
            inplace=True,
        )

        data.drop(columns=["device_number"], inplace=True, errors="ignore")

        data = pd.concat(
            [
                data.set_index(["device_name", "site_id", "tenant"]),
                devices.set_index(["device_name", "site_id", "tenant"]),
            ],
            axis=1,
        ).reset_index()

        data.rename(columns={"tenant": "network"}, inplace=True)
        data["tenant"] = str(Tenant.AIRQO)
        data["timestamp"] = pd.to_datetime(data["timestamp"])
        data["timestamp"] = data["timestamp"].apply(date_to_str)

        MessageBrokerUtils().__send_data(
            topic=configuration.HOURLY_MEASUREMENTS_TOPIC, data=data
        )

    def _generate_chunks(
        self, dataframe_list: List[dict]
    ) -> Generator[List[dict], None, None]:
        """
        Generator that yields chunks of data that fit within the MAX_MESSAGE_SIZE.

        Args:
            dataframe_list: List of dictionaries representing data records.

        yield:
            Chunked data fitting within 1MB size.
        """
        chunk = []
        size = 0
        for row in dataframe_list:
            row_size = sys.getsizeof(json.dumps(row))
            if size + row_size > self.MAX_MESSAGE_SIZE:
                yield chunk
                chunk = []
                size = 0
            chunk.append(row)
            size += row_size

        if chunk:  # yield the last chunk
            yield chunk

    def publish_to_topic(
        self,
        topic: str,
        data: pd.DataFrame,
        partition: int = None,
        column_key: str = None,
    ):
        """
        Publish data to a specified Kafka topic. If `column_key` is provided, each row's
        key will be extracted from the specified column, and the rest of the row data will
        be the message. Otherwise, the data will be split into chunks and published
        across available partitions.

        Args:
            topic: The Kafka topic to publish data to.
            data: The data (as a Pandas DataFrame) to be published.
            partition: Optionally specify the partition to publish to. If None, partitions are handled based on load.
            column_key: Optional column name to be used as the message key. If None, data is chunked and sent without keys.
        """
        producer = KafkaProducer(
            bootstrap_servers="127.0.0.1:9094",
            api_version=(3, 6, 0),
            request_timeout_ms=300000,
            key_serializer=lambda v: json.dumps(v).encode("utf-8"),
            value_serializer=lambda v: json.dumps(v, allow_nan=True).encode("utf-8"),
        )

        logger.info(f"Preparing to publish data to topic: {topic}")
        data.replace(np.nan, None, inplace=True)
        dataframe_list = data.to_dict("records")

        if column_key:
            logger.info(f"Using '{column_key}' as the key for messages")
            for row in dataframe_list:
                key = row.pop(column_key, None)
                if key is None:
                    logger.warning(
                        f"No key found for column '{column_key}' in row: {row}"
                    )
                    continue
                message = json.dumps(row, allow_nan=True)
                message = {key: json.dumps(row, allow_nan=True)}

                partition = self.__get_least_loaded_partition()
                try:
                    producer.send(
                        topic=topic, key=key, value=message, partition=partition
                    ).add_callback(self.__on_success).add_errback(self.__on_error)
                    self.partition_loads[partition] += 1
                except Exception as e:
                    logger.exception(
                        f"Error while sending message to topic {topic} with key {key}: {e}"
                    )
        else:
            logger.info("No key provided, splitting data into chunks and publishing")
            for chunk_data in self._generate_chunks(dataframe_list):
                message = {"data": chunk_data}

                partition = self.__get_least_loaded_partition()
                try:
                    producer.send(
                        topic=topic, value=message, partition=partition
                    ).add_callback(self.__on_success).add_errback(self.__on_error)
                    self.partition_loads[partition] += 1
                except Exception as e:
                    logger.exception(
                        f"Error while sending message to topic {topic}: {e}"
                    )
        producer.flush()

    def consume_from_topic(
        self,
        topic: str,
        group_id: str,
        auto_offset_reset: str = "latest",
        max_messages: Optional[int] = None,
        from_beginning: bool = False,
        offset: Optional[int] = None,
        key_deserializer: Optional[bool] = False,
    ) -> Any:
        """
        Consume messages from a Kafka topic and return them.

        Args:
            topic: The Kafka topic to consume from.
            group_id: The consumer group ID.
            auto_offset_reset: Determines where to start reading when there's no valid offset. Default is 'latest'.
            max_messages: Limit on the number of messages to consume. If None, consume all available messages.
            from_beginning: Whether to start consuming from the beginning of the topic.
            offset: Start consuming from a specific offset if provided.
            key_deserializer: Whether to deserialize the key (e.g., for device_id). Default is False.

        Return:
            A generator that yields consumed messages from the topic. If there are no more messages, a 'No more messages' flag is returned.
        """
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers="127.0.0.1:9094",
            auto_offset_reset=auto_offset_reset,
            enable_auto_commit=True,
            group_id=group_id,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
            key_deserializer=(
                lambda x: x.decode("utf-8") if key_deserializer else None
            ),
        )

        logger.info(f"Starting to consume messages from topic: {topic}")

        # Wait for partition assignment
        # import time
        # max_attempts = 10
        # attempts = 0
        # while not consumer.assignment() and attempts < max_attempts:
        #     logger.info(f"Waiting for partition assignment... attempt {attempts + 1}")
        #     consumer.poll(timeout_ms=100)  # This triggers partition assignment
        #     time.sleep(1)  # Add a short sleep to avoid busy waiting
        #     attempts += 1

        # if not consumer.assignment():
        #     logger.error("Failed to assign partitions after several attempts.")
        # else:
        #     logger.info(f"Partitions assigned: {consumer.assignment()}")

        # if from_beginning:
        #     consumer.seek_to_beginning()

        if offset is not None:
            for partition in consumer.assignment():
                consumer.seek(partition, offset)

        message_count = 0

        try:
            for message in consumer:
                key = message.key
                value = message.value

                logger.info(
                    f"Consumed message from topic {message.topic}, "
                    f"partition {message.partition}, offset {message.offset}, key: {key}"
                )

                yield {"key": key, "value": value}

                message_count += 1

                # If a max message limit is set, stop when it's reached
                if max_messages and message_count >= max_messages:
                    logger.info(f"Reached max message limit: {max_messages}")
                    break
        except Exception as e:
            logger.error(f"Error while consuming messages from topic {topic}: {e}")
        finally:
            consumer.close()
            logger.info(f"No more messages to consume from topic: {topic}")
            yield {"no_more_messages": True}
