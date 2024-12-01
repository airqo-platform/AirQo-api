# TODO: Needs to be improved
airqo_realtime_low_cost_measurements_doc = """
### AirQo low cost sensors hourly ETL
#### Purpose
Streams and calibrates measurements for AirQo low cost sensors on an hourly frequency.
#### Notes
Data sources:
- API(devices/):
- ThingSpeak(device measurements):
- Tahmo(Weather data):
Data Destinations:
- Bigquery(stage):averaged_data_stage.hourly_device_measurements
- Bigquery(prod):averaged_data.hourly_device_measurements
- Bigquery(stage):raw_data_stage.device_measurements
- Bigquery(prod):raw_data.device_measurements
- API(devices/events):
- Kafka(hourly-measurements-topic):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

airqo_historical_hourly_measurements_doc = """
### AirQo historical hourly recalibration ETL
#### Purpose
Re-calibrates measurements for AirQo sensors once a day if for any reason this did not happen.
#### Notes
Data sources:
- Bigquery:raw_data.device_measurements
- Bigquery:averaged_data.hourly_weather_data
Data Destinations:
- Bigquery(prod):averaged_data.hourly_device_measurements
- API(devices/events):
- Kafka(hourly-measurements-topic):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

airqo_historical_raw_low_cost_measurements_doc = """
### AirQo historical raw low cost data ETL
#### Purpose
Extracts historica, raw measurements for low cost sensors going back 2 days.
#### Notes
Data sources:
- Airqo api - devices
- ThingSpeak - Measurements
Data Destinations:
- Bigquery:raw_data.device_measurements
- API(events/measurements):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

airqo_gaseous_realtime_low_cost_data_doc = """
### AirQo Gaseous low cost sensors hourly ETL
#### Purpose
Streams measurements for AirQo Gaseous low cost sensors on an hourly frequency.
#### Notes
Data sources:
- API(devices/):
- ThingSpeak:
Data Destinations:
- Bigquery raw_data.gaseous_measurements
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

extract_store_devices_data_in_kafka = """
### AirQo devices hourly ETL
#### Purpose
Extract devices data from the api(or source database) and store it in bigquery.
#### Notes
- Imagine you had a many devices(100,000+) and had to extract them each time you were going to query their data.
- This pipeline extracts the data and store it in kafka for easy access to cancel out the repeatitive queries.

Data sources:
- API(devices/summary):
Data Destinations:
- Kafka - devices-topic
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""
