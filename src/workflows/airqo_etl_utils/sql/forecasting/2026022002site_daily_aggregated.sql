-- name: consolidated_site_daily_aggregated
-- Daily aggregated site PM2.5 for forecasting
-- Placeholders:
-- {consolidated_table} -> consolidated data table (e.g. project.dataset.table)
-- {start_date} / {end_date} -> date strings (YYYY-MM-DD)
-- {min_hours} -> minimum hourly points per day (INT)

WITH site_daily AS (
  SELECT
    DATE(timestamp) AS day,
    site_id,
    ANY_VALUE(site_name) AS site_name,
    ANY_VALUE(site_latitude) AS latitude,
    ANY_VALUE(site_longitude) AS longitude,
    AVG(pm2_5_calibrated_value) AS pm25_mean,
    MIN(pm2_5_calibrated_value) AS pm25_min,
    MAX(pm2_5_calibrated_value) AS pm25_max,
    COUNT(DISTINCT TIMESTAMP_TRUNC(timestamp, HOUR)) AS n_hours
  FROM {consolidated_table}
  WHERE DATE(timestamp) BETWEEN DATE('{start_date}') AND DATE('{end_date}')
    AND pm2_5_calibrated_value IS NOT NULL
  GROUP BY day, site_id
  HAVING COUNT(DISTINCT TIMESTAMP_TRUNC(timestamp, HOUR)) >= {min_hours}
)
SELECT *
FROM site_daily
ORDER BY day, site_id;


-- name: site_daily_aggregated_for_forecast_jobs
-- Daily aggregated site PM2.5 for site-forecast prediction jobs with site metadata backfill.
-- Placeholders:
-- {consolidated_table} -> consolidated data table (e.g. project.dataset.table)
-- {sites_table} -> sites metadata table (e.g. project.dataset.table)
-- {start_date} / {end_date} -> date strings (YYYY-MM-DD)
-- {min_hours} -> minimum hourly points per day (INT)

SELECT
    DATE(t1.timestamp) AS day,
    t1.site_id,
    ANY_VALUE(COALESCE(t1.site_name, t2.display_name, t2.name, t1.site_id)) AS site_name,
    ANY_VALUE(
        COALESCE(t1.site_latitude, t2.approximate_latitude, t2.latitude)
    ) AS site_latitude,
    ANY_VALUE(
        COALESCE(t1.site_longitude, t2.approximate_longitude, t2.longitude)
    ) AS site_longitude,
    AVG(t1.pm2_5_calibrated_value) AS pm25_mean,
    MIN(t1.pm2_5_calibrated_value) AS pm25_min,
    MAX(t1.pm2_5_calibrated_value) AS pm25_max,
    COUNT(DISTINCT TIMESTAMP_TRUNC(t1.timestamp, HOUR)) AS n_hours
FROM {consolidated_table} AS t1
LEFT JOIN {sites_table} AS t2
    ON t1.site_id = t2.id
WHERE DATE(t1.timestamp) BETWEEN DATE('{start_date}') AND DATE('{end_date}')
    AND t1.site_id IS NOT NULL
    AND t1.pm2_5_calibrated_value IS NOT NULL
GROUP BY day, t1.site_id
HAVING COUNT(DISTINCT TIMESTAMP_TRUNC(t1.timestamp, HOUR)) >= {min_hours}
ORDER BY day, t1.site_id;

-- name: fetches_device_data_satellite_based_job
-- Fetches device data for a satellite-based job from BigQuery.
-- Placeholders:
-- {hourly_measurements_table} -> hourly measurements table (e.g. project.dataset.table)
-- {sites_table} -> sites table (e.g. project.dataset.table)
-- {start_date_time} -> start date-time string (YYYY-MM-DD HH:MM:SS)
-- Cities: ('Kampala', 'Nairobi', 'Kisumu', 'Lagos', 'Accra', 'Bujumbura', 'Yaounde')

SELECT DISTINCT
    TIMESTAMP_TRUNC(t1.timestamp, DAY) AS timestamp,
    t2.city,
    t1.device_id,
    t2.latitude,
    t2.longitude,
    AVG(t1.pm2_5_calibrated_value) AS pm2_5
FROM {hourly_measurements_table} AS t1
INNER JOIN {sites_table} AS t2
    ON t1.site_id = t2.id
WHERE
    t1.timestamp > TIMESTAMP('{start_date_time}')
    AND t2.city IN ('Kampala', 'Nairobi', 'Kisumu', 'Lagos', 'Accra', 'Bujumbura', 'Yaounde')
    AND t1.device_id IS NOT NULL
GROUP BY
    timestamp,
    t1.device_id,
    t2.city,
    t2.latitude,
    t2.longitude
ORDER BY
    t1.device_id,
    timestamp;

-- name: fetches_device_data_satellite_based_job_predict
-- Fetches device data for a satellite-based job from BigQuery (v2).
-- Placeholders:
-- {hourly_measurements_table} -> hourly measurements table (e.g. project.dataset.table)
-- {sites_table} -> sites table (e.g. project.dataset.table)
-- {start_date} -> start date string (YYYY-MM-DD)

SELECT DISTINCT
    t1.timestamp,
    t1.device_id,
    t1.device_number,
    t1.site_id,
    t1.pm2_5_calibrated_value as pm2_5,
    t2.latitude,
    t2.longitude
FROM {hourly_measurements_table} t1
    JOIN {sites_table} t2
    ON t1.site_id = t2.id
WHERE DATE(t1.timestamp) >= DATE('{start_date}')
    AND t1.device_id IS NOT NULL
ORDER BY t1.device_id, t1.timestamp;

-- name: fetches_device_data_satellite_based_job_train
-- Fetches device data for a satellite-based job from BigQuery (v2).
-- Placeholders:
-- {hourly_measurements_table} -> hourly measurements table (e.g. project.dataset.table)
-- {sites_table} -> sites table (e.g. project.dataset.table)
-- {start_date} -> start date string (YYYY-MM-DD)

SELECT DISTINCT
    t1.timestamp,
    t1.device_id,
    t1.device_number,
    t1.pm2_5_calibrated_value as pm2_5,
    t2.latitude,
    t2.longitude
FROM {hourly_measurements_table} t1
    JOIN {sites_table} t2
    ON t1.site_id = t2.id
WHERE DATE(t1.timestamp) >= DATE('{start_date}')
    AND t1.device_id IS NOT NULL
ORDER BY t1.device_id, t1.timestamp;


