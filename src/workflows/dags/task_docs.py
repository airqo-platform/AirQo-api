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
Clean The raw data 
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
