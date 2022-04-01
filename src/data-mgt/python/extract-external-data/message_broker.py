import json
import os
import traceback

from dotenv import load_dotenv
from kafka import KafkaProducer, KafkaConsumer
from models import extract as ext

load_dotenv()


class BrokerConnector:

    def __init__(self):
        self.__bootstrap_servers = os.getenv("BOOTSTRAP_SERVERS").split(",")
        self.__group_id = os.getenv("GROUP_ID")
        self.__output_topic = os.getenv("OUTPUT_TOPIC")
        self.__input_topic = os.getenv("INPUT_TOPIC")
        self.__model = ext.Extract()

    def __produce(self, data):
        try:
            print(data)
            producer = KafkaProducer(bootstrap_servers=self.__bootstrap_servers)
            producer.send(self.__output_topic, json.dumps(data).encode('utf-8'))
        except:
            traceback.print_exc()

    def consume(self):
        consumer = KafkaConsumer(self.__input_topic, bootstrap_servers=self.__bootstrap_servers,
                                 group_id=self.__group_id)
        for msg in consumer:
            try:
                msg_value = msg.value.decode('utf8').replace("'", '"')
                values = dict(json.loads(msg_value))
                print(values)

                latitude = float(values.get("latitude", None))
                longitude = float(values.get("longitude", None))

                if not latitude or not longitude:
                    print("latitude or longitude is None")
                    continue

                altitude = self.__model.get_altitude(latitude, longitude)
                aspect = self.__model.get_aspect_270(latitude, longitude)
                landform90 = self.__model.get_landform90(latitude, longitude)
                landform270 = self.__model.get_landform270(latitude, longitude)
                bearing_from_kampala = self.__model.get_bearing_from_kampala(latitude, longitude)
                distance_from_kampala = self.__model.get_distance_from_kampala(latitude, longitude)
                distance_to_closest_road = self.__model.get_distance_to_closest_road(latitude, longitude)
                distance_to_closest_primary_road = self.__model.get_distance_to_closest_primary_road(
                    latitude, longitude)
                distance_to_closest_secondary_road = self.__model.get_distance_to_closest_secondary_road(
                    latitude, longitude)
                distance_to_closest_residential_road = self.__model.get_distance_to_closest_residential_road(
                    latitude, longitude)
                distance_to_closest_tertiary_road = self.__model.get_distance_to_closest_tertiary_road(
                    latitude, longitude)
                distance_to_closest_trunk = self.__model.get_distance_to_closest_trunk(latitude, longitude)
                distance_to_closest_unclassified_road = self.__model.get_distance_to_closest_unclassified_road(
                    latitude, longitude)
                distance_to_closest_motorway = self.__model.get_distance_to_closest_motorway(latitude, longitude)

                data = {
                    "latitude": latitude,
                    "longitude": longitude,
                    "altitude": altitude,
                    "aspect": aspect,
                    "landform90": landform90,
                    "landform270": landform270,
                    "bearing_from_kampala": bearing_from_kampala,
                    "distance_from_kampala": distance_from_kampala,
                    "distance_to_closest_road":distance_to_closest_road,
                    "distance_to_closest_primary_road": distance_to_closest_primary_road,
                    "distance_to_closest_secondary_road": distance_to_closest_secondary_road,
                    "distance_to_closest_residential_road" : distance_to_closest_residential_road,
                    "distance_to_closest_tertiary_road": distance_to_closest_tertiary_road,
                    "distance_to_closest_trunk": distance_to_closest_trunk,
                    "distance_to_closest_unclassified_road": distance_to_closest_unclassified_road,
                    "distance_to_closest_motorway": distance_to_closest_motorway,
                }

                self.__produce(data=data)
            except:
                traceback.print_exc()


def main():
    connector = BrokerConnector()
    connector.consume()


if __name__ == '__main__':
    main()
