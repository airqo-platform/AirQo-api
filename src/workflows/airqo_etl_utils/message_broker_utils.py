import json
import logging
import sys

import numpy as np
import pandas as pd
from confluent_kafka import Producer, Consumer, TopicPartition

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
        # Initialize partition loads
        self.partition_loads = {int(p): 0 for p in self.__partitions}
        self.config = {
            "bootstrap.servers": self.__bootstrap_servers,
            "request.timeout.ms": 300000,
            "metadata.max.age.ms": 60000,
        }

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
        producer = Producer(
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

        data.drop(columns=["device_number"], inplace=True, errors="ignore")

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

        MessageBrokerUtils().publish_to_topic(
            configuration.HOURLY_MEASUREMENTS_TOPIC, data
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

        MessageBrokerUtils().publish_to_topic(
            configuration.HOURLY_MEASUREMENTS_TOPIC, data
        )

    def __on_delivery(self, err, msg):
        """
        Delivery callback for Kafka message send operations.

        Args:
            err: Error information if the message failed delivery, otherwise None.
            msg: The message that was sent.

        Logs:
            Success or failure of the message delivery.
        """
        if err is not None:
            logger.error(f"Message delivery failed: {err}")
        else:
            logger.info(
                f"Message delivered to {msg.topic()} [{msg.partition()}] at offset {msg.offset()}"
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

    def _send_message(
        self, producer: Producer, topic: str, key: Any, message: str, partition=None
    ) -> None:
        """
        Sends a message to the specified Kafka topic using the provided producer.

        Args:
            producer: The Kafka Producer instance used to send the message.
            topic: The Kafka topic to send the message to.
            key: The key of the message (can be None if no key is needed).
            message: The message to send, typically serialized to JSON.
            partition: Optionally specify the partition to send the message to. If None, Kafka will decide the partition.

        Raises:
            Exception: If an error occurs while sending the message, the exception is logged.
        """
        try:
            if partition is not None:
                producer.produce(
                    topic=topic,
                    key=key,
                    value=message,
                    partition=partition,
                    on_delivery=self.__on_delivery,
                )
            else:
                producer.produce(
                    topic=topic, key=key, value=message, on_delivery=self.__on_delivery
                )
                producer.poll(1.0)
        except Exception as e:
            logger.exception(f"Error while sending message to topic {topic}: {e}")

    def publish_to_topic(
        self,
        topic: str,
        data: pd.DataFrame,
        column_key: str = None,
        auto_partition: bool = True,
    ):
        """
        Publishes data to a Kafka topic. If a `column_key` is provided, each row's key will be
        extracted from the specified column, otherwise data is split into chunks and sent without keys.

        Args:
            topic: The Kafka topic to publish data to.
            data: A Pandas DataFrame containing the data to be published.
            column_key: Optional column name to be used as the message key. If None, data is chunked and sent without keys.
            auto_partition: If True, Kafka will automatically select the partition. If False, partitions are selected manually based on load.

        Raises:
            Exception: If an error occurs while sending a message, the exception is logged.
        """
        producer_config = self.config.copy()
        producer_config.update(
            {
                "retries": 5,
                "batch.num.messages": 1000,
                "retry.backoff.ms": 80000,
                "debug": "msg",
                "message.timeout.ms": 300000,
            }
        )
        producer = Producer(producer_config)

        logger.info(f"Preparing to publish data to topic: {topic}")
        data.replace(np.nan, None, inplace=True)
        dataframe_list = data.to_dict("records")
        message_counts = 0
        if column_key:
            logger.info(f"Using '{column_key}' as the key for messages")
            for row in dataframe_list:
                key = row.pop(column_key, None)
                if key is None:
                    logger.warning(
                        f"No key found for column '{column_key}' in row: {row}"
                    )
                    continue
                message = json.dumps(row, allow_nan=True).encode("utf-8")

                selected_partition = (
                    None if auto_partition else self.__get_least_loaded_partition()
                )
                self._send_message(producer, topic, key, message, selected_partition)
                if not auto_partition:
                    self.partition_loads[selected_partition] += 1
                message_counts += 1

        else:
            logger.info("No key provided, splitting data into chunks and publishing")
            for chunk_data in self._generate_chunks(dataframe_list):
                message_counts += len(chunk_data)
                message = json.dumps({"data": chunk_data}).encode("utf-8")

                selected_partition = (
                    None if auto_partition else self.__get_least_loaded_partition()
                )
                self._send_message(producer, topic, None, message, selected_partition)

                if not auto_partition:
                    self.partition_loads[selected_partition] += 1

        logger.info(f"{message_counts} messages have been loaded.")
        producer.flush()

    def consume_from_topic(
        self,
        topic: str,
        group_id: str,
        auto_offset_reset: str = "latest",
        max_messages: Optional[int] = None,
        auto_commit: bool = True,
        from_beginning: bool = False,
        offset: Optional[int] = None,
        wait_time_sec: int = 30,
        streaming: bool = False,
    ) -> Any:
        """
        Consume messages from a Kafka topic and return them.

        Args:
            topic: The Kafka topic to consume from.
            group_id: The consumer group ID.
            auto_offset_reset: Determines where to start reading when there's no valid offset. Default is 'latest'.
            max_messages: Limit on the number of messages to consume. If None, consume all available messages.
            auto_commit: Whether to auto-commit offsets.
            from_beginning: Whether to start consuming from the beginning of the topic.
            offset: Start consuming from a specific offset if provided.
            wait_time_sec: How long to wait for messages (useful for one-time data requests).
            streaming: If True, run as a continuous streaming job.

        Return:
            A generator that yields consumed messages from the topic.
        """

        consumer_config = self.config.copy()
        consumer_config.update(
            {
                "group.id": group_id,
                "auto.offset.reset": auto_offset_reset,
                "enable.auto.commit": "true" if auto_commit else "false",
            }
        )

        consumer = Consumer(consumer_config)
        consumer.subscribe([topic])

        assigned = False
        while not assigned and wait_time_sec > 0:
            logger.info("Waiting for partition assignment...")
            msg = consumer.poll(timeout=1.0)
            if msg is not None and msg.error() is None:
                assigned = True
            wait_time_sec -= 1

        if from_beginning:
            logger.info("Seeking to the beginning of all partitions...")
            partitions = [
                TopicPartition(topic, p.partition, offset=0)
                for p in consumer.assignment()
            ]
            consumer.assign(partitions)
            for partition in partitions:
                consumer.seek(partition)

        if offset is not None:
            logger.info(f"Seeking to offset {offset} for all partitions...")
            partitions = [
                TopicPartition(topic, p.partition, p.offset)
                for p in consumer.assignment()
            ]
            consumer.assign(partitions)

        message_count = 0
        try:
            while streaming or (message_count < max_messages if max_messages else True):
                msg = consumer.poll(timeout=1.0)

                if msg is None:
                    logger.info("No messages in this poll.")
                    if not streaming:
                        break
                    continue

                if msg.error():
                    logger.exception(f"Consumer error: {msg.error()}")
                    continue
                msg_value = msg.value().decode("utf-8")
                yield {
                    "key": msg.key().decode("utf-8"),
                    "value": msg_value,
                } if msg.key() else {"value": msg_value}
                message_count += 1

        except Exception as e:
            logger.exception(f"Error while consuming messages from topic {topic}: {e}")

        finally:
            consumer.close()
            logger.info(
                f"Closed consumer. No more messages to consume from topic: {topic}"
            )
