"""
Tests for Pydantic request and response schema validation.

Focuses on the boundary conditions: what should be accepted, what must be
rejected, and which error messages are produced.  No external I/O required.
"""

from __future__ import annotations

import pytest
from datetime import datetime, timedelta, timezone
from pydantic import ValidationError

from api.schemas.requests import (
    DailyAveragesRequest,
    DataExportRequest,
    DashboardChartRequest,
    DeviceDailyAveragesRequest,
    DeviceExceedancesRequest,
    ExceedancesRequest,
    AirQualityReportRequest,
    MonitoringSiteRequest,
    RawDataExportRequest,
    ScheduledExportRequest,
    Network,
    DeviceCategory,
    Frequency,
    ChartType,
)
from api.schemas.responses import DataExportResponse, DashboardChartResponse


def _past(days: int = 7) -> str:
    return (datetime.now(tz=timezone.utc) - timedelta(days=days)).isoformat()


def _now() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _future(days: int = 1) -> str:
    return (datetime.now(tz=timezone.utc) + timedelta(days=days)).isoformat()


def _span(days: int) -> tuple:
    """Start and end strings exactly ``days`` apart, taken from one instant."""
    end = datetime.now(tz=timezone.utc)
    return (end - timedelta(days=days)).isoformat(), end.isoformat()


BASE = {
    "startDateTime": _past(7),
    "endDateTime": _now(),
    "network": "airqo",
    "device_category": "lowcost",
    "pollutants": ["pm2_5"],
    "sites": ["site1"],
    "frequency": "daily",
}


class TestDataExportRequestValid:
    def test_minimal_valid_request(self):
        req = DataExportRequest(**BASE)
        assert req.network == "airqo"
        assert req.pollutants == ["pm2_5"]
        assert req.sites == ["site1"]

    def test_accepts_device_ids_filter(self):
        payload = {**BASE, "sites": None, "device_ids": ["d1", "d2"]}
        req = DataExportRequest(**payload)
        assert req.device_ids == ["d1", "d2"]

    def test_accepts_device_names_filter(self):
        payload = {**BASE, "sites": None, "device_names": ["sensor-01"]}
        req = DataExportRequest(**payload)
        assert req.device_names == ["sensor-01"]

    def test_accepts_grid_ids_filter(self):
        payload = {**BASE, "sites": None, "grid_ids": ["grid1"]}
        req = DataExportRequest(**payload)
        assert req.grid_ids == ["grid1"]

    def test_accepts_cursor_token(self):
        req = DataExportRequest(**{**BASE, "cursor": "abc123"})
        assert req.cursor == "abc123"

    def test_download_type_csv(self):
        req = DataExportRequest(**{**BASE, "downloadType": "csv"})
        assert req.download_type == "csv"

    def test_output_format_aqcsv(self):
        req = DataExportRequest(**{**BASE, "outputFormat": "aqcsv"})
        assert req.output_format == "aqcsv"

    def test_alias_population(self):
        """camelCase aliases must be accepted on the wire."""
        req = DataExportRequest(
            startDateTime=_past(7),
            endDateTime=_now(),
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1"],
            frequency="daily",
        )
        assert req.start_date_time is not None


