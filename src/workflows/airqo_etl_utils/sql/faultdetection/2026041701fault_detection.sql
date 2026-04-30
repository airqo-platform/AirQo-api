-- name: fault_detection_raw_device_readings
-- Hourly sensor readings for fault detection from the configured lookback window.
-- Placeholders:
-- raw_measurements_table -> fully-qualified raw events table (project.dataset.table)
-- lookback_days -> number of recent days to evaluate for fault detection
-- minimum_hourly_records -> minimum records required for selected devices
-- device_limit_clause -> optional random device sampling clause

WITH filtered_readings AS (
    SELECT
        t.timestamp,
        t.device_id,
        t.latitude,
        t.longitude,
        t.s1_pm2_5,
        t.s2_pm2_5,
        t.pm2_5,
        t.battery
    FROM `{raw_measurements_table}` AS t
    WHERE DATE(t.timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL {lookback_days} DAY)
        AND t.device_id IS NOT NULL
),
selected_devices AS (
    SELECT device_id
    FROM filtered_readings
    GROUP BY device_id
    HAVING COUNT(*) >= {minimum_hourly_records}
    {device_limit_clause}
)
SELECT
    TIMESTAMP_TRUNC(t.timestamp, HOUR) AS timestamp,
    t.device_id AS device_id,
    AVG(t.latitude) AS latitude,
    AVG(t.longitude) AS longitude,
    AVG(t.s1_pm2_5) AS s1_pm2_5,
    AVG(t.s2_pm2_5) AS s2_pm2_5,
    AVG(t.pm2_5) AS pm2_5,
    AVG(t.battery) AS battery
FROM filtered_readings AS t
INNER JOIN selected_devices AS d USING (device_id)
GROUP BY t.device_id, TIMESTAMP_TRUNC(t.timestamp, HOUR)
ORDER BY device_id, timestamp
