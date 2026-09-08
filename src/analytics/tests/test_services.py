"""
Unit tests for the service layer.

All external I/O (BigQuery, Redis) is mocked so these tests run without
any real infrastructure.  The conftest.py autouse fixtures patch cache;
BigQuery is patched per-test via unittest.mock.patch.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
import pandas as pd
from unittest.mock import ANY, AsyncMock, MagicMock, patch

from fastapi import HTTPException

from api.services import DataExportService, DashboardService, MonitoringService
from api.schemas.responses import (
    DataExportResponse,
    DashboardChartResponse,
    MonitoringSiteResponse,
)


# ---------------------------------------------------------------------------
# DataExportService
# ---------------------------------------------------------------------------


class TestDataExportService:
    @pytest.mark.asyncio
    async def test_export_data_returns_records(self, export_request, sample_df):
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.export_data(export_request)

        assert isinstance(resp, DataExportResponse)
        assert resp.status == "success"
        assert len(resp.data) == 2
        assert resp.metadata["total_count"] == 2

    @pytest.mark.asyncio
    async def test_export_data_passes_data_type_enum(self, export_request, sample_df):
        """Regression: data_type must reach the query builder as a DataType enum,
        not None — otherwise pollutant column selection crashes on .value."""
        from constants import DataType

        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            await svc.export_data(export_request)

        _, kwargs = mock_bq.call_args
        assert kwargs["data_type"] is not None
        assert isinstance(kwargs["data_type"], DataType)
        # export_request fixture uses datatype=calibrated
        assert kwargs["data_type"] == DataType.CALIBRATED

    @pytest.mark.asyncio
    async def test_export_raw_data_passes_raw_data_type(self, raw_request, sample_df):
        from constants import DataType

        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            await svc.export_raw_data(raw_request)

        _, kwargs = mock_bq.call_args
        assert kwargs["data_type"] == DataType.RAW

    @pytest.mark.asyncio
    async def test_export_data_empty_returns_200_not_error(
        self, export_request, empty_df
    ):
        svc = DataExportService()
        meta = {"total_count": 0, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(empty_df, meta),
        ):
            resp = await svc.export_data(export_request)

        assert resp.status == "success"
        assert resp.data == []
        assert "No data available for the selected period" in resp.message

    @pytest.mark.asyncio
    async def test_export_data_bigquery_error_raises_500(self, export_request):
        svc = DataExportService()

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=RuntimeError("BQ failure"),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.export_data(export_request)

        assert exc.value.status_code == 500
        assert "Failed to retrieve data" in exc.value.detail
        # Must NOT expose internal error message
        assert "BQ failure" not in exc.value.detail

    @pytest.mark.asyncio
    async def test_export_data_applies_cleaning_pipeline(self, export_request):
        """The cleaning pipeline must run on the query result: device_id is
        renamed, a frequency column is added, unrequested optional columns and
        all-zero columns are dropped, and NaN becomes None."""
        import numpy as np

        dirty = pd.DataFrame(
            {
                "device_id": ["d1", "d2"],
                "datetime": ["2023-01-01", "2023-01-02"],
                "site_name": ["A", "B"],
                "pm2_5": [10.0, np.nan],
                "pm10": [0, 0],  # all-zero → dropped
                "temperature": [20.0, 21.0],  # optional, not requested → dropped
            }
        )
        svc = DataExportService()
        # Deliberately wrong: the query layer's pre-cleaning count must be
        # overwritten with the number of records actually returned.
        meta = {"total_count": 99, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(dirty, meta),
        ):
            resp = await svc.export_data(export_request)

        assert resp.status == "success"
        assert resp.metadata["total_count"] == 2
        cols = set(resp.data[0].keys())
        assert "device_name" in cols and "device_id" not in cols
        assert "frequency" in cols
        assert "pm10" not in cols  # all-zero dropped
        assert "temperature" not in cols  # optional not requested
        # NaN nullified in the JSON payload
        assert resp.data[1]["pm2_5"] is None

    @pytest.mark.asyncio
    async def test_export_data_bad_filter_raises_400(self, export_request):
        """get_validated_filter returning an error message triggers 400."""
        svc = DataExportService()

        with patch(
            "api.services.get_validated_filter",
            return_value=(None, []),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.export_data(export_request)

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_export_raw_data_returns_records(self, raw_request, sample_df):
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.export_raw_data(raw_request)

        assert resp.status == "success"
        assert len(resp.data) == 2

    @pytest.mark.asyncio
    async def test_export_forecast_data_by_country(self, sample_df):
        from datetime import datetime, timedelta, timezone
        from api.schemas.requests import ForecastDataExportRequest

        req = ForecastDataExportRequest(
            startDateTime=(
                datetime.now(tz=timezone.utc) - timedelta(days=2)
            ).isoformat(),
            endDateTime=datetime.now(tz=timezone.utc).isoformat(),
            country="uganda",
        )
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            resp = await svc.export_forecast_data(req)

        assert resp.status == "success"
        assert len(resp.data) == 2
        # Filter must be passed as a country where-clause
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"country": "uganda"}

    @pytest.mark.asyncio
    async def test_export_data_csv_returns_streaming_response(self, sample_df):
        from datetime import datetime, timedelta, timezone
        from fastapi.responses import StreamingResponse
        from api.schemas.requests import DataExportRequest

        req = DataExportRequest(
            startDateTime=(
                datetime.now(tz=timezone.utc) - timedelta(days=2)
            ).isoformat(),
            endDateTime=datetime.now(tz=timezone.utc).isoformat(),
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1"],
            frequency="daily",
            downloadType="csv",
        )
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.export_data(req)

        assert isinstance(resp, StreamingResponse)
        assert resp.media_type == "text/csv"

    @pytest.mark.asyncio
    async def test_get_summary_returns_completeness_report(self):
        """/data/summary is a data-completeness report (Flask parity):
        record counts/percentages per device+site, envelope message
        'successful', hour-truncated dates bound as parameters."""
        from api.schemas.requests import DataSummaryRequest

        request = DataSummaryRequest(
            startDateTime="2024-01-01T10:45:00",
            endDateTime="2024-01-05T00:30:00",
            grid="grid-1",
        )
        summary_df = pd.DataFrame(
            {
                "device": ["d1"],
                "site_id": ["s1"],
                "site_name": ["Kampala"],
                "grid_id": ["grid-1"],
                "grid": ["Kampala Grid"],
                "hourly_records": [100],
                "calibrated_records": [80],
                "uncalibrated_records": [20],
                "calibrated_percentage": [80.0],
                "uncalibrated_percentage": [20.0],
            }
        )
        svc = DataExportService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=summary_df,
        ) as mock_exec:
            resp = await svc.get_summary(request)

        assert resp["status"] == "success"
        assert resp["message"] == "successful"
        assert resp["metadata"] is None
        assert resp["data"]["grid"] == "Kampala Grid"
        assert resp["data"]["hourly_records"] == 100
        assert resp["data"]["devices"][0]["device"] == "d1"
        assert resp["data"]["sites"][0]["site_name"] == "Kampala"

        query, job_config = mock_exec.call_args.args
        assert "@filter_id" in query and "@start_date" in query
        assert "grid-1" not in query
        params = {p.name: p.value for p in job_config.query_parameters}
        assert params["filter_id"] == "grid-1"
        # Hour truncation: 10:45 → 10:00
        assert params["start_date"].minute == 0
        assert params["start_date"].hour == 10

    async def test_get_summary_cohort_branch_includes_site_columns(self):
        """Divergence-fix: the Flask cohort chain lacked site_id/site_name,
        so compute_entity_summary's groupby KeyError'd — every cohort
        request 500'd.  The ported query must carry both columns and the
        computation must succeed end to end."""
        from api.models.summary_queries import devices_summary_query
        from api.schemas.requests import DataSummaryRequest
        from datetime import datetime

        sql, params = devices_summary_query(
            "cohort", "c1", datetime(2024, 1, 1), datetime(2024, 2, 1)
        )
        assert "AS site_name" in sql and "AS site_id" in sql
        assert "meta_data.site_id, meta_data.site_name" in sql
        assert {p.name for p in params} == {"filter_id", "start_date", "end_date"}

        request = DataSummaryRequest(
            startDateTime="2024-01-01T00:00:00",
            endDateTime="2024-01-05T00:00:00",
            cohort="c1",
        )
        cohort_df = pd.DataFrame(
            {
                "device": ["d1"],
                "device_name": ["Device One"],
                "site_id": ["s1"],
                "site_name": ["Kampala"],
                "cohort_id": ["c1"],
                "cohort": ["My Cohort"],
                "hourly_records": [50],
                "calibrated_records": [40],
                "uncalibrated_records": [10],
                "calibrated_percentage": [80.0],
                "uncalibrated_percentage": [20.0],
            }
        )
        svc = DataExportService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=cohort_df,
        ):
            resp = await svc.get_summary(request)

        assert resp["status"] == "success"
        assert resp["data"]["cohort"] == "My Cohort"
        assert resp["data"]["sites"][0]["site_name"] == "Kampala"

    async def test_get_summary_empty_returns_no_data_message(self):
        from api.schemas.requests import DataSummaryRequest

        request = DataSummaryRequest(
            startDateTime="2024-01-01T00:00:00",
            endDateTime="2024-01-05T00:00:00",
            grid="grid-1",
        )
        svc = DataExportService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ):
            resp = await svc.get_summary(request)

        assert resp["status"] == "success"
        assert resp["data"] == {}
        assert "No data available for grid grid-1" in resp["message"]
        assert "2024-01-01" in resp["message"]


# ---------------------------------------------------------------------------
# DashboardService
# ---------------------------------------------------------------------------


class TestDashboardService:
    @pytest.mark.asyncio
    async def test_get_chart_data_line(self, dashboard_request, sample_df):
        svc = DashboardService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.get_chart_data(dashboard_request)

        assert isinstance(resp, DashboardChartResponse)
        assert resp.status == "success"
        assert resp.chart_type == "line"
        assert len(resp.data) == 2

    @pytest.mark.asyncio
    async def test_get_chart_data_pie_aggregates_by_site(self, sample_df):
        """Pie chart must produce {label, value} per site, not raw rows."""
        from datetime import datetime, timedelta, timezone
        from api.schemas.requests import DashboardChartRequest

        start = (datetime.now(tz=timezone.utc) - timedelta(days=7)).isoformat()
        end = datetime.now(tz=timezone.utc).isoformat()
        pie_req = DashboardChartRequest(
            startDateTime=start,
            endDateTime=end,
            network="airqo",
            device_category="lowcost",
            pollutants=["pm2_5"],
            sites=["site1"],
            frequency="daily",
            chartType="pie",
        )
        svc = DashboardService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.get_chart_data(pie_req)

        assert resp.status == "success"
        for point in resp.data:
            assert "label" in point
            assert "value" in point

    @pytest.mark.asyncio
    async def test_get_chart_data_empty_returns_success(
        self, dashboard_request, empty_df
    ):
        svc = DashboardService()
        meta = {"total_count": 0, "has_more": False, "next": None}

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(empty_df, meta),
        ):
            resp = await svc.get_chart_data(dashboard_request)

        assert resp.status == "success"
        assert resp.data == []

    @pytest.mark.asyncio
    async def test_get_chart_data_bigquery_error_raises_500(self, dashboard_request):
        svc = DashboardService()

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=RuntimeError("connection failed"),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.get_chart_data(dashboard_request)

        assert exc.value.status_code == 500
        assert "connection failed" not in exc.value.detail


# ---------------------------------------------------------------------------
# MonitoringService
# ---------------------------------------------------------------------------


class TestMonitoringService:
    @pytest.mark.asyncio
    async def test_get_sites_returns_site_list(self):
        svc = MonitoringService()
        sites_df = pd.DataFrame(
            {
                "id": ["s1", "s2"],
                "name": ["Site A", "Site B"],
                "latitude": [0.3, 0.4],
                "longitude": [32.5, 32.6],
                "network": ["airqo", "airqo"],
            }
        )

        with patch(
            "api.services.AsyncBigQueryApi.get_sites_async",
            new_callable=AsyncMock,
            return_value=sites_df,
        ):
            resp = await svc.get_sites()

        assert isinstance(resp, MonitoringSiteResponse)
        assert resp.total_sites == 2
        assert resp.sites[0].site_id == "s1"
        # Regression: network must come from the sites query (previously the
        # SELECT omitted the column, so every site reported "unknown")
        assert resp.sites[0].network == "airqo"
        assert resp.networks == ["airqo"]

    @pytest.mark.asyncio
    async def test_get_sites_empty_returns_success(self):
        svc = MonitoringService()

        with patch(
            "api.services.AsyncBigQueryApi.get_sites_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ):
            resp = await svc.get_sites()

        assert resp.status == "success"
        assert resp.sites == []
        assert resp.total_sites == 0


# ---------------------------------------------------------------------------
# AirQualityReportService
# ---------------------------------------------------------------------------


def _report_request(**entity):
    """entity is grid_id=... or cohort_id=..."""
    from api.schemas.requests import AirQualityReportRequest

    return AirQualityReportRequest(
        start_time="2024-01-01T00:00:00",
        end_time="2024-02-01T00:00:00",
        **entity,
    )


class TestAirQualityReportService:
    """One endpoint serves grids and cohorts; the request body names which,
    and the service dispatches on request.entity()."""

    def _svc(self):
        from api.services import AirQualityReportService

        return AirQualityReportService()

    @pytest.mark.asyncio
    async def test_grid_request_builds_a_grid_report(self):
        report = {"airquality": {"status": "success", "grid_id": "grid-1"}}
        with patch(
            "api.services.build_entity_report", return_value=report
        ) as mock_build:
            resp = await self._svc().get_report(_report_request(grid_id="grid-1"))

        assert resp == report
        assert mock_build.call_args.args[:2] == ("grid", "grid-1")

    @pytest.mark.asyncio
    async def test_cohort_request_builds_a_cohort_report(self):
        report = {"airquality": {"status": "success", "cohort_id": "cohort-1"}}
        with patch(
            "api.services.build_entity_report", return_value=report
        ) as mock_build:
            resp = await self._svc().get_report(_report_request(cohort_id="cohort-1"))

        assert resp == report
        assert mock_build.call_args.args[:2] == ("cohort", "cohort-1")

    @pytest.mark.asyncio
    async def test_no_members_maps_to_404(self):
        with patch(
            "api.services.build_entity_report",
            side_effect=LookupError("No site IDs found for the given parameters."),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._svc().get_report(_report_request(grid_id="grid-1"))

        assert exc.value.status_code == 404
        assert "No site IDs" in exc.value.detail

    @pytest.mark.asyncio
    async def test_invalid_dates_map_to_400(self):
        with patch(
            "api.services.build_entity_report",
            side_effect=ValueError("Time range must not exceed 365 days."),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._svc().get_report(_report_request(grid_id="grid-1"))

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_oversized_window_maps_to_400_not_404(self):
        """query_bigquery used to swallow the cost rejection and return None,
        which the builder turned into "No data available" — a 404 for a query
        that was never run."""
        from api.utils.exceptions import QueryTooLarge

        with patch(
            "api.services.build_entity_report",
            side_effect=QueryTooLarge(
                limit_bytes=1073741824, required_bytes=5557452800
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._svc().get_report(_report_request(grid_id="grid-1"))

        assert exc.value.status_code == 400
        assert "date range is too large" in exc.value.detail
        assert "6x" in exc.value.detail

    @pytest.mark.asyncio
    async def test_unexpected_error_maps_to_sanitized_500(self):
        with patch(
            "api.services.build_entity_report",
            side_effect=RuntimeError("bigquery exploded: secret detail"),
        ):
            with pytest.raises(HTTPException) as exc:
                await self._svc().get_report(_report_request(grid_id="grid-1"))

        assert exc.value.status_code == 500
        assert "secret detail" not in exc.value.detail


# ---------------------------------------------------------------------------
# ExportRequestService
# ---------------------------------------------------------------------------


def _scheduled_export_request():
    from datetime import datetime, timedelta, timezone
    from api.schemas.requests import ScheduledExportRequest

    return ScheduledExportRequest(
        startDateTime=(datetime.now(tz=timezone.utc) - timedelta(days=7)).isoformat(),
        endDateTime=datetime.now(tz=timezone.utc).isoformat(),
        network="airqo",
        device_category="lowcost",
        pollutants=["pm2_5"],
        sites=["site1"],
        userId="user-1",
        frequency="hourly",
        exportFormat="csv",
    )


class TestExportRequestService:
    @pytest.mark.asyncio
    async def test_create_registers_scheduled_request(self):
        from api.services import ExportRequestService
        from constants import DataExportStatus

        svc = ExportRequestService()
        with patch("api.services.DataExportModel") as mock_model_cls:
            resp = await svc.create(_scheduled_export_request())

        assert resp["status"] == "success"
        assert resp["data"]["user_id"] == "user-1"
        record = mock_model_cls.return_value.create_request.call_args.args[0]
        assert record.status == DataExportStatus.SCHEDULED
        assert record.retries == 3
        assert record.filter_type == "sites"
        assert record.filter_value == ["site1"]

    @pytest.mark.asyncio
    async def test_list_for_user(self):
        from api.services import ExportRequestService

        fake_record = MagicMock()
        fake_record.to_api_format.return_value = {"user_id": "user-1"}
        svc = ExportRequestService()

        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_user_requests.return_value = [fake_record]
            resp = await svc.list_for_user("user-1")

        assert resp["data"] == [{"user_id": "user-1"}]

    @pytest.mark.asyncio
    async def test_retry_unknown_request_maps_to_404(self):
        from api.services import ExportRequestService
        from api.utils.exceptions import ExportRequestNotFound

        svc = ExportRequestService()
        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_request_by_id.side_effect = (
                ExportRequestNotFound(request_id="nope")
            )
            with pytest.raises(HTTPException) as exc:
                await svc.retry("nope")

        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_retry_reschedules_request(self):
        from api.services import ExportRequestService
        from constants import DataExportStatus

        fake_record = MagicMock()
        fake_record.to_api_format.return_value = {"request_id": "r1"}
        svc = ExportRequestService()

        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_request_by_id.return_value = fake_record
            mock_model_cls.return_value.update_request_status_and_retries.return_value = (
                True
            )
            resp = await svc.retry("r1")

        assert resp["status"] == "success"
        assert fake_record.status == DataExportStatus.SCHEDULED
        assert fake_record.retries == 3

    @pytest.mark.asyncio
    async def test_retry_rejects_another_users_request(self):
        """Without this check any caller could reschedule anyone's export by
        guessing a request id. 404 (not 403) so the endpoint can't be used to
        enumerate which request ids exist."""
        from api.services import ExportRequestService

        fake_record = MagicMock()
        fake_record.user_id = "owner"
        svc = ExportRequestService()

        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_request_by_id.return_value = fake_record
            with pytest.raises(HTTPException) as exc:
                await svc.retry("r1", caller_id="attacker")

        assert exc.value.status_code == 404
        mock_model_cls.return_value.update_request_status_and_retries.assert_not_called()

    @pytest.mark.asyncio
    async def test_retry_allows_the_owner(self):
        from api.services import ExportRequestService

        fake_record = MagicMock()
        fake_record.user_id = "owner"
        fake_record.to_api_format.return_value = {"request_id": "r1"}
        svc = ExportRequestService()

        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_request_by_id.return_value = fake_record
            mock_model_cls.return_value.update_request_status_and_retries.return_value = (
                True
            )
            resp = await svc.retry("r1", caller_id="owner")

        assert resp["status"] == "success"

    @pytest.mark.asyncio
    async def test_retry_skips_ownership_check_when_identity_unavailable(self):
        """Transition mode — no gateway header means ownership is
        unenforceable, not that everything is denied."""
        from api.services import ExportRequestService

        fake_record = MagicMock()
        fake_record.user_id = "owner"
        fake_record.to_api_format.return_value = {"request_id": "r1"}
        svc = ExportRequestService()

        with patch("api.services.DataExportModel") as mock_model_cls:
            mock_model_cls.return_value.get_request_by_id.return_value = fake_record
            mock_model_cls.return_value.update_request_status_and_retries.return_value = (
                True
            )
            resp = await svc.retry("r1", caller_id=None)

        assert resp["status"] == "success"


# ---------------------------------------------------------------------------
# Dashboard historical aggregations (daily averages / exceedances)
# ---------------------------------------------------------------------------

_AGG_WINDOW = {
    "startDate": "2024-01-01T00:00:00.000000Z",
    "endDate": "2024-02-01T00:00:00.000000Z",
}


class TestDashboardDailyAverages:
    @pytest.mark.asyncio
    async def test_parallel_arrays_with_flask_skip_rules(self):
        """0.0 values, NaN values, and sites missing from the label map are
        all dropped — exactly like the Flask post-processing loop."""
        from api.schemas.requests import DailyAveragesRequest
        from api.utils.pollutants import set_pm25_category_background

        request = DailyAveragesRequest(
            pollutant="pm2_5",
            sites=["site1", "site2", "site3", "unknown"],
            **_AGG_WINDOW,
        )
        averages_df = pd.DataFrame(
            {
                "value": [10.5, 0.0, float("nan"), 22.0],
                "site_id": ["site1", "site2", "site3", "unknown"],
            }
        )
        sites_df = pd.DataFrame(
            {
                "id": ["site1", "site2", "site3"],
                "name": ["Kampala", "Jinja", "Gulu"],
            }
        )

        svc = DashboardService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=averages_df,
        ), patch(
            "api.services.AsyncBigQueryApi.get_sites_async",
            new_callable=AsyncMock,
            return_value=sites_df,
        ):
            resp = await svc.get_daily_averages(request)

        assert resp.status == "success"
        assert resp.message == "daily averages successfully fetched"
        assert resp.metadata is None
        assert resp.data.average_values == [10.5]
        assert resp.data.labels == ["Kampala"]
        assert resp.data.background_colors == [set_pm25_category_background(10.5)]

    @pytest.mark.asyncio
    async def test_query_is_parameterized(self):
        """Dates and site IDs are bound as query parameters, never inlined."""
        from api.schemas.requests import DailyAveragesRequest

        request = DailyAveragesRequest(pollutant="pm2_5", sites=["s1"], **_AGG_WINDOW)
        svc = DashboardService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ) as mock_exec, patch(
            "api.services.AsyncBigQueryApi.get_sites_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ):
            await svc.get_daily_averages(request)

        query, job_config = mock_exec.call_args.args
        assert "@start_date" in query and "@end_date" in query and "@ids" in query
        assert "2024-01-01" not in query and "s1" not in query
        params = {p.name: p for p in job_config.query_parameters}
        assert set(params) == {"start_date", "end_date", "ids"}
        assert params["ids"].values == ["s1"]

    @pytest.mark.asyncio
    async def test_device_variant_labels_are_raw_device_ids(self):
        from api.schemas.requests import DeviceDailyAveragesRequest

        request = DeviceDailyAveragesRequest(
            pollutant="pm2_5", devices=["dev-1", "dev-2"], **_AGG_WINDOW
        )
        averages_df = pd.DataFrame(
            {
                "value": [15.0, 40.0],
                "device_id": ["dev-1", "dev-2"],
            }
        )
        svc = DashboardService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=averages_df,
        ) as mock_exec:
            resp = await svc.get_device_daily_averages(request)

        assert resp.data.labels == ["dev-1", "dev-2"]
        assert resp.data.average_values == [15.0, 40.0]
        query, _ = mock_exec.call_args.args
        assert "GROUP BY device_id" in query

    @pytest.mark.asyncio
    async def test_dashboard_bypasses_privacy_filter(self):
        """Dashboard endpoints are deliberately NOT privacy-filtered (user
        decision) — the caller-supplied list is bound as @ids verbatim and
        the device-registry helper is never invoked."""
        from api.schemas.requests import DailyAveragesRequest

        request = DailyAveragesRequest(
            pollutant="pm2_5", sites=["s1", "s2"], **_AGG_WINDOW
        )
        svc = DashboardService()
        with patch(
            "api.services.filter_non_private_sites_devices"
        ) as mock_filter, patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ) as mock_exec, patch(
            "api.services.AsyncBigQueryApi.get_sites_async",
            new_callable=AsyncMock,
            return_value=pd.DataFrame(),
        ):
            await svc.get_daily_averages(request)

        mock_filter.assert_not_called()
        _, job_config = mock_exec.call_args.args
        ids = next(p for p in job_config.query_parameters if p.name == "ids")
        assert ids.values == ["s1", "s2"]


class TestDashboardExceedances:
    def _site_request(self):
        from api.schemas.requests import ExceedancesRequest

        return ExceedancesRequest(
            pollutant="pm2_5", standard="aqi", sites=["s1"], **_AGG_WINDOW
        )

    @pytest.mark.asyncio
    async def test_site_variant_returns_repo_docs(self):
        docs = [{"total": 20, "exceedance": {"Good": 10}, "site": {"name": "Kampala"}}]
        svc = DashboardService()
        with patch("api.services.ExceedanceRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_exceedances.return_value = docs
            resp = await svc.get_exceedances(self._site_request(), network="airqo")

        assert resp.message == "exceedance data successfully fetched"
        assert resp.data == docs
        assert resp.metadata is None
        mock_repo_cls.assert_called_once_with("airqo")
        # Dates must reach Mongo in the exact strptime format date_range expects
        args = mock_repo_cls.return_value.get_exceedances.call_args.args
        assert args[0] == "2024-01-01T00:00:00.000000Z"
        assert args[2:] == ("pm2_5", "aqi", ["s1"])

    @pytest.mark.asyncio
    async def test_invalid_site_id_maps_to_400(self):
        from bson.errors import InvalidId

        svc = DashboardService()
        with patch("api.services.ExceedanceRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_exceedances.side_effect = InvalidId("bad")
            with pytest.raises(HTTPException) as exc:
                await svc.get_exceedances(self._site_request())
        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_offset_aware_dates_converted_to_utc(self):
        """An offset-aware startDate must reach Mongo as UTC wall-clock —
        strftime alone would silently discard the +03:00 offset."""
        from api.schemas.requests import ExceedancesRequest

        request = ExceedancesRequest(
            pollutant="pm2_5",
            standard="aqi",
            sites=["s1"],
            startDate="2024-01-01T03:00:00+03:00",
            endDate="2024-02-01T03:00:00+03:00",
        )
        svc = DashboardService()
        with patch("api.services.ExceedanceRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_exceedances.return_value = []
            await svc.get_exceedances(request)

        args = mock_repo_cls.return_value.get_exceedances.call_args.args
        assert args[0] == "2024-01-01T00:00:00.000000Z"
        assert args[1] == "2024-02-01T00:00:00.000000Z"

    @pytest.mark.asyncio
    async def test_mongo_failure_maps_to_sanitized_500(self):
        svc = DashboardService()
        with patch("api.services.ExceedanceRepository") as mock_repo_cls:
            mock_repo_cls.return_value.get_exceedances.side_effect = RuntimeError(
                "mongo internal secret"
            )
            with pytest.raises(HTTPException) as exc:
                await svc.get_exceedances(self._site_request())
        assert exc.value.status_code == 500
        assert "secret" not in exc.value.detail

    @pytest.mark.asyncio
    async def test_device_variant_counts_and_plural_key(self):
        """Boundary values count inclusively; devices with only out-of-band
        values still appear with total 0 and empty counts; the data key is
        `exceedances` (plural) — Flask asymmetry with the site variant."""
        from api.schemas.requests import DeviceExceedancesRequest

        request = DeviceExceedancesRequest(
            pollutant="pm2_5", standard="aqi", devices=["d1", "d2"], **_AGG_WINDOW
        )
        # d1: Good (boundary 12.0), Moderate; d2: out-of-band only
        df = pd.DataFrame(
            {
                "device_id": ["d1", "d1", "d2"],
                "pm2_5": [12.0, 20.0, 9999.0],
                "timestamp": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-01"]),
            }
        )
        svc = DashboardService()
        with patch(
            "api.services.AsyncBigQueryApi.execute_query_async",
            new_callable=AsyncMock,
            return_value=df,
        ) as mock_exec:
            resp = await svc.get_device_exceedances(request)

        assert resp.data == [
            {"device_id": "d1", "total": 2, "exceedances": {"Good": 1, "Moderate": 1}},
            {"device_id": "d2", "total": 0, "exceedances": {}},
        ]
        query, job_config = mock_exec.call_args.args
        assert "TIMESTAMP(DATE(timestamp), 'UTC')" in query
        assert "GROUP BY device_id, timestamp" in query
        devices = next(p for p in job_config.query_parameters if p.name == "devices")
        assert devices.values == ["d1", "d2"]


# ---------------------------------------------------------------------------
# Privacy filtering (all filter endpoints funnel through _filter_from_request)
# ---------------------------------------------------------------------------


class TestPrivacyFiltering:
    """_filter_from_request takes a `privacy` flag deciding whether the
    requested sites/devices are screened against device-registry, which knows
    which of them are marked private.

    privacy=True   the list is sent to device-registry and entries it reports
                   as private are dropped; if the registry is unreachable or
                   returns an error the request gets a 503, so a screened
                   endpoint never serves an unscreened list.
    privacy=False  the list is used as requested and device-registry is not
                   called, so its availability has no bearing on the request.

    Both settings are covered explicitly below, and the service-wiring tests
    assert only that a service states the flag rather than which value it
    states — so the suite holds whichever way a path is wired, and none of it
    rides on the parameter's default.
    """

    def _bq(self, sample_df):
        meta = {"total_count": 2, "has_more": False, "next": None}
        return patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        )

    # -- Each request path states the flag rather than inheriting it ---------

    @pytest.mark.asyncio
    async def test_data_download_states_privacy_explicitly(
        self, export_request, sample_df, privacy_kwarg
    ):
        with self._bq(sample_df) as mock_bq:
            await DataExportService().export_data(export_request)

        assert privacy_kwarg == [{"privacy": ANY}]
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"sites": ["site1", "site2"]}

    @pytest.mark.asyncio
    async def test_raw_data_states_privacy_explicitly(
        self, raw_request, sample_df, privacy_kwarg
    ):
        with self._bq(sample_df) as mock_bq:
            await DataExportService().export_raw_data(raw_request)

        assert privacy_kwarg == [{"privacy": ANY}]
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"sites": ["site1"]}

    # -- Both flag settings, always passed explicitly ------------------------

    @pytest.mark.asyncio
    async def test_privacy_false_uses_the_list_as_requested(self):
        """device-registry is not called, so what it would have returned —
        here an unreachable registry — makes no difference."""
        from api.services import _filter_from_request

        with patch(
            "api.services.filter_non_private_sites_devices", return_value=None
        ) as mock_filter:
            filter_type, filter_value = await _filter_from_request(
                {"sites": ["site1", "site2"]}, privacy=False
            )

        mock_filter.assert_not_called()
        assert (filter_type, filter_value) == ("sites", ["site1", "site2"])

    @pytest.mark.asyncio
    async def test_privacy_true_drops_private_ids(self):
        """Entries device-registry reports as private are left out of the
        list the query runs against."""
        from api.services import _filter_from_request

        with patch(
            "api.services.filter_non_private_sites_devices",
            return_value={"status": "success", "data": ["site1"]},
        ) as mock_filter:
            filter_type, filter_value = await _filter_from_request(
                {"sites": ["site1", "site2"]}, privacy=True
            )

        mock_filter.assert_called_once_with("sites", ["site1", "site2"])
        assert (filter_type, filter_value) == ("sites", ["site1"])

    @pytest.mark.asyncio
    async def test_privacy_true_returns_503_when_registry_unreachable(self):
        """The helper swallows transport errors and returns None; with
        screening requested there is no screened list to serve, so 503."""
        from api.services import _filter_from_request

        with patch("api.services.filter_non_private_sites_devices", return_value=None):
            with pytest.raises(HTTPException) as exc:
                await _filter_from_request({"sites": ["site1"]}, privacy=True)
        assert exc.value.status_code == 503

    @pytest.mark.asyncio
    async def test_privacy_true_returns_503_on_registry_error_status(self):
        from api.services import _filter_from_request

        with patch(
            "api.services.filter_non_private_sites_devices",
            return_value={"status": "error", "message": "registry down"},
        ):
            with pytest.raises(HTTPException) as exc:
                await _filter_from_request({"sites": ["site1"]}, privacy=True)
        assert exc.value.status_code == 503

    @pytest.mark.asyncio
    async def test_grid_ids_filter_bypasses_privacy_check(
        self, valid_export_payload, sample_df
    ):
        """grid_ids is not in _PRIVACY_FILTERED_TYPES, so it is used as
        requested even under privacy=True: device-registry screens site and
        device IDs, not the containers that resolve to them, and a grid
        resolves to sites.  Screening grids would need a device-registry
        endpoint that accepts them."""
        from api.schemas.requests import DataExportRequest

        request = DataExportRequest(
            **{**valid_export_payload, "sites": None, "grid_ids": ["g1"]}
        )
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.filter_non_private_sites_devices"
        ) as mock_filter, patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            await svc.export_data(request)

        mock_filter.assert_not_called()
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"grid_ids": ["g1"]}

    @pytest.mark.asyncio
    async def test_cohort_ids_filter_bypasses_privacy_check(
        self, valid_export_payload, sample_df
    ):
        """cohort_ids is not in _PRIVACY_FILTERED_TYPES either, for the same
        reason as grid_ids — a cohort resolves to devices, and
        filterNonPrivateDevices accepts device IDs, not cohort IDs.  Screening
        cohorts would mean expanding the cohort to its devices first, or a
        device-registry endpoint that accepts cohorts."""
        from api.schemas.requests import DataExportRequest

        request = DataExportRequest(
            **{**valid_export_payload, "sites": None, "cohort_ids": ["c1"]}
        )
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.filter_non_private_sites_devices"
        ) as mock_filter, patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            await svc.export_data(request)

        mock_filter.assert_not_called()
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"cohort_ids": ["c1"]}

    @pytest.mark.asyncio
    async def test_dashboard_chart_states_privacy_explicitly(
        self, dashboard_request, sample_df, privacy_kwarg
    ):
        """Chart endpoints have always set the flag at the call site rather
        than inheriting the default."""
        with self._bq(sample_df) as mock_bq:
            resp = await DashboardService().get_chart_data(dashboard_request)

        assert privacy_kwarg == [{"privacy": ANY}]
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"sites": ["site1"]}
        assert resp.status == "success"

    @pytest.mark.asyncio
    async def test_scheduled_export_states_privacy_explicitly(self, privacy_kwarg):
        """The Celery worker exports whatever filter_value the record holds,
        so the list is resolved here, at registration time."""
        from api.services import ExportRequestService

        with patch("api.services.DataExportModel") as mock_model_cls:
            await ExportRequestService().create(_scheduled_export_request())

        assert privacy_kwarg == [{"privacy": ANY}]
        record = mock_model_cls.return_value.create_request.call_args.args[0]
        assert record.filter_value == ["site1"]


# ---------------------------------------------------------------------------
# Grid / cohort parity across the request paths
#
# grid_ids and cohort_ids were added after the original sites/device filters.
# The three services that accept a BaseFilterRequest must treat them
# identically — same _filter_from_request call, same where_fields hand-off —
# so a filter type cannot work on data-download but quietly not on raw-data
# or the charts.  Query-level parity is pinned in
# tests/test_bigquery_api_methods.py::TestFilterParityAcrossRequestPaths.
# ---------------------------------------------------------------------------


class TestGridCohortParity:
    _EXPECTED = [("grid_ids", ["g1"]), ("cohort_ids", ["c1"])]

    def _bq(self, sample_df):
        meta = {"total_count": 2, "has_more": False, "next": None}
        return patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        )

    @pytest.mark.asyncio
    @pytest.mark.parametrize("filter_type,filter_value", _EXPECTED)
    async def test_data_download_forwards_filter(
        self, valid_export_payload, sample_df, filter_type, filter_value
    ):
        from api.schemas.requests import DataExportRequest

        request = DataExportRequest(
            **{**valid_export_payload, "sites": None, filter_type: filter_value}
        )
        with self._bq(sample_df) as mock_bq:
            await DataExportService().export_data(request)

        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {filter_type: filter_value}
        assert kwargs["dynamic_query"] is True

    @pytest.mark.asyncio
    @pytest.mark.parametrize("filter_type,filter_value", _EXPECTED)
    async def test_raw_data_forwards_filter(
        self, valid_raw_payload, sample_df, filter_type, filter_value
    ):
        """Raw data differs from data-download only in dynamic_query (raw
        pollutant columns vs averaged ones) — never in the filter."""
        from api.schemas.requests import RawDataExportRequest

        request = RawDataExportRequest(
            **{**valid_raw_payload, "sites": None, filter_type: filter_value}
        )
        with self._bq(sample_df) as mock_bq:
            await DataExportService().export_raw_data(request)

        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {filter_type: filter_value}
        assert kwargs["dynamic_query"] is False

    @pytest.mark.asyncio
    @pytest.mark.parametrize("filter_type,filter_value", _EXPECTED)
    async def test_chart_data_forwards_filter(
        self, valid_dashboard_payload, sample_df, filter_type, filter_value
    ):
        """Both /dashboard/chart/data and /dashboard/chart/d3/data route to
        get_chart_data, so this covers the pair."""
        from api.schemas.requests import DashboardChartRequest

        request = DashboardChartRequest(
            **{**valid_dashboard_payload, "sites": None, filter_type: filter_value}
        )
        with self._bq(sample_df) as mock_bq:
            await DashboardService().get_chart_data(request)

        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {filter_type: filter_value}

    @pytest.mark.asyncio
    async def test_scheduled_export_rejects_both_uniformly(self):
        """The Celery worker's data_export_query only handles sites/devices,
        so the schema refuses grids and cohorts together — the one path where
        they are deliberately NOT at parity with the others."""
        from pydantic import ValidationError
        from api.schemas.requests import ScheduledExportRequest

        for filter_type, filter_value in self._EXPECTED:
            payload = _scheduled_export_request().model_dump(by_alias=True)
            payload["sites"] = None
            payload[filter_type] = filter_value
            with pytest.raises(ValidationError, match="not yet supported"):
                ScheduledExportRequest(**payload)


# ---------------------------------------------------------------------------
# AirQoRequests retry budget (privacy checks run on the request path)
# ---------------------------------------------------------------------------


class TestAirQoRequestsRetryBudget:
    def test_retry_budget_is_settings_driven(self):
        """The old fixed total=5/backoff_factor=5 meant ~75s worst case on
        the download/raw request path — must now come from settings."""
        from api.utils.http import AirQoRequests

        with patch("api.utils.http.urllib3.PoolManager") as mock_pool:
            mock_pool.return_value.request.side_effect = RuntimeError("stop here")
            with pytest.raises(RuntimeError):
                AirQoRequests().request(
                    "devices/grids/filterNonPrivateSites",
                    body={"sites": ["s1"]},
                    method="post",
                )

        retry = mock_pool.call_args.kwargs["retries"]
        assert retry.total == 2  # test settings default
        assert retry.backoff_factor == 1.0


# ---------------------------------------------------------------------------
# ReportTemplateService
# ---------------------------------------------------------------------------


class TestReportTemplateService:
    def _create_request(self):
        from api.schemas.requests import ReportRequest

        return ReportRequest(
            userId="u1", reportName="march", reportBody={"sections": []}
        )

    @pytest.mark.asyncio
    async def test_create_default_rejects_duplicate_with_400(self):
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            mock_model_cls.return_value.default_template_exists.return_value = True
            with pytest.raises(HTTPException) as exc:
                await svc.create_default(self._create_request(), "airqo")

        assert exc.value.status_code == 400
        assert exc.value.detail == "A default template already exist"
        mock_model_cls.return_value.insert_default.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_default_success_envelope(self):
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            mock_model_cls.return_value.default_template_exists.return_value = False
            resp = await svc.create_default(self._create_request(), "airqo")

        assert resp == {
            "status": "success",
            "message": "Default Report Template Saved Successfully",
            "data": None,
            "metadata": None,
        }
        mock_model_cls.return_value.insert_default.assert_called_once_with(
            "u1", "march", {"sections": []}
        )
        mock_model_cls.assert_called_once_with("airqo")

    @pytest.mark.asyncio
    async def test_update_default_empty_body_returns_400_with_valid_keys(self):
        from api.schemas.requests import ReportUpdateRequest
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with pytest.raises(HTTPException) as exc:
            await svc.update_default(ReportUpdateRequest(), "airqo")

        assert exc.value.status_code == 400
        assert "['userId', 'reportName', 'reportBody']" in exc.value.detail

    @pytest.mark.asyncio
    async def test_update_maps_camel_case_to_snake_storage_keys(self):
        from api.schemas.requests import ReportUpdateRequest
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        request = ReportUpdateRequest(reportName="april", reportBody={"a": 1})
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            result = MagicMock(modified_count=1, matched_count=1)
            mock_model_cls.return_value.update_default.return_value = result
            resp = await svc.update_default(request, "airqo")

        assert resp["message"] == "default reporting template updated successfully"
        mock_model_cls.return_value.update_default.assert_called_once_with(
            {"report_name": "april", "report_body": {"a": 1}}
        )

    @pytest.mark.asyncio
    async def test_explicit_null_unsets_field(self):
        """Flask copied every present valid key including null — an explicit
        {"reportBody": null} must unset the field, not 400 as empty."""
        from api.schemas.requests import ReportUpdateRequest
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        request = ReportUpdateRequest.model_validate({"reportBody": None})
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            result = MagicMock(modified_count=1, matched_count=1)
            mock_model_cls.return_value.update_default.return_value = result
            resp = await svc.update_default(request, "airqo")

        assert resp["status"] == "success"
        mock_model_cls.return_value.update_default.assert_called_once_with(
            {"report_body": None}
        )

    @pytest.mark.asyncio
    async def test_update_matched_but_unmodified_still_202(self):
        """Flask treated matched_count > 0 as success even with no changes."""
        from api.schemas.requests import ReportUpdateRequest
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            result = MagicMock(modified_count=0, matched_count=1)
            mock_model_cls.return_value.update_by_name.return_value = result
            resp = await svc.update_monthly(
                "march", ReportUpdateRequest(reportBody={"a": 1}), "airqo"
            )
        assert resp["message"] == "report updated successfully"

    @pytest.mark.asyncio
    async def test_update_unmatched_returns_404(self):
        from api.schemas.requests import ReportUpdateRequest
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            result = MagicMock(modified_count=0, matched_count=0)
            mock_model_cls.return_value.update_by_name.return_value = result
            with pytest.raises(HTTPException) as exc:
                await svc.update_monthly(
                    "ghost", ReportUpdateRequest(reportBody={"a": 1}), "airqo"
                )
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_list_monthly_empty_returns_404(self):
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            mock_model_cls.return_value.list_for_user.return_value = []
            with pytest.raises(HTTPException) as exc:
                await svc.list_monthly("u1", "airqo")
        assert exc.value.status_code == 404
        assert exc.value.detail == "report(s) not found"

    @pytest.mark.asyncio
    async def test_delete_missing_returns_404(self):
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            mock_model_cls.return_value.delete_by_name.return_value = MagicMock(
                deleted_count=0
            )
            with pytest.raises(HTTPException) as exc:
                await svc.delete_monthly("ghost", "airqo")
        assert exc.value.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_success_message_includes_name(self):
        from api.services import ReportTemplateService

        svc = ReportTemplateService()
        with patch("api.services.ReportTemplateModel") as mock_model_cls:
            mock_model_cls.return_value.delete_by_name.return_value = MagicMock(
                deleted_count=1
            )
            resp = await svc.delete_monthly("march", "airqo")
        assert resp["message"] == "monthly report march deleted successfully"


# ---------------------------------------------------------------------------
# Oversized queries
#
# BigQuery refuses a job that would exceed maximum_bytes_billed while planning
# it, so nothing is scanned and nothing is billed. Surfacing that as a 500
# left the caller with BigQuery's raw byte counts and no idea what to change;
# it is a 400 naming the lever that actually moves the figure — the window.
# ---------------------------------------------------------------------------


class TestOversizedQueryHandling:
    _REJECTION = (
        "Query exceeded limit for bytes billed: 1073741824. "
        "5557452800 or higher required."
    )

    def _too_large(self):
        from api.utils.exceptions import QueryTooLarge

        return QueryTooLarge(limit_bytes=1073741824, required_bytes=5557452800)

    @pytest.mark.asyncio
    async def test_data_download_returns_400_not_500(self, export_request):
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=self._too_large(),
        ):
            with pytest.raises(HTTPException) as exc:
                await DataExportService().export_data(export_request)

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_message_names_the_window_and_the_sizes(self, export_request):
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=self._too_large(),
        ):
            with pytest.raises(HTTPException) as exc:
                await DataExportService().export_data(export_request)

        detail = exc.value.detail
        assert "date range is too large" in detail
        assert "5.2 GB" in detail and "1.0 GB" in detail
        # 5557452800 / 1073741824 rounds up to 6
        assert "6x" in detail
        assert "daily" in detail  # export_request is daily → frequency named

    @pytest.mark.asyncio
    async def test_fine_frequencies_are_offered_a_coarser_one(self, valid_raw_payload):
        """Suggesting "use daily instead" only helps below daily."""
        from api.schemas.requests import RawDataExportRequest

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=self._too_large(),
        ):
            with pytest.raises(HTTPException) as exc:
                await DataExportService().export_raw_data(
                    RawDataExportRequest(**valid_raw_payload)
                )

        assert "coarser frequency" in exc.value.detail

    @pytest.mark.asyncio
    async def test_chart_data_returns_400(self, dashboard_request):
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=self._too_large(),
        ):
            with pytest.raises(HTTPException) as exc:
                await DashboardService().get_chart_data(dashboard_request)

        assert exc.value.status_code == 400
        assert "date range is too large" in exc.value.detail

    @pytest.mark.asyncio
    async def test_unparseable_rejection_still_gives_actionable_advice(
        self, export_request
    ):
        """Without the byte figures there is no "Nx" to quote, but the
        instruction to shorten the range still stands."""
        from api.utils.exceptions import QueryTooLarge

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=QueryTooLarge(limit_bytes=1073741824),
        ):
            with pytest.raises(HTTPException) as exc:
                await DataExportService().export_data(export_request)

        assert exc.value.status_code == 400
        assert "Shorten the date range" in exc.value.detail
        assert "x," not in exc.value.detail  # no bogus "by about Nx"

    @pytest.mark.asyncio
    async def test_other_query_failures_are_still_500(self, export_request):
        """Only the size rejection is the caller's to fix."""
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=RuntimeError("connection reset"),
        ):
            with pytest.raises(HTTPException) as exc:
                await DataExportService().export_data(export_request)

        assert exc.value.status_code == 500


