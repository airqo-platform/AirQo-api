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
Identifies and extracts devices with missing calibrated data from BigQuery, initiating the recalibration workflow.

#### Process Flow
1. Determines the date range for analysis (defaults to previous day)
2. Queries BigQuery to identify devices with missing calibrated measurements
3. Returns device information for subsequent data extraction and processing

#### Technical Details
- Uses `DateUtils.get_dag_date_time_values()` for consistent date handling
- Returns DataFrame containing device identifiers and timestamps
- Prepares data for the extract_raw_data task

#### Dependencies
- Requires access to BigQuery tables
- Depends on AirQoDataUtils for device data extraction
- Integrates with DateUtils for timestamp management

#### Output
Returns a DataFrame containing:
- device_id: Unique identifier for each device
- timestamp: Time points where calibrated data is missing
- Additional metadata needed for recalibration

#### Notes
- Critical first step in the recalibration pipeline
- Ensures data completeness for air quality monitoring
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

fetch_site_prediction_data_doc = """
#### Purpose
Fetch site-level daily PM2.5 history for the configured forecast lookback window.
#### Notes
- Reads from the consolidated site data source in BigQuery.
- Includes sparse daily rows so newly deployed sites can still receive forecasts.
"""

generate_site_forecasts_doc = """
#### Purpose
Generate forward site-level daily PM2.5 forecasts from prepared historical site data.
#### Notes
- Uses deployed site forecast artifacts loaded by `ForecastModelTrainer`.
- Produces forecast-only rows before MET.no enrichment is applied.
"""

enrich_site_forecasts_with_met_doc = """
#### Purpose
Attach MET.no weather summaries to generated site daily forecast rows.
#### Notes
- Rounds coordinates into query buckets before fetching weather data.
- Fails the task when MET.no enrichment errors occur.
"""

save_site_forecasts_to_mongodb_doc = """
#### Purpose
Persist site-level daily PM2.5 forecasts to MongoDB.
#### Notes
- Saves the forecast rows before the MET.no update step runs.
"""

resolve_site_forecasts_for_met_updates_doc = """
#### Purpose
Resolve the forecast rows that should be used for the MET.no update step.
#### Notes
- Pulls enriched output from XCom.
- Returns the rows that are safe to write back after enrichment.
"""

update_site_forecasts_met_in_mongodb_doc = """
#### Purpose
Update stored site daily forecasts with MET.no weather fields when enrichment succeeds.
#### Notes
- Skips the update gracefully when MET.no data is unavailable.
"""

fetch_site_hourly_prediction_data_doc = """
#### Purpose
Fetch site-level hourly PM2.5 history for the hourly forecast lookback window.
#### Notes
- Reads from the hourly measurements BigQuery table configured in `.env`.
- Caps the lookback at 14 days.
- Keeps sites with at least 2 hourly measurements so sparse sites still receive forecasts.
"""

generate_site_hourly_forecasts_doc = """
#### Purpose
Generate recursive 10-day hourly site-level PM2.5 forecasts.
#### Notes
- Loads `hourly_10day_pm25_mean_model.pkl`, `hourly_10day_pm25_q10_model.pkl`, and `hourly_10day_pm25_q90_model.pkl` from GCS.
- Produces forecast-only rows before MET.no enrichment is applied.
"""

enrich_site_hourly_forecasts_with_met_doc = """
#### Purpose
Attach hourly MET.no weather forecast fields to generated site hourly PM2.5 forecasts.
#### Notes
- Rounds coordinates into MET.no query buckets.
- Fails the task when MET.no enrichment errors occur so the resolver can keep the already saved PM forecast.
"""

save_site_hourly_forecasts_to_mongodb_doc = """
#### Purpose
Persist site-level hourly PM2.5 forecasts to MongoDB.
#### Notes
- Deletes old hourly forecasts for each incoming site before inserting the new forecast horizon.
- Runs before MET.no enrichment so PM forecasts are still available if the weather API fails.
"""

resolve_site_hourly_forecasts_for_met_updates_doc = """
#### Purpose
Resolve hourly forecast rows that are safe for the MET.no MongoDB update step.
#### Notes
- Pulls enriched output from XCom.
- Returns `None` when no MET.no values were populated.
"""

update_site_hourly_forecasts_met_in_mongodb_doc = """
#### Purpose
Replace stored site hourly forecasts with MET.no-enriched rows when enrichment succeeds.
#### Notes
- Skips gracefully when MET.no data is unavailable.
"""
