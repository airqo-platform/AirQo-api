-- name: device_missing_data_by_qualifier
-- Finds device-timestamp pairs where data exists but all qualifier fields are NULL,
-- indicating missing/incomplete records for a given date.
-- Placeholders:
-- {table}           -> fully-qualified data table (project.dataset.table)
-- {date}            -> target date string (YYYY-MM-DD)
-- {qualifier_query} -> SQL fragment built from qualifier fields, e.g. "field1 IS NULL AND field2 IS NULL"
-- {network}         -> network identifier string (e.g. 'airqo')

WITH timestamp_hours AS (
    SELECT TIMESTAMP_TRUNC('{date}', HOUR) + INTERVAL n HOUR AS timestamp
    FROM UNNEST(GENERATE_ARRAY(0, 23)) AS n
),
device_data AS (
    SELECT device_id, TIMESTAMP_TRUNC(timestamp, HOUR) AS timestamp
    FROM {table}
    WHERE
        TIMESTAMP_TRUNC(timestamp, DAY) = '{date}'
        AND {qualifier_query}
        AND network = '{network}'
)
SELECT
    dd.device_id,
    dt.timestamp
FROM device_data dd
LEFT JOIN timestamp_hours dt ON dd.timestamp = dt.timestamp
ORDER BY dt.timestamp, dd.device_id

-- name: devices_with_missing_data
-- Identifies device-hour combinations that are entirely absent for a given period,
-- by comparing all expected device-hour pairs against actual complete records.
-- Placeholders:
-- {table}           -> fully-qualified data table (project.dataset.table)
-- {devices_table}   -> fully-qualified devices metadata table (project.dataset.table)
-- {start_date}      -> period start as a timestamp string (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
-- {n_hours}         -> number of hours to cover from start_date (INT, default 24 = one full day)
-- {qualifier_query} -> SQL fragment for qualifying complete records, e.g. "field1 IS NULL OR field2 IS NULL"
-- {network}         -> network identifier string (e.g. 'airqo')

WITH timestamp_hours AS (
    SELECT TIMESTAMP_TRUNC(TIMESTAMP('{start_date}'), HOUR) + INTERVAL n HOUR AS timestamp
    FROM UNNEST(GENERATE_ARRAY(0, {n_hours} - 1)) AS n
),
deployed_devices AS (
    SELECT DISTINCT device_id
    FROM {devices_table}
    WHERE network = '{network}'
      AND deployed = TRUE
      AND device_id IS NOT NULL
),
expected_data_points AS (
    SELECT
        dd.device_id,
        th.timestamp
    FROM deployed_devices dd
    CROSS JOIN timestamp_hours th
),
actual_data AS (
    SELECT
        device_id,
        TIMESTAMP_TRUNC(timestamp, HOUR) AS timestamp
    FROM {table}
    WHERE timestamp >= TIMESTAMP('{start_date}')
      AND timestamp < TIMESTAMP_ADD(TIMESTAMP('{start_date}'), INTERVAL {n_hours} HOUR)
      AND network = '{network}'
      AND ({qualifier_query})
)
SELECT
    edp.device_id,
    edp.timestamp
FROM expected_data_points edp
LEFT JOIN actual_data ad
    ON edp.device_id = ad.device_id
    AND edp.timestamp = ad.timestamp
WHERE ad.device_id IS NULL
ORDER BY edp.device_id, edp.timestamp
