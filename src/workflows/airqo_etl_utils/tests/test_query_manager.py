import pytest
from airqo_etl_utils.sql.query_manager import QueryManager


MERGED_SQL = """-- name: merged_hourly
SELECT
    country, city, latitude, longitude, pm2_5, pm10, timestamp
FROM {sat_table}
WHERE timestamp BETWEEN TIMESTAMP('{start_date}') AND TIMESTAMP('{end_date}')
AND ST_DWithin(ST_GEOGPOINT(0,0), ST_GEOGPOINT(longitude, latitude), {distance_meters})
"""

SITE_DAILY_SQL = """-- name: site_daily_aggregated
WITH site_daily AS (
    SELECT
        DATE(timestamp) AS day,
        site_id,
        ANY_VALUE(site_name) AS site_name,
        AVG(pm2_5_calibrated_value) AS pm25_mean,
        COUNT(DISTINCT TIMESTAMP_TRUNC(timestamp, HOUR)) AS n_hours
    FROM {consolidated_table}
    WHERE DATE(timestamp) BETWEEN DATE('{start_date}') AND DATE('{end_date}')
        AND pm2_5_calibrated_value IS NOT NULL
    GROUP BY day, site_id
    HAVING n_hours >= {min_hours}
)
SELECT * FROM site_daily;
"""


def _write_sql(path, name, text):
    p = path / name
    p.write_text(text, encoding="utf-8")
    return p


def test_list_queries_contains_expected(tmp_path):
    _write_sql(tmp_path, "merged_hourly.sql", MERGED_SQL)
    _write_sql(tmp_path, "site_daily_aggregated.sql", SITE_DAILY_SQL)
    qm = QueryManager(base_dir=tmp_path)
    qs = qm.list_queries()
    assert "merged_hourly" in qs
    assert "site_daily_aggregated" in qs


def test_placeholders_detected(tmp_path):
    _write_sql(tmp_path, "merged_hourly.sql", MERGED_SQL)
    _write_sql(tmp_path, "site_daily_aggregated.sql", SITE_DAILY_SQL)
    qm = QueryManager(base_dir=tmp_path)

    q = qm.get_query("merged_hourly")
    expected = {"sat_table", "start_date", "end_date", "distance_meters"}
    assert expected.issubset(q.placeholders)

    q2 = qm.get_query("site_daily_aggregated")
    expected2 = {"consolidated_table", "start_date", "end_date", "min_hours"}
    assert expected2.issubset(q2.placeholders)


def test_format_raises_on_missing_placeholders(tmp_path):
    _write_sql(tmp_path, "site_daily_aggregated.sql", SITE_DAILY_SQL)
    qm = QueryManager(base_dir=tmp_path)
    q = qm.get_query("site_daily_aggregated")
    with pytest.raises(KeyError):
        q.format(start_date="2025-01-01")
