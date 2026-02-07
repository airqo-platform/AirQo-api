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
### Re-calibrate Missing Calibrated Data Pipeline
#### Purpose
Automatically identifies, processes, and recalibrates missing air quality measurements by combining raw sensor data with weather data, ensuring data completeness and accuracy in the monitoring network.

#### Workflow Steps
1. **Device Identification** (`extract_devices_missing_calibrated_data`)
   - Identifies devices with missing calibrated data
   - Queries the previous day's data by default
   - Returns device and timestamp information

2. **Raw Data Extraction** (`extract_raw_data`)
   - Retrieves raw sensor measurements for identified devices
   - Returns data along with time range information
   - Uses multiple_outputs for efficient data passing

3. **Data Cleaning** (`clean_data_raw_data`)
   - Cleans raw low-cost sensor data
   - Applies device category and frequency-specific processing
   - Prepares data for aggregation

4. **Data Aggregation** (`aggregate`)
   - Aggregates cleaned sensor data
   - Optimizes data for weather merging
   - Implements low-cost sensor aggregation logic

5. **Weather Data Integration** (`extract_hourly_weather_data`)
   - Fetches corresponding weather data
   - Matches the time range of sensor data
   - Ensures temporal alignment

6. **Data Merging** (`merge_data`)
   - Combines aggregated sensor data with weather data
   - Creates comprehensive dataset for calibration
   - Preserves data relationships

7. **Calibration** (`calibrate`)
   - Applies calibration models by country
   - Uses filtered device-specific data
   - Generates final calibrated measurements

8. **Data Distribution**
   - Sends to BigQuery (`send_hourly_measurements_to_bigquery`)
   - Updates raw measurements (`send_raw_measurements_to_bigquery`)
   - Pushes to API endpoints (`send_hourly_measurements_to_api`)

#### Schedule
Runs daily at midnight (0 0 * * *)

#### Configuration
- Uses LOWCOST device category
- Processes hourly frequency data
- Integrates with multiple data sources (BigQuery, API)

#### Dependencies
- BigQuery access for data storage/retrieval
- Weather data service availability
- API endpoints for data distribution

#### Notes
- Ensures data quality through multi-step validation
- Maintains data consistency across platforms
- Critical for accurate air quality monitoring
- <a href="https://airqo.africa/" target="_blank">AirQo</a>

#### Performance Optimizations (October 2025)
- **Algorithm Optimization**: Reduced data extraction complexity from O(n×m×k) to O(n) using single batch operations
- **Execution Performance**: ~30 seconds processing time with optimal memory footprint
- **Batch Processing**: Single API call instead of nested loops for device data extraction

#### Notes
Data sources:
- Bigquery(prod): Device info
- ThingSpeak: device measurements
- Bigquery(prod):raw_data.weather_data
Data Destinations:
- Bigquery(prod):averaged_data.hourly_device_measurements
- Bigquery(prod):raw_data.hourly_device_measurements
- API(devices/events): Processed calibrated measurements
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

compute_store_devices_baseline_doc = """
### AirQo Devices Computed Baselines
#### Purpose
Compute and store baseline statistics for AirQo devices in BigQuery.

This pipeline computes baseline metrics (e.g., quantiles, ECDF bins, mean, standard deviation) for device pollutants over a specified time window (e.g., weekly). It uses historical data to establish baselines for data drift detection, quality checks, and anomaly monitoring. The computed baselines are stored in BigQuery for ongoing analysis and alerting.

#### Notes
- The computation uses the `compute_device_site_baseline` method to process baselines for each device in parallel using ThreadPoolExecutor.
- The pipeline is scheduled to run daily at midnight to update baselines regularly.
- Baselines are computed only if sufficient data is available (e.g., meeting minimum sample counts and coverage thresholds).
- Exceptions in individual device computations are logged but do not halt the entire pipeline.

#### Data Sources:
- BigQuery: `averaged_data.hourly_device_measurements` (for historical pollutant data)
- BigQuery: `data_quality.devices_computed_metadata` (for device details and recent maintenance dates)

#### Data Destinations:
- BigQuery: `data_quality.measurements_baseline` (staging/production, with fields like quantiles, ecdf_bins, mean, etc.)

#### References:
- `compute_device_site_baseline` method in `meta_data_utils.py` (#sym:compute_device_site_baseline)
- `compute_store_devices_baseline` DAG in `meta_data.py` (#sym:compute_store_devices_baseline)
- Baseline schema in `measurements_baseline.json` (#sym:measurements_baseline.json)
"""

airqo_api_missing_temp_measurements_fix_doc = """
### AirQo API Missing Measurements Temporary Fix ETL
#### Purpose
Temporary recovery pipeline to identify and backfill missing measurements in the AirQo API by fetching calibrated data from BigQuery and republishing to the API endpoint.

#### Workflow Steps
1. **Device Identification** (`extract_device`)
   - Identifies devices with missing measurements in the API
   - Uses AirQoDataUtils.extract_devices_with_missing_measurements_api()
   - Returns DataFrame of affected devices

2. **Data Retrieval** (`extract_data`)
   - Fetches calibrated measurements from BigQuery
   - Looks back 5 hours from execution time
   - Filters data specifically for affected devices
   - Raises AirflowFailException if no devices need fixing

3. **API Republishing** (`send_data_to_api`)
   - Processes data into API-compatible format
   - Sends measurements to API events endpoint
   - Skips empty datasets to prevent errors

#### Schedule
Runs every 40 minutes (*/40 * * * *)

#### Configuration
- Device Category: LOWCOST
- Data Type: AVERAGED
- Frequency: HOURLY
- Lookback Period: 5 hours

#### Data Flow
Sources:
- BigQuery: averaged_data.hourly_device_measurements
- Device Registry API

Destinations:
- AirQo API events endpoint

#### Notes
- Temporary solution for device registry data inconsistencies
- Uses existing calibrated data from BigQuery
- Provides rapid recovery for API data gaps
- Maintains data consistency across platforms
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""

satellite_data_location_approximations_doc = """
### Satellite Data Location Approximations ETL
#### Purpose
Approximates satellite data locations for air quality measurements.
#### Workflow Steps
1. **Approximate Locations** (`approximate_locations`)
   - Calculates the previous hour's time range.
   - Calls `approximate_satellite_data_locations_for_airquality_measurements` to get approximation data.
2. **Load to BigQuery** (`load_to_bigquery`)
   - Uses a configured storage adapter to load the approximated data into BigQuery.
#### Schedule
Runs every hour at the 20th minute (20 * * * *)
#### Notes
Data sources:
- Satellite Data (internal processing)
Data Destinations:
- BigQuery: `Config.BIGQUERY_SATELLITE_DATA_CLEANED_MERGED_TABLE`
- <a href="https://airqo.africa/" target="_blank">AirQo</a>
"""
