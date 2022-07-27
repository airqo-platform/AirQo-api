from kafka import KafkaConsumer

from config import configuration
from data_processor import DataProcessor


class KafkaConnector:
    def __init__(self):
        self.bootstrap_servers = configuration.BOOTSTRAP_SERVERS
        self.data_processor = DataProcessor()

    def stream_data(self, topic: str, group_id: str):
        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=group_id,
            enable_auto_commit=False,
            max_poll_interval_ms=300000,
        )
        for msg in consumer:
            self.data_processor.process_purple_air_data(msg)
