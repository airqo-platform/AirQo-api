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

fetch_fault_detection_raw_data_doc = """
#### Purpose
Fetch recent raw device readings for the fault-detection workflow from BigQuery.
#### Notes
- Uses the dedicated SQL query under `airqo_etl_utils/sql/faultdetection`.
- Uses the configured `FAULT_DETECTION_LOOKBACK_DAYS` window. Default is 14 days.
- Resamples numeric readings to hourly resolution for each device.
"""

fetch_fault_detection_training_data_doc = """
#### Purpose
Fetch historical raw device readings for fault-detection model training from BigQuery.
#### Notes
- Uses the dedicated SQL query under `airqo_etl_utils/sql/faultdetection`.
- Uses the configured `FAULT_DETECTION_TRAINING_LOOKBACK_DAYS` window. Default is 90 days.
- Resamples numeric readings to hourly resolution for each device.
"""

flag_rule_based_faults_doc = """
#### Purpose
Identify rule-based device faults from raw dual-sensor readings.
#### Notes
- Flags low inter-sensor correlation.
- Flags long windows of missing `s1_pm2_5` or `s2_pm2_5` values.
- Flags sustained sensor disagreement between the two PM2.5 channels.
- Flags constant-value runs that suggest stuck sensor readings.
- Flags sustained low-battery behavior.
- Flags persistent out-of-range PM2.5 or battery values.
"""

prepare_pattern_detection_features_doc = """
#### Purpose
Prepare model features for pattern-based fault detection.
#### Notes
- Sorts readings by device and timestamp.
- Builds `sensor_delta`, cyclic time features, and hourly lag/rolling features.
"""

flag_pattern_based_faults_doc = """
#### Purpose
Score pattern-based anomalies for device readings.
#### Notes
- Uses Isolation Forest on numeric fault-detection features.
- Requires a trained model saved by `AirQo-fault-detection-model-training`.
- Loads the trained model from `FAULT_DETECTION_MODELS_BUCKET` using `FAULT_DETECTION_MODEL_PATH`.
- Returns both `anomaly_value` and `anomaly_score`.
"""

train_fault_detection_model_doc = """
#### Purpose
Train and save the fault-detection Isolation Forest model.
#### Notes
- Trains on numeric fault-detection features prepared from historical raw readings.
- Saves the model to `FAULT_DETECTION_MODELS_BUCKET`.
- The scheduled detection DAG loads this model for anomaly scoring.
"""

process_faulty_devices_percentage_doc = """
#### Purpose
Summarize anomaly share per device for the fault-detection workflow.
#### Notes
- Computes anomaly percentage, anomaly count, and observation count.
- Returns devices exceeding the configured anomaly percentage threshold.
- Marks those devices with `anomaly_percentage_fault`.
"""

process_faulty_devices_sequence_doc = """
#### Purpose
Identify devices with long consecutive anomaly runs.
#### Notes
- Evaluates anomaly sequences independently per device.
- Returns devices whose longest anomaly run exceeds the configured threshold.
- Marks those devices with `anomaly_sequence_fault`.
"""

save_faulty_devices_doc = """
#### Purpose
Persist consolidated fault-detection results to MongoDB.
#### Notes
- Merges rule-based and pattern-based fault outputs on `device_id`.
- Stores `fault_types` and `triggered_fault_count` for each flagged device.
- Skips writes when no faulty devices are detected.
"""
