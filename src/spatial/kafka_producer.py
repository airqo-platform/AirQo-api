from confluent_kafka import Producer
from configure import Config
import json
import os

# Load environment variables (if you're using them)
KAFKA_BROKER = Config.KAFKA_BROKER 

# Set up Kafka producer configuration
conf = {
    'bootstrap.servers': KAFKA_BROKER,
    'linger.ms': 5  # Delay before sending messages to allow batching
}

# Create a Kafka producer

# Initialize the producer
producer = Producer(conf)
# Delivery callback to confirm message delivery
def delivery_callback(err, msg):
    if err:
        print(f"Message failed delivery: {err}")
    else:
        print(f"Message delivered to {msg.topic()} [{msg.partition()}]")

def produce_kafka_sensor_categories(data, topic=None):
    """ Sends data to the specified Kafka topic as a message """
    try:
        message = json.dumps(data)
        topic = topic or os.getenv("KAFKA_TOPIC", "sensor_categories")  # Default topic if none is provided
        producer.produce(topic, message.encode('utf-8'), callback=delivery_callback)
        producer.flush()  # Wait for any outstanding messages to be delivered
        print(f"Produced message to topic '{topic}': {message}")
    except Exception as e:
        print(f"Failed to produce message: {e}")
