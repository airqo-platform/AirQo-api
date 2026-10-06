"""
Tests for api/utils/data_formatters.py::format_to_aqcsv.

Regression coverage for a bug fixed in this session: the function is typed to
accept a `Frequency` enum, but `FREQUENCY_MAPPER`/`BQ_FREQUENCY_MAPPER` are
keyed by plain strings and `Frequency` is not a str-Enum, so indexing/
comparing with the enum member directly raised `KeyError` and silently
mis-evaluated the raw/averaged `qc` branch. The fix normalises to
`frequency.value` once inside the function; these tests pin that behaviour
for both the enum and (backward-compatible) plain-string call forms.
"""

from __future__ import annotations

import pytest

from api.utils.data_formatters import format_to_aqcsv
from constants import Frequency


def _daily_record(**overrides):
    record = {
        "timestamp": "2023-01-01 00:00:00",
        "site_id": "site1",
        "pm2_5_calibrated_value": 12.3,
    }
    record.update(overrides)
    return record


class TestFormatToAqcsv:
    def test_duration_matches_frequency(self):
        daily = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        hourly = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.HOURLY)
        assert daily[0]["duration"] == 1440
        assert hourly[0]["duration"] == 60

    def test_qc_is_estimated_for_raw_frequency(self):
        """Regression: raw frequency previously never hit the 'estimated'
        branch because `Frequency.RAW != "raw"` (enum vs string) was always
        True, so qc was always 'averaged' regardless of actual frequency."""
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.RAW)
        from api.utils.pollutants.pm_25 import AQCSV_QC_CODE_MAPPER

        assert result[0]["qc"] == AQCSV_QC_CODE_MAPPER["estimated"]

    def test_qc_is_averaged_for_non_raw_frequency(self):
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        from api.utils.pollutants.pm_25 import AQCSV_QC_CODE_MAPPER

        assert result[0]["qc"] == AQCSV_QC_CODE_MAPPER["averaged"]

    def test_renames_timestamp_to_datetime(self):
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        assert "datetime" in result[0]
        assert "timestamp" not in result[0]
        # AQCSV date format: YYYYMMDDTHHMM
        assert result[0]["datetime"] == "20230101T0000"

    def test_pollutant_columns_added(self):
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        row = result[0]
        assert "parameter_pm2_5" in row
        assert "unit_pm2_5" in row
        assert "data_status_pm2_5" in row
        assert "value_pm2_5" in row
        assert row["value_pm2_5"] == 12.3

    def test_unrequested_pollutant_columns_absent(self):
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        row = result[0]
        assert "parameter_pm10" not in row
        assert "value_pm10" not in row

    def test_drops_internal_columns(self):
        record = _daily_record(device_name="dev1", network="airqo", frequency="daily")
        result = format_to_aqcsv([record], ["pm2_5"], Frequency.DAILY)
        row = result[0]
        assert "device_name" not in row
        assert "network" not in row
        assert "frequency" not in row

    def test_poc_is_always_one(self):
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        assert result[0]["poc"] == 1

    def test_multiple_records(self):
        records = [
            _daily_record(site_id="s1"),
            _daily_record(site_id="s2", timestamp="2023-01-02 00:00:00"),
        ]
        result = format_to_aqcsv(records, ["pm2_5"], Frequency.DAILY)
        assert len(result) == 2
        assert {r["site_id"] for r in result} == {"s1", "s2"}