class TestDataExportRequestInvalid:
    def test_end_before_start_rejected(self):
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(
                **{**BASE, "startDateTime": _now(), "endDateTime": _past(1)}
            )
        assert "endDateTime must be after startDateTime" in str(exc.value)

    def test_start_in_future_rejected(self):
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(
                **{**BASE, "startDateTime": _future(1), "endDateTime": _future(2)}
            )
        assert "future" in str(exc.value).lower()

    def test_no_filter_rejected(self):
        payload = {**BASE, "sites": None}
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert (
            "exactly one" in str(exc.value).lower()
            or "provide" in str(exc.value).lower()
        )

    def test_two_filters_rejected(self):
        payload = {**BASE, "device_ids": ["d1"]}
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert "only one filter" in str(exc.value).lower()

    def test_oversized_date_range_rejected(self):
        """An unbounded window is a full scan of a partitioned table, billable
        and reachable unauthenticated on v3."""
        from config import settings

        payload = {
            **BASE,
            "startDateTime": _past(settings.max_query_days + 10),
            "endDateTime": _now(),
        }
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert "must not exceed" in str(exc.value)

    def test_date_range_at_the_cap_is_accepted(self):
        from config import settings

        start, end = _span(settings.max_query_days)
        payload = {**BASE, "startDateTime": start, "endDateTime": end}
        assert DataExportRequest(**payload) is not None

    @pytest.mark.parametrize("frequency", ["raw", "hourly"])
    def test_raw_and_hourly_use_the_shorter_limit(self, frequency):
        """Raw and hourly rows use MAX_HOURLY_QUERY_DAYS."""
        from config import settings

        limit = settings.hourly_query_days()
        base = {**BASE, "frequency": frequency, "datatype": "raw"}

        start, end = _span(limit)
        at_limit = DataExportRequest(
            **{**base, "startDateTime": start, "endDateTime": end}
        )
        assert at_limit.frequency == frequency

        with pytest.raises(ValidationError):
            DataExportRequest(
                **{**base, "startDateTime": _past(limit + 1), "endDateTime": _now()}
            )

    def test_limit_counts_the_full_span(self):
        """A window of the limit plus one hour is rejected."""
        from config import settings

        limit = settings.hourly_query_days()
        end = datetime.now(tz=timezone.utc)
        start = end - timedelta(days=limit, hours=1)
        with pytest.raises(ValidationError):
            DataExportRequest(
                **{
                    **BASE,
                    "frequency": "hourly",
                    "datatype": "raw",
                    "startDateTime": start.isoformat(),
                    "endDateTime": end.isoformat(),
                }
            )

    def test_mixed_naive_and_aware_window_is_checked(self):
        """A naive start with an aware end reaches the day count as one pair."""
        with pytest.raises(ValidationError):
            DataExportRequest(
                **{
                    **BASE,
                    "frequency": "hourly",
                    "startDateTime": "2024-01-01T00:00:00",
                    "endDateTime": "2024-03-01T00:00:00+00:00",
                }
            )

    def test_daily_default_uses_max_query_days(self):
        """A request that sends no frequency takes the daily default and the
        MAX_QUERY_DAYS limit."""
        from config import settings

        payload = {k: v for k, v in BASE.items() if k != "frequency"}

        start, end = _span(settings.max_query_days)
        req = DataExportRequest(
            **{**payload, "startDateTime": start, "endDateTime": end}
        )
        assert req.frequency == Frequency.DAILY

        with pytest.raises(ValidationError):
            DataExportRequest(
                **{
                    **payload,
                    "startDateTime": _past(settings.max_query_days + 1),
                    "endDateTime": _now(),
                }
            )

    def test_frequency_rules_are_checked_before_the_window(self):
        """A request with an invalid frequency is rejected before its window
        is checked, so the caller sees the frequency error first."""
        from unittest.mock import patch
        from config import settings

        with patch("api.schemas.requests._check_window_limit") as window_check:
            with pytest.raises(ValidationError):
                DataExportRequest(
                    **{
                        **BASE,
                        "frequency": "raw",
                        "datatype": "calibrated",
                        "startDateTime": _past(settings.max_query_days + 1),
                        "endDateTime": _now(),
                    }
                )

        window_check.assert_not_called()

    @pytest.mark.parametrize(
        "changes,offered",
        [
            ({"frequency": "hourly"}, True),
            ({"frequency": "daily"}, False),
            ({"frequency": "raw", "datatype": "raw"}, True),
            (
                {"frequency": "raw", "datatype": "raw", "device_category": "mobile"},
                False,
            ),
        ],
    )
    def test_offers_coarser_frequency(self, changes, offered):
        """A download offers a coarser frequency at raw and hourly, except for
        mobile devices, which accept the raw frequency only."""
        assert (
            DataExportRequest(**{**BASE, **changes}).offers_coarser_frequency()
            is offered
        )

    def test_raw_data_request_offers_no_coarser_frequency(self):
        payload = {k: v for k, v in BASE.items() if k != "frequency"}
        assert RawDataExportRequest(**payload).offers_coarser_frequency() is False

    def test_hourly_limit_never_exceeds_max_query_days(self, monkeypatch):
        """A MAX_HOURLY_QUERY_DAYS above MAX_QUERY_DAYS is clamped, so raw and
        hourly requests never span more days than daily requests."""
        from config import settings

        monkeypatch.setattr(settings, "max_hourly_query_days", 1000)
        monkeypatch.setattr(settings, "max_query_days", 365)

        assert settings.hourly_query_days() == 365
        with pytest.raises(ValidationError):
            DataExportRequest(
                **{
                    **BASE,
                    "frequency": "hourly",
                    "startDateTime": _past(366),
                    "endDateTime": _now(),
                }
            )

    def test_oversized_filter_list_rejected(self):
        from config import settings

        payload = {
            **BASE,
            "sites": [f"s{i}" for i in range(settings.max_filter_values + 1)],
        }
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert "must not exceed" in str(exc.value)

    def test_filter_list_at_the_cap_is_accepted(self):
        from config import settings

        payload = {
            **BASE,
            "sites": [f"s{i}" for i in range(settings.max_filter_values)],
        }
        assert DataExportRequest(**payload) is not None

    def test_grid_ids_and_sites_together_rejected(self):
        payload = {**BASE, "grid_ids": ["g1"]}  # BASE already sets sites=["site1"]
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert "only one filter" in str(exc.value).lower()

    def test_multiple_grid_ids_rejected(self):
        """Capped to one grid per request for now (grids can contain many
        devices) — TODO in the schema: remove after reviewing grid sizes."""
        payload = {**BASE, "sites": None, "grid_ids": ["g1", "g2"]}
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**payload)
        assert "one grid" in str(exc.value).lower()

    def test_invalid_network_rejected(self):
        with pytest.raises(ValidationError):
            DataExportRequest(**{**BASE, "network": "not_a_network"})

    def test_invalid_pollutant_rejected(self):
        with pytest.raises(ValidationError):
            DataExportRequest(**{**BASE, "pollutants": ["no2"]})

    def test_invalid_frequency_rejected(self):
        with pytest.raises(ValidationError):
            DataExportRequest(**{**BASE, "frequency": "quarterly"})

    def test_calibrated_with_raw_frequency_rejected(self):
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(**{**BASE, "datatype": "calibrated", "frequency": "raw"})
        assert "calibrated" in str(exc.value).lower()

    def test_mobile_with_non_raw_frequency_rejected(self):
        with pytest.raises(ValidationError) as exc:
            DataExportRequest(
                **{**BASE, "device_category": "mobile", "frequency": "hourly"}
            )
        assert "mobile" in str(exc.value).lower()


