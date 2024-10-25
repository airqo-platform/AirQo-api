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
        # Initialize partition loads. Should only be used if you know the partions available.
        # Note: This should be updated in case the number of partions used changes.
        self.partition_loads = {int(p): 0 for p in self.__partitions}
        self.config = {
            "bootstrap.servers": self.__bootstrap_servers,
            "metadata.max.age.ms": 60000,
        }

    def __get_least_loaded_partition(self) -> int:
        """Select the least loaded partition."""
        return min(self.partition_loads, key=self.partition_loads.get)

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
                logger.info(f"Message size: {size}")
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
                "batch.num.messages": 100,
                "batch.size": 10 * 1024 * 1024,
                "retry.backoff.ms": 1000,
                "debug": "msg",
                "linger.ms": 100,
                "message.timeout.ms": 300000,
                "message.max.bytes": 2 * 1024 * 1024,
                "request.timeout.ms": 300000,
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
                key = row.get(column_key, None)
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
        offset: Optional[int] = None,
        wait_time_sec: int = 40,
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
                "fetch.message.max.bytes": 2 * 1024 * 1024,
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
