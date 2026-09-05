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

from api.utils.data_formatters import format_to_aqcsv, get_validated_filter
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
    def test_empty_input_returns_empty_list(self):
        assert format_to_aqcsv([], ["pm2_5"], Frequency.DAILY) == []

    def test_accepts_frequency_enum_without_raising(self):
        """Regression: previously raised KeyError for any Frequency enum."""
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], Frequency.DAILY)
        assert len(result) == 1

    def test_accepts_plain_string_frequency(self):
        """Backward-compatible: a plain string frequency must still work."""
        result = format_to_aqcsv([_daily_record()], ["pm2_5"], "daily")
        assert len(result) == 1

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

    def test_site_latitude_longitude_renamed(self):
        record = _daily_record(site_latitude=0.31, site_longitude=32.58)
        result = format_to_aqcsv([record], ["pm2_5"], Frequency.DAILY)
        row = result[0]
        assert row["lat"] == 0.31
        assert row["lon"] == 32.58

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


class TestGetValidatedFilter:
    """
    Regression coverage: valid_filters previously only listed
    "sites"/"device_ids"/"device_names", so an unrecognised-filter request hit
    `provided_filters[0]` on an empty list, raising an unhandled IndexError
    instead of the intended validation error. "grid_ids" is a newly added filter
    type that needs the same recognition.

    Note: Assurance of exactly one filter is provided is enforced by the request schema, so
          this function only needs to validate that the provided filter is recognized and return it.
    """

    def test_sites_recognized(self):
        filter_type, filter_value = get_validated_filter({"sites": ["s1"]})
        assert filter_type == "sites"
        assert filter_value == ["s1"]

    def test_device_ids_recognized(self):
        filter_type, filter_value = get_validated_filter({"device_ids": ["d1"]})
        assert filter_type == "device_ids"
        assert filter_value == ["d1"]

    def test_no_recognized_filter_returns_error_not_valueerror(self):
        """Indexing an empty provided_filters list raised IndexError, which
        surfaced as a 500 instead of the intended 400."""
        filter_type, filter_value = get_validated_filter({"unknown": ["x"]})
        assert filter_type is None
        assert filter_value == []

    def test_grid_recognized(self):
        filter_type, filter_value = get_validated_filter({"grid_ids": ["g1", "g2"]})
        assert filter_type == "grid_ids"
        assert filter_value == ["g1", "g2"]

    def test_cohort_recognized(self):
        filter_type, filter_value = get_validated_filter({"cohort_ids": ["c1", "c2"]})
        assert filter_type == "cohort_ids"
        assert filter_value == ["c1", "c2"]

    def test_multiple_filters_resolve_by_precedence(self):
        """The request schema enforces exactly one filter, so this input is
        unreachable through the API — but _FILTER_KEYS was once a set, which
        made the [0] pick vary between runs for a caller that bypassed the
        schema. The tuple pins the documented precedence: sites first."""
        filter_type, filter_value = get_validated_filter(
            {"cohort_ids": ["c1"], "device_ids": ["d1"], "sites": ["s1"]}
        )
        assert filter_type == "sites"
        assert filter_value == ["s1"]
