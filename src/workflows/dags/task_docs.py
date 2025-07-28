# TODO: ALso needs to be improved
extract_raw_airqo_data_doc = """
#### Purpose
Extract low cost data from ThingSpeak
#### Notes
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

extract_raw_airqo_gaseous_data_doc = """
###Purpose
Extract gaseous low cost data from ThingSpeak
####Notes

"""

clean_data_raw_data_doc = """
###Purpose
Clean raw lowcost(LowCost, Mobile) sensor data.
####Notes

"""

send_raw_measurements_to_bigquery_doc = """
###Purpose
Send the clean raw data measurements to Big Query
####Notes

"""

extract_historical_device_measurements_doc = """
#### Purpose
Extracts raw data from bigquery using a dynamic query that averages and groups data by `device_number`, `device_id`, `site_id`, `network` as well as the hourly time granuality.
#### Notes
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

extract_hourly_old_historical_data_doc = """
#### Purpose
Extracts hourly averaged data from BigQuery for a specified time window.

- This task function retrieves the start and end date-times from the Airflow parameters, then uses an Airflow Variable to obtain the last processed timestamp (defaulting to the start date if not set).
- It computes the current hourly window by converting the retrieved timestamp into a start and end string, with the end time representing the last second of the hour. If the computed hour exceeds the specified end date, an AirflowFailException is raised to halt further processing.

#### Notes
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""
extract_devices_missing_calibrated_data_doc = """
#### Purpose
Extracts devices that are missing calibrated data from bigquery

- This is in preparation to extract, merge and re-calibrate missed air quality and weather data..
#### Notes
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""
