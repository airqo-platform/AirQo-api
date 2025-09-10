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

stream_old_data_doc = """
### Stream-Old-Data ETL
#### Purpose
Streams old/historical measurements from biqquery to the events api.
This flow can be updated depending on type of data to stream.
Ensure to manually apply start and end dates for the data required.
#### Notes
Data sources:
- Bigquery(prod):averaged_data.hourly_device_measurements
Data Destinations:
- API(devices/events):
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

re_calibrate_missing_calibrated_data_doc = """
### Calibrate-missing-calibrated-data ETL
#### Purpose
Re-calibrates old/historical measurements from biqquery.
1. This pipeline checks for missing calibrated data in the averaged data.
2. Checks if raw data is avalible
#### Notes
Data sources:
- Bigquery(prod):averaged_data.merged_uncalibrated_data
- Bigquery(prod):averaged_data.hourly_device_measurements
- Bigquery(prod):raw_data.device_measurements
- Bigquery(prod):raw_data.weather_data
Data Destinations:
- - Bigquery(prod):averaged_data.hourly_device_measurements
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
Extract devices data from the api(or source database) and store it in kafka.
#### Notes
- Imagine you had a many devices(100,000+) and had to extract them each time you were going to query their data.
- This pipeline extracts the data and store it in kafka for easy access to cancel out the repetitive queries.

Data sources:
- API(devices/summary):
Data Destinations:
- Kafka - devices-topic
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

extract_store_devices_data_in_temp_store = """
### AirQo devices daily ETL
#### Purpose
Extract devices data from the api(or source database) and store it in temp storage.
#### Notes
- Imagine you had a many devices(100,000+) and had to extract them each time you were going to query their data.
- This pipeline extracts the data and store it in a temporary storage for easy access to cancel out the repetitive queries.

Data sources:
- API(devices/summary):
Data Destinations:
- GCP Bucket - airflow-xcom-bucket
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

extract_store_sites_data_in_temp_store = """
### AirQo sites daily ETL
#### Purpose
Extract sites data from the api(or source database) and store it in temp storage.
#### Notes
- Imagine you had a many sites(100,000+) and had to extract them each time you were going to query their data.
- This pipeline extracts the data and store it in a temporary storage for easy access to cancel out the repetitive queries.

Data sources:
- API(devices/summary):
Data Destinations:
- GCP Bucket - airflow-xcom-bucket
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

daily_measurements_clean_up_doc = """
### AirQo daily measurements data clean up
#### Purpose
Clean daily devices measurements in bigquery by removing duplicates.
#### Notes


Data sources:
- BigQuery: daily_device_measurements
Data Destinations:
- BigQuery: daily_device_measurements
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

daily_devices_measurements_realtime_doc = """
### AirQo daily measurements data clean up
#### Purpose
Aggregate daily device measurements using hourly devices measurements stored in bigquery
#### Notes


Data sources:
- BigQuery: daily_device_measurements
Data Destinations:
- BigQuery: daily_device_measurements
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

daily_devices_measurements_historical_doc = """
### AirQo daily measurements data clean up - historical
#### Purpose
Aggregate daily device measurements using hourly devices measurements stored in bigquery going back a couple of days.
#### Notes


Data sources:
- BigQuery: daily_device_measurements
Data Destinations:
- BigQuery: daily_device_measurements
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

daily_data_checks_doc = """
### AirQo daily data quality checks
#### Purpose
Run daily data checks and store data in bigquery
#### Notes

Data sources:
- BigQuery: hourly device measurements
Data Destinations:
- BigQuery: data quality tables (staging/production)
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

compute_store_devices_metadata_doc = """
### AirQo Devices Computed Metadata
#### Purpose
Compute and store metadata for devices in BigQuery.

This pipeline computes additional metadata for AirQo devices, such as pollutant statistics (minimum, maximum, average) over a 30-day window, based on recent maintenance or offset dates. The computed metadata is then stored in BigQuery for further analysis and reporting.

#### Notes
- The computation uses the `compute_device_site_metadata` method to process metadata for each device.
- The pipeline is scheduled to run daily to ensure metadata is up-to-date.

#### Data Sources:
- BigQuery: `averaged_data.hourly_device_measurements` (for pollutant data)
- BigQuery: `data_quality.devices_computed_metadata` (for device details and recent readings)

#### Data Destinations:
- BigQuery: `data_quality.devices_computed_metadata` (staging/production)

#### References:
- `compute_device_site_metadata` method in `datautils.py` (#sym:compute_device_site_metadata)
- `compute_store_devices_metadata` DAG in `meta_data.py` (#sym:compute_store_devices_metadata)
"""
