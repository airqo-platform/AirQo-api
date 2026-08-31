"""
Unit tests for the service layer.

All external I/O (BigQuery, Redis) is mocked so these tests run without
any real infrastructure.  The conftest.py autouse fixtures patch cache;
BigQuery is patched per-test via unittest.mock.patch.
"""

from __future__ import annotations

import pytest
import pandas as pd
from unittest.mock import AsyncMock, MagicMock, patch

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
        assert "No data found" in resp.message

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
        so compute_airqloud_summary's groupby KeyError'd — every cohort
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
            airqloud="aq-1",
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
        assert "No data found for airqloud aq-1" in resp["message"]
        assert "2024-01-01T00:00:00Z" in resp["message"]


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
# GridReportService
# ---------------------------------------------------------------------------


def _grid_request():
    from api.schemas.requests import GridReportRequest

    return GridReportRequest(
        grid_id="grid-1",
        start_time="2024-01-01T00:00:00",
        end_time="2024-02-01T00:00:00",
    )


class TestGridReportService:
    @pytest.mark.asyncio
    async def test_get_report_success(self):
        from api.services import GridReportService

        report = {"airquality": {"status": "success", "grid_id": "grid-1"}}
        svc = GridReportService()

        with patch("api.services.build_grid_report", return_value=report) as mock_build:
            resp = await svc.get_report(_grid_request())

        assert resp == report
        args = mock_build.call_args.args
        assert args[0] == "grid-1"

    @pytest.mark.asyncio
    async def test_get_diurnal_report_success(self):
        from api.services import GridReportService

        report = {"airquality": {"status": "success", "diurnal": []}}
        svc = GridReportService()

        with patch("api.services.build_grid_diurnal_report", return_value=report):
            resp = await svc.get_diurnal_report(_grid_request())

        assert resp == report

    @pytest.mark.asyncio
    async def test_no_sites_maps_to_404(self):
        from api.services import GridReportService

        svc = GridReportService()
        with patch(
            "api.services.build_grid_report",
            side_effect=LookupError("No site IDs found for the given parameters."),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.get_report(_grid_request())

        assert exc.value.status_code == 404
        assert "No site IDs" in exc.value.detail

    @pytest.mark.asyncio
    async def test_invalid_dates_map_to_400(self):
        from api.services import GridReportService

        svc = GridReportService()
        with patch(
            "api.services.build_grid_report",
            side_effect=ValueError("Time range exceeded 12 months."),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.get_report(_grid_request())

        assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_unexpected_error_maps_to_sanitized_500(self):
        from api.services import GridReportService

        svc = GridReportService()
        with patch(
            "api.services.build_grid_report",
            side_effect=RuntimeError("bigquery exploded: secret detail"),
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.get_report(_grid_request())

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
    """The device-registry privacy check must run for sites/device filters
    on every service that queries by filter, and must fail closed: a
    transport failure or error response yields 503, never unfiltered data.
    """

    @pytest.mark.asyncio
    async def test_filtered_list_reaches_bigquery(self, export_request, sample_df):
        """Private IDs stripped by device-registry never reach the query."""
        svc = DataExportService()
        meta = {"total_count": 2, "has_more": False, "next": None}

        with patch(
            "api.services.filter_non_private_sites_devices",
            return_value={"status": "success", "data": ["site1"]},
        ) as mock_filter, patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ) as mock_bq:
            await svc.export_data(export_request)

        mock_filter.assert_called_once_with("sites", ["site1", "site2"])
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"sites": ["site1"]}

    @pytest.mark.asyncio
    async def test_transport_failure_fails_closed_with_503(self, export_request):
        """The helper swallows transport errors and returns None."""
        svc = DataExportService()
        with patch("api.services.filter_non_private_sites_devices", return_value=None):
            with pytest.raises(HTTPException) as exc:
                await svc.export_data(export_request)
        assert exc.value.status_code == 503

    @pytest.mark.asyncio
    async def test_error_status_fails_closed_with_503(self, export_request):
        svc = DataExportService()
        with patch(
            "api.services.filter_non_private_sites_devices",
            return_value={"status": "error", "message": "registry down"},
        ):
            with pytest.raises(HTTPException) as exc:
                await svc.export_data(export_request)
        assert exc.value.status_code == 503

    @pytest.mark.asyncio
    async def test_grid_ids_filter_bypasses_privacy_check(
        self, valid_export_payload, sample_df
    ):
        """grid_ids has no filterNonPrivate counterpart, so it passes through
        unscreened. That is a known gap: a grid resolves to the same sites, so
        a caller refused private data via `sites` can still reach it via the
        containing grid. Closing it needs a device-registry endpoint that can
        screen grids; until then this test documents the behaviour rather than
        endorsing it."""
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
    async def test_dashboard_chart_bypasses_privacy_filter(
        self, dashboard_request, sample_df
    ):
        """Chart endpoints are deliberately NOT privacy-filtered (user
        decision) — a registry outage must not affect them."""
        svc = DashboardService()
        meta = {"total_count": 2, "has_more": False, "next": None}
        with patch(
            "api.services.filter_non_private_sites_devices"
        ) as mock_filter, patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = await svc.get_chart_data(dashboard_request)

        mock_filter.assert_not_called()
        assert resp.status == "success"

    @pytest.mark.asyncio
    async def test_scheduled_export_fails_closed_with_503(self):
        from api.services import ExportRequestService

        svc = ExportRequestService()
        with patch(
            "api.services.filter_non_private_sites_devices", return_value=None
        ), patch("api.services.DataExportModel") as mock_model_cls:
            with pytest.raises(HTTPException) as exc:
                await svc.create(_scheduled_export_request())

        assert exc.value.status_code == 503
        mock_model_cls.return_value.create_request.assert_not_called()

    @pytest.mark.asyncio
    async def test_scheduled_export_stores_filtered_list(self):
        from api.services import ExportRequestService

        svc = ExportRequestService()
        with patch(
            "api.services.filter_non_private_sites_devices",
            return_value={"status": "success", "data": []},
        ), patch("api.services.DataExportModel") as mock_model_cls:
            await svc.create(_scheduled_export_request())

        record = mock_model_cls.return_value.create_request.call_args.args[0]
        assert record.filter_value == []


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