class TestRawDataExportRequest:
    def test_valid_raw_request(self):
        req = RawDataExportRequest(
            startDateTime=_past(3),
            endDateTime=_now(),
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1"],
        )
        assert req.frequency == "raw"
        assert req.datatype == "raw"

    def test_sql_injection_in_site_id_is_just_a_string(self):
        """Site IDs with SQL-like content must be accepted by Pydantic
        (sanitisation happens at the BigQuery parameterized-query layer).
        The schema must NOT reject them with a 422 — that would leak
        implementation details."""
        req = RawDataExportRequest(
            startDateTime=_past(1),
            endDateTime=_now(),
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1'; DROP TABLE sites; --"],
        )
        assert req.sites is not None


class TestDashboardChartRequest:
    def test_valid_line_chart(self):
        req = DashboardChartRequest(
            startDateTime=_past(7),
            endDateTime=_now(),
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1"],
            frequency="daily",
            chartType="line",
        )
        assert req.chart_type == "line"

    def test_invalid_chart_type_rejected(self):
        with pytest.raises(ValidationError):
            DashboardChartRequest(
                startDateTime=_past(7),
                endDateTime=_now(),
                network="airqo",
                device_category="lowcost",
                pollutants=["pm2_5"],
                sites=["site1"],
                frequency="daily",
                chartType="radar",  # not in enum
            )


class TestMonitoringSiteRequest:
    def test_all_optional_fields(self):
        req = MonitoringSiteRequest()
        assert req.network is None
        assert req.site_ids is None
        assert req.include_device_info is True

    def test_with_network(self):
        req = MonitoringSiteRequest(network="airqo")
        assert req.network == "airqo"


