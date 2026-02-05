-- Merged hourly satellite measurements (air quality + wind)
-- Placeholders:
-- {geo_table} -> metadata table with city locations
-- {sat_table} -> satellite raw events table
-- {start_date} / {end_date} -> date strings (YYYY-MM-DD)
-- {distance_meters} -> search radius in metres

WITH air_quality AS (
  SELECT
    sc.country,
    sc.city,
    sc.latitude AS city_lat,
    sc.longitude AS city_lon,
    rc.pm2_5,
    rc.pm10,
    rc.latitude AS sat_lat,
    rc.longitude AS sat_lon,
    rc.timestamp
  FROM {geo_table} sc
  JOIN {sat_table} rc
    ON ST_DWithin(ST_GEOGPOINT(sc.longitude, sc.latitude), ST_GEOGPOINT(rc.longitude, rc.latitude), {distance_meters})
  WHERE rc.timestamp BETWEEN TIMESTAMP('{start_date}') AND TIMESTAMP('{end_date}')
    AND rc.pm2_5 IS NOT NULL
    AND rc.pm10 IS NOT NULL
),
wind_data AS (
  SELECT
    sc.country,
    sc.city,
    sc.latitude AS city_lat,
    sc.longitude AS city_lon,
    rc.wind_speed,
    rc.wind_direction,
    rc.latitude AS sat_lat,
    rc.longitude AS sat_lon,
    rc.timestamp
  FROM {geo_table} sc
  JOIN {sat_table} rc
    ON ST_DWithin(ST_GEOGPOINT(sc.longitude, sc.latitude), ST_GEOGPOINT(rc.longitude, rc.latitude), {distance_meters})
  WHERE rc.timestamp BETWEEN TIMESTAMP('{start_date}') AND TIMESTAMP('{end_date}')
    AND rc.wind_speed IS NOT NULL
    AND rc.wind_direction IS NOT NULL
),
merged AS (
  SELECT
    COALESCE(aq.country, wd.country) AS country,
    COALESCE(aq.city, wd.city) AS city,
    COALESCE(aq.sat_lat, wd.sat_lat) AS sat_lat,
    COALESCE(aq.sat_lon, wd.sat_lon) AS sat_lon,
    COALESCE(aq.timestamp, wd.timestamp) AS timestamp,
    aq.pm2_5,
    aq.pm10,
    wd.wind_speed,
    wd.wind_direction
  FROM air_quality aq
  FULL OUTER JOIN wind_data wd
    ON aq.country = wd.country
    AND aq.city = wd.city
    AND aq.sat_lat = wd.sat_lat
    AND aq.sat_lon = wd.sat_lon
    AND aq.timestamp = wd.timestamp
)
SELECT
  country,
  city,
  sat_lat AS latitude,
  sat_lon AS longitude,
  TIMESTAMP_TRUNC(timestamp, HOUR) AS timestamp,
  AVG(pm2_5) AS pm2_5,
  AVG(pm10) AS pm10,
  AVG(wind_speed) AS wind_speed,
  AVG(wind_direction) AS wind_direction
FROM merged
GROUP BY country, city, sat_lat, sat_lon, TIMESTAMP_TRUNC(timestamp, HOUR)
ORDER BY timestamp, country, city;
