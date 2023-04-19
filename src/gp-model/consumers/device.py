from kafka import KafkaConsumer
import json


TOPIC_NAME = 'device-topic'
KAFKA_SERVER = '35.205.100.8:30200,34.79.29.10:30200,35.205.61.109:30200'
airqloud_consumer = KafkaConsumer(TOPIC_NAME, bootstrap_servers=KAFKA_SERVER,
                            auto_offset_reset='earliest')