class TestResponseModels:
    def test_data_export_response_accepts_any_records(self):
        resp = DataExportResponse(
            status="success",
            message="ok",
            data=[{"datetime": "2023-01-01", "pm2_5": 15.5, "custom_col": "x"}],
        )
        assert resp.data[0]["pm2_5"] == 15.5

    def test_data_export_response_empty_data(self):
        resp = DataExportResponse(status="success", data=[])
        assert resp.data == []
        assert resp.metadata is None

    def test_dashboard_response_accepts_flexible_data(self):
        resp = DashboardChartResponse(
            status="success",
            chart_type="line",
            data=[{"x": "2023-01-01", "y": 15.5, "site_id": "s1"}],
        )
        assert len(resp.data) == 1


class TestAirQualityReportRequest:
    """The report body: snake_case keys, window non-zero and within
    MAX_HOURLY_QUERY_DAYS. The entity is chosen in the body — exactly one of
    grid_id / cohort_id."""

    def test_valid_request(self):
        req = AirQualityReportRequest(
            grid_id="grid-123",
            start_time="2024-01-01T00:00:00",
            end_time="2024-02-01T00:00:00",
        )
        assert req.grid_id == "grid-123"

    def test_equal_start_end_rejected(self):
        with pytest.raises(ValidationError, match="cannot be the same"):
            AirQualityReportRequest(
                grid_id="g",
                start_time="2024-01-01T00:00:00",
                end_time="2024-01-01T00:00:00",
            )

    def test_empty_grid_id_rejected(self):
        with pytest.raises(ValidationError):
            AirQualityReportRequest(
                grid_id="",
                start_time="2024-01-01T00:00:00",
                end_time="2024-02-01T00:00:00",
            )

    def test_mixed_naive_aware_datetimes_normalised(self):
        """A naive start with an aware end must not TypeError in validation."""
        req = AirQualityReportRequest(
            grid_id="g",
            start_time="2024-01-01T00:00:00",
            end_time="2024-02-01T00:00:00+00:00",
        )
        assert req.start_time.tzinfo is not None


class TestDashboardAggregationRequests:
    """Wire contract from the Flask dashboard endpoints: singular pollutant,
    startDate/endDate aliases, plain sites/devices lists."""

    _WINDOW = {
        "startDate": "2024-01-01T00:00:00.000000Z",
        "endDate": "2024-02-01T00:00:00.000000Z",
    }

    def test_daily_averages_valid(self):
        req = DailyAveragesRequest(pollutant="pm2_5", sites=["s1"], **self._WINDOW)
        assert req.pollutant == "pm2_5"
        assert req.sites == ["s1"]

    def test_daily_averages_accepts_flask_pollutants(self):
        for pollutant in ("pm2_5", "pm10", "no2", "pm1"):
            DailyAveragesRequest(pollutant=pollutant, sites=["s1"], **self._WINDOW)

    def test_daily_averages_invalid_pollutant_rejected(self):
        with pytest.raises(ValidationError):
            DailyAveragesRequest(pollutant="so2", sites=["s1"], **self._WINDOW)

    def test_daily_averages_empty_sites_rejected(self):
        """Flask 500'd on an empty list inside the privacy helper — now a 422."""
        with pytest.raises(ValidationError):
            DailyAveragesRequest(pollutant="pm2_5", sites=[], **self._WINDOW)

    def test_device_daily_averages_uses_devices_key(self):
        req = DeviceDailyAveragesRequest(
            pollutant="pm10", devices=["d1"], **self._WINDOW
        )
        assert req.devices == ["d1"]

    def test_exceedances_valid(self):
        req = ExceedancesRequest(
            pollutant="pm2_5", standard="aqi", sites=["s1"], **self._WINDOW
        )
        assert req.standard == "aqi"

    def test_exceedances_standard_lowercased(self):
        req = ExceedancesRequest(
            pollutant="pm2_5", standard="WHO", sites=["s1"], **self._WINDOW
        )
        assert req.standard == "who"

    def test_exceedances_unknown_standard_rejected(self):
        with pytest.raises(ValidationError):
            ExceedancesRequest(
                pollutant="pm2_5", standard="epa", sites=["s1"], **self._WINDOW
            )

    def test_exceedances_pollutant_narrowed_to_standards_mapping(self):
        """no2/pm1 have no exceedance bands — Flask raised KeyError (500)."""
        with pytest.raises(ValidationError):
            ExceedancesRequest(
                pollutant="no2", standard="aqi", sites=["s1"], **self._WINDOW
            )

    def test_exceedances_missing_standard_rejected(self):
        with pytest.raises(ValidationError):
            ExceedancesRequest(pollutant="pm2_5", sites=["s1"], **self._WINDOW)

    def test_device_exceedances_uses_devices_key(self):
        req = DeviceExceedancesRequest(
            pollutant="pm10", standard="who", devices=["d1"], **self._WINDOW
        )
        assert req.devices == ["d1"]

    @pytest.mark.parametrize(
        "build",
        [
            lambda w: DailyAveragesRequest(pollutant="pm2_5", sites=["s1"], **w),
            lambda w: DeviceDailyAveragesRequest(
                pollutant="pm2_5", devices=["d1"], **w
            ),
            lambda w: ExceedancesRequest(
                pollutant="pm2_5", standard="aqi", sites=["s1"], **w
            ),
            lambda w: DeviceExceedancesRequest(
                pollutant="pm2_5", standard="aqi", devices=["d1"], **w
            ),
        ],
    )
    def test_window_limited_to_hourly_query_days(self, build):
        """Each dashboard aggregation request carries the
        MAX_HOURLY_QUERY_DAYS limit."""
        from config import settings

        limit = settings.hourly_query_days()
        start, end = _span(limit)
        assert build({"startDate": start, "endDate": end})
        with pytest.raises(ValidationError):
            build({"startDate": _past(limit + 1), "endDate": _now()})

    def test_mixed_naive_and_aware_window_is_checked(self):
        """A naive start with an aware end reaches the day count as one pair."""
        with pytest.raises(ValidationError):
            DailyAveragesRequest(
                pollutant="pm2_5",
                sites=["s1"],
                startDate="2024-01-01T00:00:00",
                endDate="2024-03-01T00:00:00+00:00",
            )