# ---------------------------------------------------------------------------
# Cohort reports and report cost handling
#
# Grid and cohort reports share one pipeline: membership resolves to sites for
# a grid and to devices for a cohort, and only the consolidated column the
# measurement query filters on differs. These pin that both kinds route to the
# right resolver/column, that an oversized window reaches the caller as an
# actionable 400, and that the three empty-ish outcomes stay distinct: an
# unresolvable entity is a 404, an empty window is a 200, and a refused query
# is neither.
# ---------------------------------------------------------------------------


class TestReportEntityPipeline:
    """The builders themselves: membership resolver and filter column."""

    def _frame(self):
        return pd.DataFrame(
            {
                "site_id": ["s1", "s1"],
                "timestamp": pd.to_datetime(["2024-01-01T00:00:00Z"] * 2),
                "site_name": ["A", "A"],
                "site_latitude": [0.3, 0.3],
                "site_longitude": [32.5, 32.5],
                "pm2_5_raw_value": [10.0, 12.0],
                "pm2_5_calibrated_value": [9.0, 11.0],
                "pm10_raw_value": [20.0, 22.0],
                "pm10_calibrated_value": [19.0, 21.0],
                "country": ["Uganda", "Uganda"],
                "region": ["Central", "Central"],
                "city": ["Kampala", "Kampala"],
                "county": ["Kampala", "Kampala"],
            }
        )

    def test_grid_report_filters_by_site_id(self):
        from api.models.base.data_processing import build_entity_report

        with patch(
            "api.models.base.data_processing.fetch_grid_sites",
            return_value=["s1", "s2"],
        ) as mock_resolve, patch(
            "api.models.base.data_processing.query_bigquery",
            return_value=self._frame(),
        ) as mock_query:
            resp = build_entity_report(
                "grid", "grid-1", datetime(2024, 1, 1), datetime(2024, 2, 1)
            )

        mock_resolve.assert_called_once_with("grid-1")
        assert mock_query.call_args.kwargs["id_column"] == "site_id"
        air = resp["airquality"]
        assert air["grid_id"] == "grid-1"
        assert air["sites"]["site_ids"] == ["s1", "s2"]
        assert air["sites"]["number_of_sites"] == 2

    def test_cohort_report_filters_by_device_id(self):
        from api.models.base.data_processing import build_entity_report

        with patch(
            "api.models.base.data_processing.fetch_cohort_devices",
            return_value=["d1", "d2", "d3"],
        ) as mock_resolve, patch(
            "api.models.base.data_processing.query_bigquery",
            return_value=self._frame(),
        ) as mock_query:
            resp = build_entity_report(
                "cohort", "cohort-1", datetime(2024, 1, 1), datetime(2024, 2, 1)
            )

        mock_resolve.assert_called_once_with("cohort-1")
        assert mock_query.call_args.kwargs["id_column"] == "device_id"
        air = resp["airquality"]
        assert air["cohort_id"] == "cohort-1"
        # Cohort membership is devices, so the response names them as such.
        assert air["devices"]["device_ids"] == ["d1", "d2", "d3"]
        assert air["devices"]["number_of_devices"] == 3
        assert "sites" not in air

    def test_empty_membership_raises_lookuperror(self):
        from api.models.base.data_processing import build_entity_report

        with patch(
            "api.models.base.data_processing.fetch_cohort_devices", return_value=[]
        ):
            with pytest.raises(LookupError, match="No device IDs"):
                build_entity_report(
                    "cohort", "cohort-1", datetime(2024, 1, 1), datetime(2024, 2, 1)
                )

    def test_no_data_window_is_a_success_not_a_lookuperror(self):
        """An unresolvable entity and an empty window are different answers.
        The entity resolved here, so the request was valid and the period is
        simply empty — a success body with the standard message, not a 404."""
        from api.models.base.data_processing import build_entity_report

        with patch(
            "api.models.base.data_processing.fetch_grid_sites",
            return_value=["s1", "s2"],
        ), patch("api.models.base.data_processing.query_bigquery", return_value=None):
            resp = build_entity_report(
                "grid", "grid-1", datetime(2024, 1, 1), datetime(2024, 2, 1)
            )

        air = resp["airquality"]
        assert air["status"] == "success"
        assert air["message"] == (
            "No data available for grid grid-1 for the selected period "
            "(2024-01-01 to 2024-02-01)."
        )
        # Membership resolved, so the caller still learns what was searched.
        assert air["grid_id"] == "grid-1"
        assert air["sites"]["site_ids"] == ["s1", "s2"]
        assert air["period"]["startTime"] == "2024-01-01T00:00:00"

    def test_no_data_report_carries_every_aggregate_key(self):
        """Empty lists rather than absent keys: a client iterating any
        aggregate must not have to check the key exists first. Pins
        _AGGREGATE_KEYS against what the populated path actually emits."""
        from api.models.base.data_processing import (
            _AGGREGATE_KEYS,
            build_entity_report,
            compute_pm_aggregates,
        )
        from api.utils.pollutants.report import results_to_dataframe

        populated = compute_pm_aggregates(results_to_dataframe(self._frame()))
        assert set(_AGGREGATE_KEYS) == set(populated["final_dict"])

        with patch(
            "api.models.base.data_processing.fetch_cohort_devices", return_value=["d1"]
        ), patch("api.models.base.data_processing.query_bigquery", return_value=None):
            resp = build_entity_report(
                "cohort", "cohort-1", datetime(2024, 1, 1), datetime(2024, 2, 1)
            )

        air = resp["airquality"]
        for key in _AGGREGATE_KEYS:
            assert air[key] == [], key

    def test_mixed_offset_timestamps_do_not_break_the_frame(self):
        """Reproduces the reported failure: "Tz-aware datetime.datetime cannot
        be converted to datetime64 unless utc=True". Rows carried per-site
        local offsets, which pandas cannot hold in one datetime64 column."""
        from api.utils.pollutants.report import results_to_dataframe

        frame = self._frame()
        frame["timestamp"] = [
            datetime(2024, 1, 1, 3, tzinfo=timezone(timedelta(hours=3))),
            datetime(2024, 1, 1, 1, tzinfo=timezone(timedelta(hours=1))),
        ]

        df = results_to_dataframe(frame)

        assert str(df["timestamp"].dt.tz) == "UTC"
        # Both rows are the same instant, so both land on the same UTC hour.
        assert df["hour"].tolist() == [0, 0]
        assert df["day"].tolist() == ["Monday", "Monday"]

    def test_window_cap_follows_max_query_days(self):
        from api.models.base.data_processing import validate_dates
        from config import settings

        over = datetime(2024, 1, 1), datetime(2024, 1, 1) + timedelta(
            days=settings.max_query_days + 1
        )
        with pytest.raises(ValueError, match="must not exceed"):
            validate_dates(*over)

    def test_frame_emptied_by_the_coordinate_filter_is_no_data(self):
        """Rows without coordinates cannot be aggregated by site. The emptiness
        check ran before that filter, so a frame it emptied was treated as a
        result and skipped the no-data answer."""
        from api.utils.pollutants.report import query_bigquery
        from unittest.mock import MagicMock
        import numpy as np

        no_coords = pd.DataFrame(
            {
                "site_id": ["s1", "s2"],
                "timestamp": pd.to_datetime(["2024-01-01T00:00:00Z"] * 2),
                "site_name": ["A", "B"],
                "site_latitude": [np.nan, np.nan],
                "site_longitude": [np.nan, np.nan],
                "pm2_5_raw_value": [10.0, 11.0],
                "pm2_5_calibrated_value": [9.0, 10.0],
                "pm10_raw_value": [20.0, 21.0],
                "pm10_calibrated_value": [19.0, 20.0],
                "country": ["Uganda"] * 2,
                "region": ["Central"] * 2,
                "city": ["Kampala"] * 2,
                "county": ["Kampala"] * 2,
            }
        )
        client = MagicMock()
        client.query.return_value.to_dataframe.return_value = no_coords

        with patch(
            "api.utils.pollutants.report.shared_bigquery_client", return_value=client
        ):
            result = query_bigquery(
                ["s1", "s2"], datetime(2024, 1, 1), datetime(2024, 2, 1)
            )

        assert result is None

    def test_membership_cost_rejection_is_not_a_missing_entity(self):
        """A lookup refused on cost must not read as "this grid has no sites" —
        it reaches the caller as the 400, like the measurement query."""
        from google.api_core.exceptions import Forbidden
        from api.utils.exceptions import QueryTooLarge
        from api.utils.pollutants.report import fetch_grid_sites
        from unittest.mock import MagicMock

        client = MagicMock()
        client.query.side_effect = Forbidden(
            "Query exceeded limit for bytes billed: 1073741824. "
            "5557452800 or higher required.",
            errors=[{"reason": "bytesBilledLimitExceeded"}],
        )
        with patch(
            "api.utils.pollutants.report.shared_bigquery_client", return_value=client
        ):
            with pytest.raises(QueryTooLarge):
                fetch_grid_sites("grid-1")

    def test_other_membership_failures_still_degrade_to_empty(self):
        from api.utils.pollutants.report import fetch_cohort_devices
        from unittest.mock import MagicMock

        client = MagicMock()
        client.query.side_effect = RuntimeError("transient")
        with patch(
            "api.utils.pollutants.report.shared_bigquery_client", return_value=client
        ):
            assert fetch_cohort_devices("cohort-1") == []
