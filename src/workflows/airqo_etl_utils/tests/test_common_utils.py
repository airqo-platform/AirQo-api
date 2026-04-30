"""Tests for Utils.query_dates_array."""

import pytest

from airqo_etl_utils.utils.common_utils import Utils
from airqo_etl_utils.constants import DataSource


class TestQueryDatesArray:
    """12 H freq (AIRQO / THINGSPEAK) cases."""

    def test_less_than_one_freq_period_returns_single_tuple(self):
        # 6 hours < 12 H  →  one tuple spanning the full range
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-01T06:00:00Z"
        )
        assert len(result) == 1
        assert result[0][0] == "2026-01-01T00:00:00Z"
        assert result[0][1] == "2026-01-01T06:00:00Z"

    def test_exactly_one_freq_period_returns_single_tuple(self):
        # 12 hours == freq  →  one tuple
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z"
        )
        assert len(result) == 1
        assert result[0] == ("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")

    def test_18_hours_returns_two_tuples_with_remainder(self):
        # 18 hours  →  [0→12, 12→18]
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-01T18:00:00Z"
        )
        assert len(result) == 2
        assert result[0] == ("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")
        assert result[1] == ("2026-01-01T12:00:00Z", "2026-01-01T18:00:00Z")

    def test_exactly_two_freq_periods_returns_two_equal_tuples(self):
        # 24 hours  →  [0→12, 12→24]
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z"
        )
        assert len(result) == 2
        assert result[0] == ("2026-01-01T00:00:00Z", "2026-01-01T12:00:00Z")
        assert result[1] == ("2026-01-01T12:00:00Z", "2026-01-02T00:00:00Z")

    def test_last_partial_chunk_not_dropped(self):
        # Regression: end falls after last 12 H tick → 4 full + 1 partial chunk
        # 2026-01-01 00:00 → 2026-01-02 23:59:59  (47h59m59s)
        result = Utils.query_dates_array(
            DataSource.AIRQO,
            "2026-01-01T00:00:00Z",
            "2026-01-02T23:59:59Z",
        )
        # Breakpoints: 00:00, 12:00, 00:00 (next day), 12:00, then 23:59:59 appended
        assert len(result) == 4
        starts = [r[0] for r in result]
        ends = [r[1] for r in result]
        assert starts[0] == "2026-01-01T00:00:00Z"
        assert ends[-1] == "2026-01-02T23:59:59Z"
        # Each interior boundary must be shared (end of one == start of next)
        for i in range(len(result) - 1):
            assert result[i][1] == result[i + 1][0]

    def test_consecutive_boundaries_are_contiguous(self):
        # General property: no gaps between successive tuples
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-05T00:00:00Z"
        )
        for i in range(len(result) - 1):
            assert (
                result[i][1] == result[i + 1][0]
            ), f"Gap between tuple {i} and {i+1}: {result[i][1]} != {result[i+1][0]}"
        assert result[0][0] == "2026-01-01T00:00:00Z"
        assert result[-1][1] == "2026-01-05T00:00:00Z"

    def test_24h_freq_bigquery(self):
        # BIGQUERY uses 720 H (30 days); a 15-day range → single tuple
        result = Utils.query_dates_array(
            DataSource.BIGQUERY, "2026-01-01T00:00:00Z", "2026-01-15T00:00:00Z"
        )
        assert len(result) == 1
        assert result[0][0] == "2026-01-01T00:00:00Z"
        assert result[0][1] == "2026-01-15T00:00:00Z"

    def test_72h_freq_purple_air_with_remainder(self):
        # PURPLE_AIR uses 72 H; 5 days = 120 H → [0→72h, 72h→120h]
        result = Utils.query_dates_array(
            DataSource.PURPLE_AIR, "2026-01-01T00:00:00Z", "2026-01-06T00:00:00Z"
        )
        assert len(result) == 2
        assert result[0] == ("2026-01-01T00:00:00Z", "2026-01-04T00:00:00Z")
        assert result[1] == ("2026-01-04T00:00:00Z", "2026-01-06T00:00:00Z")

    def test_24h_custom_frequency(self):
        # Custom range i.e 24 H; 2 day = 48 H → [0→24h, 24h→48h]
        result = Utils.query_dates_array(
            DataSource.THINGSPEAK,
            "2026-01-01T00:00:00Z",
            "2026-01-03T00:00:00Z",
            frequency_="24H",
        )
        assert len(result) == 2
        assert result[0] == ("2026-01-01T00:00:00Z", "2026-01-02T00:00:00Z")
        assert result[1] == ("2026-01-02T00:00:00Z", "2026-01-03T00:00:00Z")

    def test_equal_start_and_end_returns_single_tuple(self):
        result = Utils.query_dates_array(
            DataSource.AIRQO, "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z"
        )
        assert len(result) == 1
        assert result[0][0] == result[0][1]

    def test_invalid_date_raises_value_error(self):
        with pytest.raises(ValueError, match="Invalid date format"):
            Utils.query_dates_array(DataSource.AIRQO, "not-a-date", "2026-01-01")
