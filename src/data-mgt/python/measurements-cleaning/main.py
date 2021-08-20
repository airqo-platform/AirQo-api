from dotenv import load_dotenv

from kafka_client import MeasurementsClient

load_dotenv()

if __name__ == '__main__':
    measurements_client = MeasurementsClient()
    measurements_client.consume_measurements()