class TestForecastDataExportRequest:
    def _window(self, days: int) -> dict:
        start, end = _span(days)
        return {"startDateTime": start, "endDateTime": end, "country": "ug"}

    def test_window_limited_to_hourly_query_days(self):
        from api.schemas.requests import ForecastDataExportRequest
        from config import settings

        limit = settings.hourly_query_days()
        assert ForecastDataExportRequest(**self._window(limit))
        with pytest.raises(ValidationError):
            ForecastDataExportRequest(**self._window(limit + 1))

    def test_mixed_naive_and_aware_window_is_checked(self):
        from api.schemas.requests import ForecastDataExportRequest

        with pytest.raises(ValidationError):
            ForecastDataExportRequest(
                startDateTime="2024-01-01T00:00:00",
                endDateTime="2024-03-01T00:00:00+00:00",
                country="ug",
            )


class TestDataSummaryRequest:
    _WINDOW = {
        "start_time": "2024-01-01T00:00:00",
        "end_time": "2024-01-05T00:00:00",
    }

    def test_valid_with_grid(self):
        from api.schemas.requests import DataSummaryRequest

        req = DataSummaryRequest(**self._WINDOW, grid_id="g1")
        assert req.entity() == ("grid", "g1")

    def test_entity_drops_the_id_suffix(self):
        """entity() returns the bare kind, not the field name: the query
        builder validates against SUMMARY_FILTER_KINDS ("grid"/"cohort") and
        get_summary interpolates it into the no-data message."""
        from api.schemas.requests import DataSummaryRequest

        assert DataSummaryRequest(**self._WINDOW, cohort_id="c1").entity() == (
            "cohort",
            "c1",
        )

    def test_no_entity_rejected(self):
        """Flask 500'd (UnboundLocalError) when all three were empty —
        now a clean validation error."""
        from api.schemas.requests import DataSummaryRequest

        with pytest.raises(ValidationError, match="exactly one"):
            DataSummaryRequest(**self._WINDOW)

    def test_two_entities_rejected(self):
        from api.schemas.requests import DataSummaryRequest

        with pytest.raises(ValidationError, match="exactly one"):
            DataSummaryRequest(**self._WINDOW, grid_id="g1", cohort_id="c1")

    def test_whitespace_entity_treated_as_absent(self):
        """Flask treated '' as absent via .strip() — preserve."""
        from api.schemas.requests import DataSummaryRequest

        req = DataSummaryRequest(**self._WINDOW, grid_id="  ", cohort_id="c1")
        assert req.entity() == ("cohort", "c1")

    def test_mixed_naive_and_aware_window_is_checked(self):
        from api.schemas.requests import DataSummaryRequest

        with pytest.raises(ValidationError):
            DataSummaryRequest(
                start_time="2024-01-01T00:00:00",
                end_time="2024-03-01T00:00:00+00:00",
                grid_id="g1",
            )

    def test_body_matches_the_report_request(self):
        """/summary and /report take the same window and entity keys."""
        from api.schemas.requests import (
            AirQualityReportRequest,
            DataSummaryRequest,
        )

        shared = {"start_time", "end_time", "grid_id", "cohort_id"}
        assert shared <= set(DataSummaryRequest.model_fields)
        assert shared <= set(AirQualityReportRequest.model_fields)


