"""
Integration tests for API endpoints.

Uses the FastAPI TestClient with mocked service layer so no real
BigQuery or Redis calls are made.  conftest.py (autouse) handles
cache patching.
"""

import pytest
from unittest.mock import ANY, AsyncMock, patch
from fastapi.testclient import TestClient

from api.schemas.responses import (
    DataExportResponse,
    DashboardChartResponse,
    MonitoringSiteResponse,
    SiteInfo,
)

# client and payload fixtures are provided by conftest.py


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


class TestHealth:
    def test_health_returns_healthy(self, client: TestClient):
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "healthy"
        assert "version" in body


# ---------------------------------------------------------------------------
# V2 data endpoints
# ---------------------------------------------------------------------------


def _ok_export() -> DataExportResponse:
    return DataExportResponse(
        status="success",
        message="Data exported successfully",
        data=[{"datetime": "2023-01-01T12:00:00Z", "pm2_5": 15.5, "site_id": "site1"}],
    )


class TestV2DataEndpoints:
    def test_data_download_200(self, client, valid_export_payload):
        with patch(
            "api.services.DataExportService.export_data",
            new_callable=AsyncMock,
            return_value=_ok_export(),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "success"

    def test_raw_data_200(self, client, valid_raw_payload):
        with patch(
            "api.services.DataExportService.export_raw_data",
            new_callable=AsyncMock,
            return_value=_ok_export(),
        ):
            resp = client.post("/api/v2/analytics/raw-data", json=valid_raw_payload)
        assert resp.status_code == 200

    def test_data_export_route_removed(self, client, valid_export_payload):
        """/data/export never existed in the Flask API — dropped for cutover parity."""
        resp = client.post("/api/v2/analytics/data/export", json=valid_export_payload)
        assert resp.status_code == 404

    def test_data_summary_200(self, client):
        """Flask wire contract: startDateTime/endDateTime + one of
        grid/cohort → completeness-report envelope."""
        envelope = {
            "status": "success",
            "message": "successful",
            "data": {"grid": "Kampala Grid", "hourly_records": 100},
            "metadata": None,
        }
        with patch(
            "api.services.DataExportService.get_summary",
            new_callable=AsyncMock,
            return_value=envelope,
        ):
            resp = client.post(
                "/api/v2/analytics/data/summary",
                json={
                    "startDateTime": "2024-01-01T00:00:00",
                    "endDateTime": "2024-01-05T00:00:00",
                    "grid": "grid-1",
                },
            )
        assert resp.status_code == 200
        assert resp.json()["data"]["grid"] == "Kampala Grid"

    def test_data_summary_requires_exactly_one_entity(self, client):
        base = {
            "startDateTime": "2024-01-01T00:00:00",
            "endDateTime": "2024-01-05T00:00:00",
        }
        # none provided
        resp = client.post("/api/v2/analytics/data/summary", json=base)
        assert resp.status_code == 422
        # two provided
        resp = client.post(
            "/api/v2/analytics/data/summary",
            json={**base, "grid": "g1", "cohort": "c1"},
        )
        assert resp.status_code == 422

    def test_missing_required_fields_returns_422(self, client):
        resp = client.post("/api/v2/analytics/data-download", json={"network": "airqo"})
        assert resp.status_code == 422

    def test_422_uses_error_envelope(self, client):
        """Regression: the 422 handler was registered for pydantic's
        ValidationError, which FastAPI never raises for request bodies —
        clients silently got the default {"detail": [...]} shape instead."""
        resp = client.post("/api/v2/analytics/data-download", json={"network": "airqo"})
        body = resp.json()
        assert body["status"] == "error"
        assert body["message"] == "Validation error"
        assert isinstance(body["errors"], list) and body["errors"]
        assert body["data"] is None and body["metadata"] is None
        assert "detail" not in body

    def test_unknown_route_404_uses_error_envelope(self, client):
        """Framework-raised (starlette) HTTPExceptions must get the same
        envelope as service-raised ones."""
        resp = client.get("/api/v2/analytics/nonexistent")
        assert resp.status_code == 404
        body = resp.json()
        assert body["status"] == "error"
        assert body["data"] is None and body["metadata"] is None
        assert "detail" not in body

    def test_invalid_network_returns_422(self, client, valid_export_payload):
        resp = client.post(
            "/api/v2/analytics/data-download",
            json={**valid_export_payload, "network": "nonexistent"},
        )
        assert resp.status_code == 422

    def test_end_before_start_returns_422(self, client, valid_export_payload):
        resp = client.post(
            "/api/v2/analytics/data-download",
            json={
                **valid_export_payload,
                "startDateTime": valid_export_payload["endDateTime"],
                "endDateTime": valid_export_payload["startDateTime"],
            },
        )
        assert resp.status_code == 422

    def test_two_filters_returns_422(self, client, valid_export_payload):
        resp = client.post(
            "/api/v2/analytics/data-download",
            json={**valid_export_payload, "device_ids": ["d1"]},
        )
        assert resp.status_code == 422

    def test_sql_injection_site_id_does_not_cause_500(
        self, client, valid_export_payload
    ):
        """SQL content in site_id must be sanitised at the BigQuery layer — must not 500."""
        with patch(
            "api.services.DataExportService.export_data",
            new_callable=AsyncMock,
            return_value=DataExportResponse(status="success", data=[]),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download",
                json={
                    **valid_export_payload,
                    "sites": ["site1'; DROP TABLE sites; --"],
                },
            )
        assert resp.status_code != 500

    def test_service_http_error_propagates_safely(self, client, valid_export_payload):
        """HTTPException from service must return safe message without internal details."""
        from fastapi import HTTPException as FHE

        with patch(
            "api.services.DataExportService.export_data",
            new_callable=AsyncMock,
            side_effect=FHE(status_code=500, detail="Failed to retrieve data"),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )
        assert resp.status_code == 500
        body = resp.json()
        msg = body.get("message", body.get("detail", ""))
        assert "Failed to retrieve data" in msg
        assert "BigQuery" not in str(body)
        assert "SQL" not in str(body)


# ---------------------------------------------------------------------------
# V2 dashboard endpoints
# ---------------------------------------------------------------------------


class TestV2DashboardEndpoints:
    def test_chart_data_200(self, client, valid_dashboard_payload):
        with patch(
            "api.services.DashboardService.get_chart_data",
            new_callable=AsyncMock,
            return_value=DashboardChartResponse(
                status="success",
                chart_type="line",
                data=[{"datetime": "2023-01-01", "pm2_5": 15.5}],
            ),
        ):
            resp = client.post(
                "/api/v2/analytics/dashboard/chart/data", json=valid_dashboard_payload
            )
        assert resp.status_code == 200
        assert resp.json()["chart_type"] == "line"

    def test_monitoring_sites_200(self, client):
        with patch(
            "api.services.MonitoringService.get_sites",
            new_callable=AsyncMock,
            return_value=MonitoringSiteResponse(
                status="success",
                sites=[SiteInfo(site_id="s1", name="Site A", network="airqo")],
                total_sites=1,
                networks=["airqo"],
            ),
        ):
            resp = client.get("/api/v2/analytics/dashboard/sites")
        assert resp.status_code == 200
        assert resp.json()["total_sites"] == 1


# ---------------------------------------------------------------------------
# V2 report template endpoints (MongoDB-backed CRUD, Flask wire contract)
# ---------------------------------------------------------------------------


class TestV2ReportEndpoints:
    _BODY = {"userId": "u1", "reportName": "march", "reportBody": {"k": "v"}}

    def _svc(self, method, **kwargs):
        return patch(
            f"api.services.ReportTemplateService.{method}",
            new_callable=AsyncMock,
            **kwargs,
        )

    def test_create_default_returns_201(self, client):
        envelope = {
            "status": "success",
            "message": "Default Report Template Saved Successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("create_default", return_value=envelope) as mock_svc:
            resp = client.post(
                "/api/v2/analytics/report/default_template", json=self._BODY
            )
        assert resp.status_code == 201
        assert resp.json()["message"] == "Default Report Template Saved Successfully"
        assert mock_svc.call_args.args[1] == "airqo"  # default network

    def test_create_default_missing_fields_returns_422(self, client):
        resp = client.post(
            "/api/v2/analytics/report/default_template", json={"userId": "u1"}
        )
        assert resp.status_code == 422

    def test_get_default_returns_200(self, client):
        envelope = {
            "status": "success",
            "message": "default report successfully fetched",
            "data": {"report": {}},
            "metadata": None,
        }
        with self._svc("get_default", return_value=envelope):
            resp = client.get("/api/v2/analytics/report/default_template")
        assert resp.status_code == 200
        assert resp.json()["data"] == {"report": {}}

    def test_patch_default_returns_202(self, client):
        envelope = {
            "status": "success",
            "message": "default reporting template updated successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("update_default", return_value=envelope):
            resp = client.patch(
                "/api/v2/analytics/report/default_template",
                json={"reportName": "new-name"},
            )
        assert resp.status_code == 202

    def test_create_monthly_returns_201(self, client):
        envelope = {
            "status": "success",
            "message": "Monthly Report Saved Successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("create_monthly", return_value=envelope):
            resp = client.post("/api/v2/analytics/report/monthly", json=self._BODY)
        assert resp.status_code == 201

    def test_list_monthly_requires_user_id(self, client):
        resp = client.get("/api/v2/analytics/report/monthly")
        assert resp.status_code == 422

    def test_list_monthly_returns_200(self, client):
        envelope = {
            "status": "success",
            "message": "reports successfully fetched",
            "data": {"reports": [{"report_name": "march"}]},
            "metadata": None,
        }
        with self._svc("list_monthly", return_value=envelope) as mock_svc:
            resp = client.get("/api/v2/analytics/report/monthly?userId=u1")
        assert resp.status_code == 200
        assert resp.json()["data"]["reports"][0]["report_name"] == "march"
        assert mock_svc.call_args.args[0] == "u1"

    def test_update_monthly_by_name_uses_post(self, client):
        """The original Flask API bound updates to POST — verb preserved."""
        envelope = {
            "status": "success",
            "message": "report updated successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("update_monthly", return_value=envelope) as mock_svc:
            resp = client.post(
                "/api/v2/analytics/report/monthly/march",
                json={"reportBody": {"k2": "v2"}},
            )
        assert resp.status_code == 202
        assert mock_svc.call_args.args[0] == "march"

    def test_delete_monthly_returns_200(self, client):
        envelope = {
            "status": "success",
            "message": "monthly report march deleted successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("delete_monthly", return_value=envelope):
            resp = client.delete("/api/v2/analytics/report/monthly/march")
        assert resp.status_code == 200

    def test_no_get_on_named_monthly_report(self, client):
        """The Flask API never had GET /report/monthly/{name} — the old 501
        stub advertising one was wrong and must stay gone."""
        resp = client.get("/api/v2/analytics/report/monthly/march")
        assert resp.status_code == 405


# ---------------------------------------------------------------------------
# V3 public endpoints
# ---------------------------------------------------------------------------


class TestV3Endpoints:
    def test_data_download_200(self, client, valid_export_payload):
        with patch(
            "api.services.DataExportService.export_data",
            new_callable=AsyncMock,
            return_value=DataExportResponse(status="success", data=[{"pm2_5": 10.0}]),
        ):
            resp = client.post(
                "/api/v3/public/analytics/data-download", json=valid_export_payload
            )
        assert resp.status_code == 200

    def test_raw_data_200(self, client, valid_raw_payload):
        with patch(
            "api.services.DataExportService.export_raw_data",
            new_callable=AsyncMock,
            return_value=DataExportResponse(status="success", data=[]),
        ):
            resp = client.post(
                "/api/v3/public/analytics/raw-data", json=valid_raw_payload
            )
        assert resp.status_code == 200

    def test_missing_fields_returns_422(self, client):
        resp = client.post(
            "/api/v3/public/analytics/data-download", json={"network": "airqo"}
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Dashboard historical aggregations (Flask wire shapes)
# ---------------------------------------------------------------------------


class TestDashboardAggregationEndpoints:
    _WINDOW = {
        "startDate": "2024-01-01T00:00:00.000000Z",
        "endDate": "2024-02-01T00:00:00.000000Z",
    }

    def _averages_response(self):
        from api.schemas.responses import DailyAveragesData, DailyAveragesResponse

        return DailyAveragesResponse(
            status="success",
            message="daily averages successfully fetched",
            data=DailyAveragesData(
                average_values=[10.5], labels=["Kampala"], background_colors=["#45e50d"]
            ),
        )

    def _exceedances_response(self):
        from api.schemas.responses import ExceedancesResponse

        return ExceedancesResponse(
            status="success",
            message="exceedance data successfully fetched",
            data=[{"total": 20, "exceedance": 3, "site": {"name": "Kampala"}}],
        )

    def test_daily_averages_envelope_includes_null_metadata(self, client):
        """Flask's create_response always emits "metadata": null — preserve."""
        with patch(
            "api.services.DashboardService.get_daily_averages",
            new_callable=AsyncMock,
            return_value=self._averages_response(),
        ):
            resp = client.post(
                "/api/v2/analytics/dashboard/historical/daily-averages",
                json={"pollutant": "pm2_5", "sites": ["s1"], **self._WINDOW},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == {
            "average_values": [10.5],
            "labels": ["Kampala"],
            "background_colors": ["#45e50d"],
        }
        assert "metadata" in body and body["metadata"] is None

    def test_daily_averages_default_network_reaches_service(self, client):
        with patch(
            "api.services.DashboardService.get_daily_averages",
            new_callable=AsyncMock,
            return_value=self._averages_response(),
        ) as mock_svc:
            client.post(
                "/api/v2/analytics/dashboard/historical/daily-averages",
                json={"pollutant": "pm2_5", "sites": ["s1"], **self._WINDOW},
            )
        assert mock_svc.call_args.args[1] == "airqo"

    def test_daily_averages_devices_uses_network_param(self, client):
        """?network= replaced the deprecated ?tenant= across all v2 routes."""
        with patch(
            "api.services.DashboardService.get_device_daily_averages",
            new_callable=AsyncMock,
            return_value=self._averages_response(),
        ) as mock_svc:
            resp = client.post(
                "/api/v2/analytics/dashboard/historical/daily-averages-devices"
                "?network=iqair",
                json={"pollutant": "pm2_5", "devices": ["d1"], **self._WINDOW},
            )
        assert resp.status_code == 200
        assert mock_svc.call_args.args[1] == "iqair"

    def test_exceedances_200(self, client):
        with patch(
            "api.services.DashboardService.get_exceedances",
            new_callable=AsyncMock,
            return_value=self._exceedances_response(),
        ):
            resp = client.post(
                "/api/v2/analytics/dashboard/exceedances?network=airqo",
                json={
                    "pollutant": "pm2_5",
                    "standard": "aqi",
                    "sites": ["s1"],
                    **self._WINDOW,
                },
            )
        assert resp.status_code == 200
        assert resp.json()["data"][0]["exceedance"] == 3

    def test_exceedances_missing_standard_returns_422(self, client):
        resp = client.post(
            "/api/v2/analytics/dashboard/exceedances",
            json={"pollutant": "pm2_5", "sites": ["s1"], **self._WINDOW},
        )
        assert resp.status_code == 422

    def test_exceedances_devices_200(self, client):
        from api.schemas.responses import ExceedancesResponse

        with patch(
            "api.services.DashboardService.get_device_exceedances",
            new_callable=AsyncMock,
            return_value=ExceedancesResponse(
                status="success",
                message="exceedance data successfully fetched",
                data=[{"device_id": "d1", "total": 2, "exceedances": {"Good": 2}}],
            ),
        ):
            resp = client.post(
                "/api/v2/analytics/dashboard/exceedances-devices",
                json={
                    "pollutant": "pm2_5",
                    "standard": "who",
                    "devices": ["d1"],
                    **self._WINDOW,
                },
            )
        assert resp.status_code == 200
        assert resp.json()["data"][0]["exceedances"] == {"Good": 2}


# ---------------------------------------------------------------------------
# Privacy filtering wiring (route → service → device-registry helper)
# ---------------------------------------------------------------------------


class TestPrivacyFilteringWiring:
    """End-to-end view of the privacy flag on the request path (not just in
    service unit tests), for both API versions.  Asserts that the flag is
    stated at the call site rather than which value it is set to — the flag's
    own behaviour is covered on both settings in
    tests/test_services.py::TestPrivacyFiltering."""

    def _patched_bq(self, sample_df):
        meta = {"total_count": 2, "has_more": False, "next": None}
        return patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        )

    @pytest.mark.parametrize(
        "path",
        [
            "/api/v2/analytics/data-download",
            "/api/v3/public/analytics/data-download",
        ],
    )
    def test_data_download_states_privacy_explicitly(
        self, client, valid_export_payload, sample_df, path, privacy_kwarg
    ):
        """Both versions share DataExportService, so both reach the flag the
        same way."""
        with self._patched_bq(sample_df) as mock_bq:
            resp = client.post(path, json=valid_export_payload)

        assert resp.status_code == 200
        assert privacy_kwarg == [{"privacy": ANY}]
        _, kwargs = mock_bq.call_args
        assert kwargs["where_fields"] == {"sites": ["site1", "site2"]}


# ---------------------------------------------------------------------------
# V3 forecast-data
# ---------------------------------------------------------------------------


class TestV3ForecastEndpoint:
    def _payload(self, **extra):
        from datetime import datetime, timedelta, timezone

        start = (datetime.now(tz=timezone.utc) - timedelta(days=2)).isoformat()
        end = datetime.now(tz=timezone.utc).isoformat()
        return {"startDateTime": start, "endDateTime": end, **extra}

    def test_forecast_by_country_200(self, client):
        with patch(
            "api.services.DataExportService.export_forecast_data",
            new_callable=AsyncMock,
            return_value=DataExportResponse(
                status="success",
                data=[{"pm2_5": 12.1, "country": "uganda"}],
            ),
        ):
            resp = client.post(
                "/api/v3/public/analytics/forecast-data",
                json=self._payload(country="uganda"),
            )
        assert resp.status_code == 200
        # The record count lives only in metadata.total_count now.
        assert "total_records" not in resp.json()

    def test_forecast_by_city_200(self, client):
        with patch(
            "api.services.DataExportService.export_forecast_data",
            new_callable=AsyncMock,
            return_value=DataExportResponse(status="success", data=[]),
        ):
            resp = client.post(
                "/api/v3/public/analytics/forecast-data",
                json=self._payload(city="kampala"),
            )
        assert resp.status_code == 200

    def test_forecast_without_country_or_city_returns_422(self, client):
        resp = client.post(
            "/api/v3/public/analytics/forecast-data", json=self._payload()
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# CSV download
# ---------------------------------------------------------------------------


class TestCsvDownload:
    def test_csv_download_type_returns_csv_attachment(
        self, client, valid_export_payload, sample_df
    ):
        """downloadType=csv must return a text/csv attachment, not JSON."""
        meta = {"total_count": 2, "has_more": False, "next": None}
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download",
                json={**valid_export_payload, "downloadType": "csv"},
            )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert "pm2_5" in resp.text  # header row present

    def test_json_download_type_still_returns_json(
        self, client, valid_export_payload, sample_df
    ):
        meta = {"total_count": 2, "has_more": False, "next": None}
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(sample_df, meta),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("application/json")
        assert resp.json()["metadata"]["total_count"] == 2


# ---------------------------------------------------------------------------
# Observability & middleware
# ---------------------------------------------------------------------------


class TestObservability:
    def test_response_carries_request_id_header(self, client):
        resp = client.get("/health")
        assert "x-request-id" in resp.headers
        assert len(resp.headers["x-request-id"]) >= 8

    def test_inbound_request_id_is_propagated(self, client):
        resp = client.get("/health", headers={"X-Request-ID": "gateway-abc-123"})
        assert resp.headers["x-request-id"] == "gateway-abc-123"

    def test_readiness_returns_200_when_cache_ok(self, client):
        resp = client.get("/health/ready")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ready"
        assert body["checks"]["redis"] is True


# ---------------------------------------------------------------------------
# Grid report endpoints
# ---------------------------------------------------------------------------


class TestGridReportEndpoints:
    _payload = {
        "grid_id": "grid-1",
        "start_time": "2024-01-01T00:00:00",
        "end_time": "2024-02-01T00:00:00",
    }

    def test_grid_report_200(self, client):
        report = {"airquality": {"status": "success", "grid_id": "grid-1"}}
        with patch(
            "api.services.GridReportService.get_report",
            new_callable=AsyncMock,
            return_value=report,
        ):
            resp = client.post("/api/v2/analytics/grid/report", json=self._payload)
        assert resp.status_code == 200
        assert resp.json()["airquality"]["grid_id"] == "grid-1"

    def test_grid_report_diurnal_200(self, client):
        report = {"airquality": {"status": "success", "diurnal": []}}
        with patch(
            "api.services.GridReportService.get_diurnal_report",
            new_callable=AsyncMock,
            return_value=report,
        ):
            resp = client.post(
                "/api/v2/analytics/grid/report/diurnal", json=self._payload
            )
        assert resp.status_code == 200

    def test_equal_dates_returns_422(self, client):
        resp = client.post(
            "/api/v2/analytics/grid/report",
            json={**self._payload, "end_time": self._payload["start_time"]},
        )
        assert resp.status_code == 422

    def test_missing_grid_id_returns_422(self, client):
        payload = {k: v for k, v in self._payload.items() if k != "grid_id"}
        resp = client.post("/api/v2/analytics/grid/report", json=payload)
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Scheduled export endpoints (MongoDB-backed)
# ---------------------------------------------------------------------------


class TestScheduledExportEndpoints:
    def _payload(self, valid_export_payload):
        return {
            **valid_export_payload,
            "userId": "user-1",
            "frequency": "hourly",
            "exportFormat": "csv",
        }

    def test_create_returns_201(self, client, valid_export_payload):
        with patch(
            "api.services.ExportRequestService.create",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": {"user_id": "user-1"}},
        ):
            resp = client.post(
                "/api/v2/analytics/data-export",
                json=self._payload(valid_export_payload),
            )
        assert resp.status_code == 201
        assert resp.json()["status"] == "success"

    def test_create_missing_user_id_returns_422(self, client, valid_export_payload):
        payload = self._payload(valid_export_payload)
        del payload["userId"]
        resp = client.post("/api/v2/analytics/data-export", json=payload)
        assert resp.status_code == 422

    def test_list_requires_user_id(self, client):
        resp = client.get("/api/v2/analytics/data-export")
        assert resp.status_code == 422

    def test_list_returns_200(self, client):
        with patch(
            "api.services.ExportRequestService.list_for_user",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": []},
        ):
            resp = client.get(
                "/api/v2/analytics/data-export", params={"userId": "user-1"}
            )
        assert resp.status_code == 200

    def test_patch_requires_request_id(self, client):
        resp = client.patch("/api/v2/analytics/data-export")
        assert resp.status_code == 422

    def test_patch_returns_200(self, client):
        with patch(
            "api.services.ExportRequestService.retry",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": {"request_id": "r1"}},
        ):
            resp = client.patch(
                "/api/v2/analytics/data-export", params={"requestId": "r1"}
            )
        assert resp.status_code == 200

    def test_create_rejects_user_id_with_path_separator(
        self, client, valid_export_payload
    ):
        """user_id reaches a GCS blob path and a BigQuery table name — a '/'
        would let a caller write outside their own export folder."""
        payload = self._payload(valid_export_payload)
        payload["userId"] = "../../other-user"
        resp = client.post("/api/v2/analytics/data-export", json=payload)
        assert resp.status_code == 422

    def test_create_rejects_user_id_with_dot(self, client, valid_export_payload):
        """A dot re-parses the fully-qualified BigQuery table reference."""
        payload = self._payload(valid_export_payload)
        payload["userId"] = "proj.dataset"
        resp = client.post("/api/v2/analytics/data-export", json=payload)
        assert resp.status_code == 422


class TestGatewayIdentity:
    """Identity used to come straight from ?userId=, so any caller could read
    another user's export records and download links. See api/dependencies.py
    for the staged rollout this pins."""

    _HEADER = "X-User-Id"

    def test_header_overrides_query_param_when_they_agree(self, client):
        with patch(
            "api.services.ExportRequestService.list_for_user",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": []},
        ) as mock:
            resp = client.get(
                "/api/v2/analytics/data-export",
                params={"userId": "user-1"},
                headers={self._HEADER: "user-1"},
            )
        assert resp.status_code == 200
        mock.assert_awaited_once_with("user-1")

    def test_mismatched_user_id_is_forbidden(self, client):
        resp = client.get(
            "/api/v2/analytics/data-export",
            params={"userId": "victim"},
            headers={self._HEADER: "attacker"},
        )
        assert resp.status_code == 403

    def test_monthly_reports_honour_asserted_identity(self, client):
        resp = client.get(
            "/api/v2/analytics/report/monthly",
            params={"userId": "victim"},
            headers={self._HEADER: "attacker"},
        )
        assert resp.status_code == 403

    def test_falls_back_to_query_param_without_header(self, client):
        """Transition mode: unchanged behaviour while the gateway is wired up."""
        with patch(
            "api.services.ExportRequestService.list_for_user",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": []},
        ) as mock:
            resp = client.get(
                "/api/v2/analytics/data-export", params={"userId": "user-1"}
            )
        assert resp.status_code == 200
        mock.assert_awaited_once_with("user-1")

    def test_missing_identity_rejected_when_required(self, client, monkeypatch):
        from config import settings

        monkeypatch.setattr(settings, "require_gateway_identity", True)
        resp = client.get("/api/v2/analytics/data-export", params={"userId": "user-1"})
        assert resp.status_code == 401

    def test_retry_passes_caller_id_for_ownership_check(self, client):
        with patch(
            "api.services.ExportRequestService.retry",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": {"request_id": "r1"}},
        ) as mock:
            resp = client.patch(
                "/api/v2/analytics/data-export",
                params={"requestId": "r1"},
                headers={self._HEADER: "user-1"},
            )
        assert resp.status_code == 200
        mock.assert_awaited_once_with("r1", caller_id="user-1")

    def test_retry_caller_id_is_none_without_header(self, client):
        with patch(
            "api.services.ExportRequestService.retry",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": {"request_id": "r1"}},
        ) as mock:
            resp = client.patch(
                "/api/v2/analytics/data-export", params={"requestId": "r1"}
            )
        assert resp.status_code == 200
        mock.assert_awaited_once_with("r1", caller_id=None)


class TestMiddleware:
    def test_cors_middleware_present(self):
        from main import app

        middleware_names = [str(m) for m in app.user_middleware]
        assert any(
            "CORS" in n for n in middleware_names
        ), "CORSMiddleware should be configured"


# ---------------------------------------------------------------------------
# Response envelope contract
#
# Every response — success or error — carries the same four keys, so a client
# branches on `status` alone and always finds `message` populated.
# ---------------------------------------------------------------------------


class TestResponseEnvelopeContract:
    _ENVELOPE_KEYS = {"message", "status", "data", "metadata"}

    def test_oversized_query_is_a_400_error_envelope(
        self, client, valid_export_payload
    ):
        from api.utils.exceptions import QueryTooLarge

        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=QueryTooLarge(
                limit_bytes=1073741824, required_bytes=5557452800
            ),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )

        assert resp.status_code == 400
        body = resp.json()
        assert self._ENVELOPE_KEYS <= set(body)
        assert body["status"] == "error"
        assert body["data"] is None
        assert "date range is too large" in body["message"]

    def test_empty_result_is_a_200_success_envelope(
        self, client, valid_export_payload, empty_df
    ):
        """No data is not an error: the request was valid, the period simply
        holds no measurements."""
        meta = {"total_count": 0, "has_more": False, "next": None}
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(empty_df, meta),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )

        assert resp.status_code == 200
        body = resp.json()
        assert self._ENVELOPE_KEYS <= set(body)
        assert body["status"] == "success"
        assert body["data"] == []
        assert "No data available for the selected period" in body["message"]

    def test_unexpected_failure_is_a_500_error_envelope(
        self, client, valid_export_payload
    ):
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=RuntimeError("connection reset"),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )

        assert resp.status_code == 500
        body = resp.json()
        assert self._ENVELOPE_KEYS <= set(body)
        assert body["status"] == "error"
        # Internal detail must not leak to the caller
        assert "connection reset" not in body["message"]
