# TODO: Needs to be improved
airqo_realtime_low_cost_measurements_doc = """
### AirQo low cost sensors hourly ETL
#### Purpose
Streams and calibrates measurements for AirQo low cost sensors on an hourly frequency.
#### Notes
Data sources:
    API(devices/):
    ThingSpeak(device measurements):
    # TODO Soon to change to OpenWeatherApi
    Tahmo(Weather data):
Data Destinations:
    Bigquery(stage):averaged_data_stage.hourly_device_measurements
    Bigquery(prod):averaged_data.hourly_device_measurements
    Bigquery(stage):raw_data_stage.device_measurements
    Bigquery(prod):raw_data.device_measurements
    API(devices/events):
    Kafka(hourly-measurements-topic):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

airqo_historical_hourly_measurements_doc = """
### AirQo historical hourly recalibration ETL
#### Purpose
Re-calibrates measurements for AirQo sensors once a day if for any reason this did not happen.
#### Notes
Data sources:
    Bigquery:raw_data.device_measurements
    Bigquery:averaged_data.hourly_weather_data
Data Destinations:
    Bigquery(stage):averaged_data_stage.hourly_device_measurements
    Bigquery(prod):averaged_data.hourly_device_measurements
    API(devices/events):
    Kafka(hourly-measurements-topic):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

airqo_gaseous_realtime_low_cost_data_doc = """
### AirQo Gaseous low cost sensors hourly ETL
#### Purpose
Streams measurements for AirQo Gaseous low cost sensors on an hourly frequency.
#### Notes
Data sources:
    API(devices/):
    ThingSpeak:
Data Destinations:
    Bigquery raw_data.gaseous_measurements
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""
