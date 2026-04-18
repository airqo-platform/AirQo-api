-- name: fault_detection_raw_device_readings
-- Raw sensor readings for fault detection from the configured lookback window.
-- Placeholders:
-- {raw_measurements_table} -> fully-qualified raw events table (project.dataset.table)
-- {lookback_days} -> number of recent days to evaluate for fault detection

SELECT DISTINCT
    t.timestamp AS timestamp,
    t.device_id AS device_id,
    t.latitude AS latitude,
    t.longitude AS longitude,
    t.s1_pm2_5 AS s1_pm2_5,
    t.s2_pm2_5 AS s2_pm2_5,
    t.pm2_5 AS pm2_5,
    t.battery AS battery
FROM {raw_measurements_table} AS t
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL {lookback_days} DAY)
ORDER BY device_id, timestamp
