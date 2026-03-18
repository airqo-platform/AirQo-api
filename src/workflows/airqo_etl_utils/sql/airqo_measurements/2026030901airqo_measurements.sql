-- name: devices_hourly_data
-- Hourly calibrated and raw PM2.5 measurements for all devices from a given date onward.
-- Placeholders:
-- {hourly_measurements_table} -> fully-qualified hourly events table (project.dataset.table)
-- {day} -> start date string (YYYY-MM-DD); data from this date onward is included

SELECT DISTINCT
    m.pm2_5_calibrated_value,
    m.pm2_5_raw_value,
    m.site_id,
    m.device_id AS device,
    FORMAT_DATETIME('%Y-%m-%d %H:%M:%S', m.timestamp) AS timestamp
FROM {hourly_measurements_table} AS m
WHERE DATE(m.timestamp) >= '{day}'
  AND m.pm2_5_raw_value IS NOT NULL

-- name: raw_device_readings
-- Raw sensor readings for all devices from the last 21 days.
-- Placeholders:
-- {raw_measurements_table} -> fully-qualified raw events table (project.dataset.table)

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
WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL 21 DAY)
ORDER BY device_id, timestamp
