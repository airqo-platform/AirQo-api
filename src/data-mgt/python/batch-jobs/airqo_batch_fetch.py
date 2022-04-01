from datetime import timedelta

import pandas as pd
from google.cloud import bigquery

from config import configuration
from date import str_to_date, date_to_str
from message_broker import BrokerConnector
from utils import build_channel_id_filter, get_valid_devices


class AirQoBatchFetch:
    def __init__(self):
        self.kafka_client = BrokerConnector(bootstrap_servers=configuration.BOOTSTRAP_SERVERS,
                                            output_topic=configuration.OUTPUT_TOPIC)
        self.devices = get_valid_devices(configuration.AIRQO_BASE_URL, "airqo")
        super().__init__()
        
    def begin_fetch(self):
    
        interval = f"{configuration.BATCH_FETCH_TIME_INTERVAL}H"
    
        dates = pd.date_range(configuration.START_TIME, configuration.END_TIME, freq=interval)
    
        for date in dates:
    
            start_time = date_to_str(date)
            end_time = date_to_str(date + timedelta(hours=int(configuration.BATCH_FETCH_TIME_INTERVAL)))
    
            print(start_time + " : " + end_time)
    
            measurements = self.__get_device_data(start_time, end_time)
            self.__transform_measurements(measurements)
    
    def __get_device_data(self, start_time, end_time):
        client = bigquery.Client()
    
        query = """
                 SELECT channel_id, created_at, pm2_5, pm10 , s2_pm2_5,
                  s2_pm10, temperature , humidity, voltage, altitude, latitude, longitude, no_sats, hdope, wind 
                  FROM airqo-250220.thingspeak.clean_feeds_pms where ({0}) 
                  AND created_at BETWEEN '{1}' AND '{2}'
                    """.format(build_channel_id_filter(self.devices), str_to_date(start_time), str_to_date(end_time))
    
        dataframe = (
            client.query(query).result().to_dataframe()
        )
    
        return dataframe

    def __transform_measurements(self, data):
    
        for device in self.devices:
            transformed_data = []
            device = dict(device)
            device_data = data.loc[data['channel_id'] == int(device.get("device_number", "0"))]
    
            for index, device_row in device_data.iterrows():
                device_data = dict({
                    "device": f'{device.get("name", "")}',
                    "channelID": f'{device_row["channel_id"]}',
                    "latitude": f'{device_row["latitude"]}',
                    "longitude": f'{device_row["longitude"]}',
                    "frequency": "raw",
                    "created_at": f'{pd.Timestamp(device_row["created_at"]).isoformat()}Z',
                    "pm2_5": f'{device_row["pm2_5"]}',
                    "pm10": f'{device_row["pm10"]}',
                    "s2_pm2_5": f'{device_row["s2_pm2_5"]}',
                    "s2_pm10": f'{device_row["s2_pm10"]}',
                    "battery": f'{device_row["voltage"]}',
                    "altitude": f'{device_row["altitude"]}',
                    "speed": f'{device_row["wind"]}',
                    "satellites": f'{device_row["no_sats"]}',
                    "hdop": f'{device_row["hdope"]}',
                    "internalTemperature": f'{device_row["temperature"]}',
                    "internalHumidity": f'{device_row["humidity"]}',
                })
    
                transformed_data.append(device_data)
    
            if transformed_data:
                self.kafka_client.produce(transformed_data)
