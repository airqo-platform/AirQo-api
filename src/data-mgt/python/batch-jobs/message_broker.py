import json
import os
import traceback

from dotenv import load_dotenv
from kafka import KafkaProducer, KafkaConsumer

load_dotenv()


class BrokerConnector:

    def __init__(self, bootstrap_servers, output_topic):
        self.__bootstrap_servers = bootstrap_servers
        self.__group_id = os.getenv("GROUP_ID")
        self.__output_topic = output_topic
        self.__input_topic = os.getenv("INPUT_TOPIC")

    def produce(self, data):
        try:
            # topic_data = json.dumps(data)
            # print(topic_data)
            producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers, value_serializer=lambda v: json.dumps(v).encode('utf-8'))
            # print(self.__bootstrap_servers)
            # print(self.__output_topic)
            producer.send(self.__output_topic, data)
        except:
            traceback.print_exc()

    def consume(self):
        consumer = KafkaConsumer(self.__input_topic, bootstrap_servers=self.__bootstrap_servers,
                                 group_id=self.__group_id)
        for msg in consumer:
            try:
                msg_value = msg.value.decode('utf8').replace("'", '"')
                print(msg_value)
            except:
                traceback.print_exc()