class TestScheduledExportRequest:
    def _payload(self, **overrides):
        payload = {
            **BASE,
            "userId": "user-1",
            "frequency": "hourly",
            "exportFormat": "csv",
        }
        payload.update(overrides)
        return payload

    def test_valid_request(self):
        req = ScheduledExportRequest(**self._payload())
        assert req.user_id == "user-1"
        assert req.export_format == "csv"

    def test_missing_user_id_rejected(self):
        payload = self._payload()
        del payload["userId"]
        with pytest.raises(ValidationError):
            ScheduledExportRequest(**payload)

    def test_weekly_frequency_rejected(self):
        """Scheduled exports only support hourly/daily/raw (outer contract)."""
        with pytest.raises(ValidationError):
            ScheduledExportRequest(**self._payload(frequency="weekly"))

    def test_invalid_export_format_rejected(self):
        with pytest.raises(ValidationError):
            ScheduledExportRequest(**self._payload(exportFormat="parquet"))

    def test_inherits_filter_exclusivity(self):
        with pytest.raises(ValidationError, match="[Oo]nly one filter"):
            ScheduledExportRequest(**self._payload(device_ids=["d1"]))

    def test_grid_ids_rejected(self):
        """The Celery worker's query builder cannot process grid_ids —
        accepting one would register a request that fails on every beat
        tick until retries are exhausted."""
        payload = self._payload(sites=None, grid_ids=["g1"])
        with pytest.raises(ValidationError, match="not yet supported"):
            ScheduledExportRequest(**payload)


class TestAirQualityReportEntitySelection:
    """/report picks its entity in the body, not the path — the same way
    DataSummaryRequest does."""

    _WINDOW = {
        "start_time": "2024-01-01T00:00:00",
        "end_time": "2024-02-01T00:00:00",
    }

    def test_grid_only_resolves_to_grid(self):
        req = AirQualityReportRequest(grid_id="g1", **self._WINDOW)
        assert req.entity() == ("grid", "g1")

    def test_cohort_only_resolves_to_cohort(self):
        req = AirQualityReportRequest(cohort_id="c1", **self._WINDOW)
        assert req.entity() == ("cohort", "c1")

    def test_neither_rejected(self):
        with pytest.raises(ValidationError, match="exactly one"):
            AirQualityReportRequest(**self._WINDOW)

    def test_both_rejected(self):
        with pytest.raises(ValidationError, match="exactly one"):
            AirQualityReportRequest(grid_id="g1", cohort_id="c1", **self._WINDOW)

    def test_whitespace_entity_treated_as_absent(self):
        """Same .strip() handling as DataSummaryRequest."""
        req = AirQualityReportRequest(grid_id="  ", cohort_id="c1", **self._WINDOW)
        assert req.entity() == ("cohort", "c1")

    def test_reversed_window_rejected(self):
        """A reversed window gives a negative day count, so the check rejects
        it before the day count is compared with the limit."""
        with pytest.raises(ValidationError, match="end_time must be after"):
            AirQualityReportRequest(
                grid_id="g1",
                start_time="2024-02-01T00:00:00",
                end_time="2024-01-01T00:00:00",
            )
