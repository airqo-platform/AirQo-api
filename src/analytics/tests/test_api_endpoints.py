"""
Integration tests for API endpoints.

Uses the FastAPI TestClient with mocked service layer so no real
BigQuery or Redis calls are made.  conftest.py (autouse) handles
cache patching.
"""

import pytest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from unittest.mock import ANY, AsyncMock, patch
from fastapi.testclient import TestClient

from api.schemas.responses import DataExportResponse

# client and payload fixtures are provided by conftest.py


# ---------------------------------------------------------------------------
# V2 data endpoints
# ---------------------------------------------------------------------------


class TestV2DataEndpoints:
    def test_data_summary_requires_exactly_one_entity(self, client):
        base = {
            "start_time": "2024-01-01T00:00:00",
            "end_time": "2024-01-05T00:00:00",
        }
        # none provided
        resp = client.post("/api/v2/analytics/summary", json=base)
        assert resp.status_code == 422
        # two provided
        resp = client.post(
            "/api/v2/analytics/summary",
            json={**base, "grid_id": "g1", "cohort_id": "c1"},
        )
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

    def test_sql_in_a_site_id_reaches_bigquery_only_as_a_bound_value(
        self, client, fake_bigquery
    ):
        """The export binds each site ID as a query parameter, so SQL text in
        an ID travels as data and stays out of the query text."""
        from tests.paging_support import WINDOW, device_frame

        injected = "site1'; DROP TABLE sites; --"
        fake_bigquery.result_frame = device_frame(2)

        resp = client.post(
            "/api/v2/analytics/data-download",
            json={
                **WINDOW,
                "sites": [injected],
                "pollutants": ["pm2_5"],
                "frequency": "hourly",
                "datatype": "calibrated",
            },
        )

        assert resp.status_code == 200
        (query,) = fake_bigquery.queries
        assert "DROP TABLE" not in query.sql
        bound = [p.values for p in query.job_config.query_parameters]
        assert [injected] in bound


# ---------------------------------------------------------------------------
# V2 dashboard endpoints
# ---------------------------------------------------------------------------


class TestV2DashboardEndpoints:
    def test_monitoring_sites_lists_the_sites_of_the_sites_table(
        self, client, fake_bigquery
    ):
        import pandas as pd

        fake_bigquery.result_frame = pd.DataFrame(
            {
                "id": ["s1", "s2"],
                "name": ["Site A", "Site B"],
                "latitude": [0.3, -1.29],
                "longitude": [32.5, 36.82],
                "city": ["Kampala", "Nairobi"],
                "country": ["Uganda", "Kenya"],
                "network": ["airqo", "iqair"],
            }
        )

        resp = client.get("/api/v2/analytics/dashboard/sites")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total_sites"] == 2
        assert [site["site_id"] for site in body["sites"]] == ["s1", "s2"]
        assert [site["latitude"] for site in body["sites"]] == [0.3, -1.29]
        assert body["networks"] == ["airqo", "iqair"]
        assert len(fake_bigquery.queries) == 1


# ---------------------------------------------------------------------------
# V2 report template endpoints (MongoDB-backed CRUD)
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
                "/api/v2/analytics/data/reports/default_template", json=self._BODY
            )
        assert resp.status_code == 201
        assert resp.json()["message"] == "Default Report Template Saved Successfully"
        assert mock_svc.call_args.args[1] == "airqo"  # default network

    def test_create_default_missing_fields_returns_422(self, client):
        resp = client.post(
            "/api/v2/analytics/data/reports/default_template", json={"userId": "u1"}
        )
        assert resp.status_code == 422

    def test_get_default_returns_the_stored_template(self, client):
        template = {"report_name": "default", "report_body": {"k": "v"}}
        with patch("api.services.ReportTemplateModel") as model_cls:
            model_cls.return_value.get_default.return_value = template
            resp = client.get("/api/v2/analytics/data/reports/default_template")

        assert resp.status_code == 200
        assert resp.json()["data"] == {"report": template}
        model_cls.assert_called_once_with("airqo")

    def test_get_default_store_failure_is_a_500(self, client):
        with patch("api.services.ReportTemplateModel") as model_cls:
            model_cls.return_value.get_default.side_effect = RuntimeError("down")
            resp = client.get("/api/v2/analytics/data/reports/default_template")

        assert resp.status_code == 500
        assert resp.json()["status"] == "error"

    def test_patch_default_returns_202(self, client):
        envelope = {
            "status": "success",
            "message": "default reporting template updated successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("update_default", return_value=envelope):
            resp = client.patch(
                "/api/v2/analytics/data/reports/default_template",
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
            resp = client.post(
                "/api/v2/analytics/data/reports/monthly", json=self._BODY
            )
        assert resp.status_code == 201

    def test_list_monthly_returns_200(self, client):
        envelope = {
            "status": "success",
            "message": "reports successfully fetched",
            "data": {"reports": [{"report_name": "march"}]},
            "metadata": None,
        }
        with self._svc("list_monthly", return_value=envelope) as mock_svc:
            resp = client.get("/api/v2/analytics/data/reports/monthly?userId=u1")
        assert resp.status_code == 200
        assert resp.json()["data"]["reports"][0]["report_name"] == "march"
        assert mock_svc.call_args.args[0] == "u1"

    def test_update_monthly_by_name_uses_post(self, client):
        """The route binds a monthly-report update to POST."""
        envelope = {
            "status": "success",
            "message": "report updated successfully",
            "data": None,
            "metadata": None,
        }
        with self._svc("update_monthly", return_value=envelope) as mock_svc:
            resp = client.post(
                "/api/v2/analytics/data/reports/monthly/march",
                json={"reportBody": {"k2": "v2"}},
            )
        assert resp.status_code == 202
        assert mock_svc.call_args.args[0] == "march"

    @pytest.mark.parametrize("deleted, status", [(1, 200), (0, 404)])
    def test_delete_monthly_answers_by_the_deleted_count(self, client, deleted, status):
        from types import SimpleNamespace

        with patch("api.services.ReportTemplateModel") as model_cls:
            model_cls.return_value.delete_by_name.return_value = SimpleNamespace(
                deleted_count=deleted
            )
            resp = client.delete("/api/v2/analytics/data/reports/monthly/march")

        assert resp.status_code == status
        model_cls.return_value.delete_by_name.assert_called_once_with("march")


V2_REPORT = "/api/v2/analytics/report"
V3_REPORT = "/api/v3/public/analytics/report"
V3_SUMMARY = "/api/v3/public/analytics/summary"

WINDOW_START = datetime(2024, 1, 1, tzinfo=timezone.utc)


def _report_body(days: int = 30) -> dict:
    """A valid /report and /summary body spanning the given number of days."""
    return {
        "grid_id": "grid-1",
        "start_time": WINDOW_START.isoformat(),
        "end_time": (WINDOW_START + timedelta(days=days)).isoformat(),
    }


def _stub_report():
    """Patch the report service so these tests exercise routing, not BigQuery."""
    return patch(
        "api.services.AirQualityReportService.get_report",
        new_callable=AsyncMock,
        return_value={"airquality": {"status": "success"}},
    )


V2_SUMMARY = "/api/v2/analytics/summary"


class TestReportAndSummary:
    """/report and /summary are served by both versions.

    Both versions carry the same window limit; the public report differs in
    one way, private-member screening.
    """

    @pytest.mark.parametrize("path", [V2_SUMMARY, V3_SUMMARY])
    def test_summary_reports_the_counts_of_the_devices_summary_table(
        self, client, fake_bigquery, path
    ):
        import pandas as pd

        fake_bigquery.result_frame = pd.DataFrame(
            {
                "device": ["d1", "d2"],
                "site_id": ["s1", "s1"],
                "site_name": ["Kampala", "Kampala"],
                "grid_id": ["grid-1", "grid-1"],
                "grid": ["Kampala Grid", "Kampala Grid"],
                "hourly_records": [100, 50],
                "calibrated_records": [80, 50],
                "uncalibrated_records": [20, 0],
                "calibrated_percentage": [80.0, 100.0],
                "uncalibrated_percentage": [20.0, 0.0],
            }
        )

        resp = client.post(
            path,
            json={
                "grid_id": "grid-1",
                "start_time": "2026-03-01T00:00:00+00:00",
                "end_time": "2026-03-08T00:00:00+00:00",
            },
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["grid"] == "Kampala Grid"
        assert data["hourly_records"] == 150
        assert [device["device"] for device in data["devices"]] == ["d1", "d2"]
        assert [site["site_name"] for site in data["sites"]] == ["Kampala"]
        (query,) = fake_bigquery.queries
        bound = {p.name: p.value for p in query.job_config.query_parameters}
        assert bound["filter_id"] == "grid-1"

    def test_public_report_asks_for_private_members_to_be_screened(self, client):
        with _stub_report() as get_report:
            client.post(V3_REPORT, json=_report_body())

        assert get_report.await_args.kwargs["screen_private"] is True

    def test_internal_report_does_not_screen(self, client):
        """v2 behaviour is deliberately unchanged — the dashboard sees what it
        saw before."""
        with _stub_report() as get_report:
            client.post(V2_REPORT, json=_report_body())

        assert get_report.await_args.kwargs.get("screen_private", False) is False

    @pytest.mark.parametrize("path", [V2_REPORT, V3_REPORT, V2_SUMMARY, V3_SUMMARY])
    def test_window_limit_is_31_days_on_both_versions(self, client, path):
        """Pinned as a literal on purpose. A test written against
        settings.hourly_query_days() would stay green if the default drifted,
        while every README that says "31 days" went stale."""
        with _stub_report(), patch(
            "api.services.DataExportService.get_summary",
            new_callable=AsyncMock,
            return_value={"status": "success", "data": {}, "metadata": None},
        ):
            at_limit = client.post(path, json=_report_body(days=31))
            over_limit = client.post(path, json=_report_body(days=32))

        assert at_limit.status_code == 200
        assert over_limit.status_code == 422

    def test_unreachable_privacy_registry_is_a_503_at_the_route(self, client):
        """Fail closed, all the way out: the 503 must reach the caller in the
        standard error envelope, not surface as a 500."""
        from api.utils.exceptions import PrivacyScreeningUnavailable

        with patch(
            "api.services.build_entity_report",
            side_effect=PrivacyScreeningUnavailable(),
        ):
            resp = client.post(V3_REPORT, json=_report_body())

        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "error"
        assert "privacy status" in body["message"]

    @pytest.mark.parametrize("path", [V2_SUMMARY, V3_SUMMARY])
    def test_summary_rejects_a_reversed_window(self, client, path):
        """A reversed range cannot slip under the limit as a negative day
        count on either version."""
        resp = client.post(
            path,
            json={
                "grid_id": "grid-1",
                "start_time": (WINDOW_START + timedelta(days=5)).isoformat(),
                "end_time": WINDOW_START.isoformat(),
            },
        )

        assert resp.status_code == 422


class TestRouteRateLimitWiring:
    """Every route on both routers carries the shared per-route limit."""

    @pytest.mark.parametrize("version", ["v2", "v3"])
    def test_every_route_carries_the_shared_route_limit(self, version):
        """Each route on both routers carries exactly one RouteRateLimit. The
        limit of each route is asserted as a literal: 5 requests a minute for
        raw-data and 10 for every other route. Presence alone would still
        pass with a limit of ten thousand. Exactly one instance is asserted
        because a second, separate instance on a route takes a second unit
        from the same counter and halves the limit.

        The lookup reads the router rather than app.routes. FastAPI 0.141
        includes a router as a single lazy entry that resolves paths when a
        request arrives, so the app exposes the prefixed path at request time
        and the router holds the declaration. The router is the same object on
        every version this service supports, and the prefix reaches coverage
        through the tests that post to the full URL.
        """
        import importlib
        from api.middlewares.rate_limiter import RouteRateLimit

        router = importlib.import_module(f"api.routers.{version}").router
        routes = [r for r in router.routes if hasattr(r, "dependencies")]

        assert routes
        for route in routes:
            limits = [
                dep.dependency
                for dep in route.dependencies
                if isinstance(dep.dependency, RouteRateLimit)
            ]
            assert len(limits) == 1, route.path
            expected = 5 if route.path == "/raw-data" else 10
            assert limits[0].limit_for(route.path) == expected, route.path
            assert limits[0].window == 60, route.path

    @pytest.mark.parametrize(
        "path", ["/api/v2/analytics/raw-data", "/api/v3/public/analytics/raw-data"]
    )
    def test_raw_data_route_allows_5_requests_a_minute(
        self, client, valid_raw_payload, path
    ):
        export = DataExportResponse(
            status="success",
            message="Data exported successfully",
            data=[{"datetime": "2026-01-01T12:00:00Z", "pm2_5": 15.5, "site_id": "s1"}],
        )
        with patch(
            "api.services.DataExportService.export_raw_data",
            new_callable=AsyncMock,
            return_value=export,
        ):
            statuses = [
                client.post(path, json=valid_raw_payload).status_code for _ in range(6)
            ]

        assert statuses == [200] * 5 + [429]


# ---------------------------------------------------------------------------
# Dashboard historical aggregations
# ---------------------------------------------------------------------------


class TestDashboardAggregationEndpoints:
    _WINDOW = {
        "startDate": "2024-01-01T00:00:00.000000Z",
        "endDate": "2024-02-01T00:00:00.000000Z",
    }

    _WINDOW_2026 = {
        "startDate": "2026-03-01T00:00:00.000000Z",
        "endDate": "2026-03-31T00:00:00.000000Z",
    }

    def test_daily_averages_label_each_site_by_its_name(self, client, fake_bigquery):
        import pandas as pd

        from api.utils.pollutants import set_pm25_category_background

        fake_bigquery.queued_frames = [
            pd.DataFrame({"value": [10.5, 40.0], "site_id": ["s1", "s2"]}),
            pd.DataFrame({"id": ["s1", "s2"], "name": ["Kampala", "Jinja"]}),
        ]

        resp = client.post(
            "/api/v2/analytics/dashboard/historical/daily-averages",
            json={"pollutant": "pm2_5", "sites": ["s1", "s2"], **self._WINDOW_2026},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["data"] == {
            "average_values": [10.5, 40.0],
            "labels": ["Kampala", "Jinja"],
            "background_colors": [
                set_pm25_category_background(10.5),
                set_pm25_category_background(40.0),
            ],
        }
        assert body["metadata"] is None
        assert len(fake_bigquery.queries) == 2

    def test_device_daily_averages_label_each_device_by_its_id(
        self, client, fake_bigquery
    ):
        import pandas as pd

        fake_bigquery.result_frame = pd.DataFrame(
            {"value": [12.0, 30.0], "device_id": ["d1", "d2"]}
        )

        resp = client.post(
            "/api/v2/analytics/dashboard/historical/daily-averages-devices",
            json={"pollutant": "pm10", "devices": ["d1", "d2"], **self._WINDOW_2026},
        )

        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["average_values"] == [12.0, 30.0]
        assert data["labels"] == ["d1", "d2"]
        (query,) = fake_bigquery.queries
        assert "AVG(pm10)" in query.sql

    def test_exceedances_return_the_documents_of_the_network(self, client):
        docs = [{"total": 20, "exceedance": {"Good": 17}, "site": {"name": "Kampala"}}]
        with patch("api.services.ExceedanceRepository") as repo_cls:
            repo_cls.return_value.get_exceedances.return_value = docs
            resp = client.post(
                "/api/v2/analytics/dashboard/exceedances?network=iqair",
                json={
                    "pollutant": "pm2_5",
                    "standard": "aqi",
                    "sites": ["s1"],
                    **self._WINDOW_2026,
                },
            )

        assert resp.status_code == 200
        assert resp.json()["data"] == docs
        repo_cls.assert_called_once_with("iqair")
        assert repo_cls.return_value.get_exceedances.call_args.args == (
            "2026-03-01T00:00:00.000000Z",
            "2026-03-31T00:00:00.000000Z",
            "pm2_5",
            "aqi",
            ["s1"],
        )

    def test_exceedances_missing_standard_returns_422(self, client):
        resp = client.post(
            "/api/v2/analytics/dashboard/exceedances",
            json={"pollutant": "pm2_5", "sites": ["s1"], **self._WINDOW},
        )
        assert resp.status_code == 422

    def test_device_exceedances_count_the_days_in_each_category(
        self, client, fake_bigquery
    ):
        import pandas as pd

        fake_bigquery.result_frame = pd.DataFrame(
            {
                "device_id": ["d1", "d1", "d2"],
                "pm2_5": [12.0, 20.0, 9999.0],
                "timestamp": pd.to_datetime(
                    ["2026-03-01", "2026-03-02", "2026-03-01"], utc=True
                ),
            }
        )

        resp = client.post(
            "/api/v2/analytics/dashboard/exceedances-devices",
            json={
                "pollutant": "pm2_5",
                "standard": "aqi",
                "devices": ["d1", "d2"],
                **self._WINDOW_2026,
            },
        )

        assert resp.status_code == 200
        assert resp.json()["data"] == [
            {"device_id": "d1", "total": 2, "exceedances": {"Good": 1, "Moderate": 1}},
            {"device_id": "d2", "total": 0, "exceedances": {}},
        ]
        (query,) = fake_bigquery.queries
        devices = next(
            p for p in query.job_config.query_parameters if p.name == "devices"
        )
        assert devices.values == ["d1", "d2"]


# ---------------------------------------------------------------------------
# Privacy filtering wiring (route → service → device-registry helper)
# ---------------------------------------------------------------------------


class TestPrivacyFilteringWiring:
    """End-to-end view of the privacy flag on the request path, for both API
    versions.  This route test is the check that the data-download path
    states the flag at the call site.  It asserts that the flag is stated
    rather than which value it is set to — the flag's own behaviour is
    covered on both settings in tests/test_services.py::TestPrivacyFiltering."""

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

    def test_forecast_by_city_filters_the_query_on_the_city(
        self, client, fake_bigquery
    ):
        from tests.paging_support import WINDOW, forecast_frame

        fake_bigquery.result_frame = forecast_frame(2)

        resp = client.post(
            "/api/v3/public/analytics/forecast-data",
            json={**WINDOW, "city": "Kampala"},
        )

        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 2
        (query,) = fake_bigquery.queries
        assert "city = @filter_value" in query.sql
        bound = {p.name: p.value for p in query.job_config.query_parameters}
        assert bound["filter_value"] == "Kampala"

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

    def test_empty_result_returns_a_csv_attachment(
        self, client, valid_export_payload, empty_df
    ):
        """A CSV request is answered with a CSV file at every row count."""
        meta = {"total_count": 0, "has_more": False, "next": None}
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            return_value=(empty_df, meta),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download",
                json={**valid_export_payload, "downloadType": "csv"},
            )
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/csv")
        assert "attachment" in resp.headers.get("content-disposition", "")
        assert resp.headers["x-total-count"] == "0"

    def test_csv_carries_the_pagination_metadata_in_headers(
        self, client, valid_export_payload, sample_df
    ):
        """A CSV body holds rows alone, so the page state travels in headers
        and a CSV caller pages the way a JSON caller does."""
        meta = {"total_count": 2, "has_more": True, "next": "cursor-token"}
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
        assert resp.headers["x-total-count"] == "2"
        assert resp.headers["x-has-more"] == "true"
        assert resp.headers["x-next-cursor"] == "cursor-token"

    def test_csv_omits_the_cursor_header_on_the_last_page(
        self, client, valid_export_payload, sample_df
    ):
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
        assert resp.headers["x-has-more"] == "false"
        assert "x-next-cursor" not in resp.headers


# ---------------------------------------------------------------------------
# Stored-result paging through the routes
#
# The fake BigQuery client stores each query result and serves pages of it by
# row offset, so these tests walk every paged route end to end: request body,
# service, query layer and response envelope.  Each walk stays within the
# per-route rate limit.  The autouse fixture clears the cache store between
# tests.
# ---------------------------------------------------------------------------

V2 = "/api/v2/analytics"
V3 = "/api/v3/public/analytics"
ENVELOPE_KEYS = {"message", "status", "data", "metadata"}


def _paged_routes():
    """List every paged route with its request body and the identity key of a record."""
    from tests.paging_support import DOWNLOAD, FORECAST, RAW, chart_body

    return [
        (f"{V2}/data-download", DOWNLOAD, "device_name"),
        (f"{V3}/data-download", DOWNLOAD, "device_name"),
        (f"{V2}/raw-data", RAW, "device_name"),
        (f"{V3}/raw-data", RAW, "device_name"),
        (f"{V3}/forecast-data", FORECAST, "city"),
        (f"{V2}/dashboard/chart/data", chart_body("line"), "device_name"),
        (f"{V2}/dashboard/chart/d3/data", chart_body("bar"), "device_name"),
    ]


def _route_ids():
    return [path.replace("/api/", "") for path, _, _ in _paged_routes()]


def _seed(fake, identity: str, rows: int = 7):
    """Store the result of the next query: satellite rows for a city key."""
    from tests.paging_support import device_frame, forecast_frame

    fake.result_frame = (
        forecast_frame(rows) if identity == "city" else device_frame(rows)
    )


def _with_cursor(body: dict, cursor):
    return {**body, "cursor": cursor} if cursor else dict(body)


def _walk_json(client, path, body, max_pages=20):
    """Follow metadata.next from the first page and return the envelopes."""
    pages = []
    cursor = None
    for _ in range(max_pages):
        resp = client.post(path, json=_with_cursor(body, cursor))
        assert resp.status_code == 200, resp.text
        envelope = resp.json()
        pages.append(envelope)
        if not envelope["metadata"]["has_more"]:
            return pages
        cursor = envelope["metadata"]["next"]
    raise AssertionError("the walk did not end within the page cap")


def _csv_rows(text: str):
    import csv
    import io

    return list(csv.DictReader(io.StringIO(text)))


def _bad_cursors(cursor, cursor_clock):
    """Build the rejected forms of a valid cursor, by name."""
    from tests.paging_support import tampered, unsigned

    def expired():
        cursor_clock.advance(361)
        return cursor

    return {
        "changed": lambda: tampered(cursor),
        "unsigned": lambda: unsigned(cursor),
        "malformed": lambda: "not-a-cursor",
        "expired": expired,
    }


class TestStoredResultPagingRoutes:
    @pytest.mark.parametrize("path, body, identity", _paged_routes(), ids=_route_ids())
    def test_walk_returns_every_record_once(
        self, client, fake_bigquery, small_pages, cursor_clock, path, body, identity
    ):
        _seed(fake_bigquery, identity)
        pages = _walk_json(client, path, body)

        keys = [
            (record["datetime"], record[identity])
            for page in pages
            for record in page["data"]
        ]
        assert len(pages) == 3
        assert len(keys) == 7
        assert len(set(keys)) == 7
        for page in pages:
            assert page["status"] == "success"
            assert page["data"]
            assert page["metadata"]["total_count"] == len(page["data"])
        for page in pages[:-1]:
            assert page["metadata"]["has_more"] is True
            assert isinstance(page["metadata"]["next"], str)
        assert pages[-1]["metadata"]["has_more"] is False
        assert pages[-1]["metadata"]["next"] is None
        assert len(fake_bigquery.queries) == 1

    def test_result_of_one_page_has_no_cursor(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        from tests.paging_support import DOWNLOAD

        _seed(fake_bigquery, "device_name", rows=3)
        pages = _walk_json(client, f"{V2}/data-download", DOWNLOAD)
        assert len(pages) == 1
        assert pages[0]["metadata"] == {
            "total_count": 3,
            "has_more": False,
            "next": None,
        }

    @pytest.mark.parametrize(
        "path, body, identity",
        [_paged_routes()[0], _paged_routes()[4]],
        ids=["v2/analytics/data-download", "v3/public/analytics/forecast-data"],
    )
    def test_empty_window_is_a_success_without_a_cursor(
        self, client, fake_bigquery, small_pages, cursor_clock, path, body, identity
    ):
        _seed(fake_bigquery, identity, rows=0)
        resp = client.post(path, json=body)
        assert resp.status_code == 200
        envelope = resp.json()
        assert envelope["status"] == "success"
        assert envelope["data"] == []
        assert envelope["metadata"]["has_more"] is False
        assert envelope["metadata"]["next"] is None

    @pytest.mark.parametrize("path, body, identity", _paged_routes(), ids=_route_ids())
    @pytest.mark.parametrize("cause", ["changed", "unsigned", "malformed", "expired"])
    def test_rejected_cursor_is_a_400_error_envelope(
        self,
        client,
        fake_bigquery,
        small_pages,
        cursor_clock,
        path,
        body,
        identity,
        cause,
    ):
        _seed(fake_bigquery, identity)
        first = client.post(path, json=body).json()
        bad = _bad_cursors(first["metadata"]["next"], cursor_clock)[cause]()

        resp = client.post(path, json=_with_cursor(body, bad))

        assert resp.status_code == 400
        envelope = resp.json()
        assert set(envelope) == ENVELOPE_KEYS
        assert envelope["status"] == "error"
        assert envelope["message"]
        assert envelope["data"] is None
        assert envelope["metadata"] is None
        assert fake_bigquery.job_lookups == []
        assert len(fake_bigquery.queries) == 1

    @pytest.mark.parametrize("path, body, identity", _paged_routes(), ids=_route_ids())
    def test_cursor_of_another_body_is_a_400(
        self, client, fake_bigquery, small_pages, cursor_clock, path, body, identity
    ):
        _seed(fake_bigquery, identity)
        first = client.post(path, json=body).json()
        change = (
            {"country": "Kenya"} if identity == "city" else {"device_ids": ["dev_c"]}
        )

        resp = client.post(
            path, json={**body, **change, "cursor": first["metadata"]["next"]}
        )

        assert resp.status_code == 400
        assert resp.json()["status"] == "error"
        assert len(fake_bigquery.queries) == 1

    def test_cursor_of_another_route_is_a_400(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        from tests.paging_support import DOWNLOAD, RAW

        _seed(fake_bigquery, "device_name")
        first = client.post(f"{V2}/data-download", json=DOWNLOAD).json()

        resp = client.post(
            f"{V2}/raw-data", json={**RAW, "cursor": first["metadata"]["next"]}
        )

        assert resp.status_code == 400
        assert len(fake_bigquery.queries) == 1

    def test_the_same_body_pages_on_both_versions(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        """v2 and v3 call one service, so a cursor from one version pages on the other."""
        from tests.paging_support import DOWNLOAD

        _seed(fake_bigquery, "device_name")
        first = client.post(f"{V2}/data-download", json=DOWNLOAD).json()
        second = client.post(
            f"{V3}/data-download",
            json=_with_cursor(DOWNLOAD, first["metadata"]["next"]),
        )
        assert second.status_code == 200
        assert second.json()["metadata"]["total_count"] == 3
        assert len(fake_bigquery.queries) == 1

    @pytest.mark.parametrize("cursor", [None, ""])
    def test_a_null_or_empty_cursor_starts_a_new_export(
        self, client, fake_bigquery, small_pages, cursor_clock, cursor
    ):
        from tests.paging_support import DOWNLOAD

        _seed(fake_bigquery, "device_name")
        resp = client.post(f"{V2}/data-download", json={**DOWNLOAD, "cursor": cursor})
        assert resp.status_code == 200
        assert resp.json()["metadata"]["total_count"] == 3
        assert len(fake_bigquery.queries) == 1

    @pytest.mark.parametrize(
        "path, body, identity",
        [_paged_routes()[0], _paged_routes()[4], _paged_routes()[5]],
        ids=["data-download", "forecast-data", "chart"],
    )
    @pytest.mark.parametrize("vanish", ["expire_result", "forget_job"])
    def test_vanished_stored_result_is_a_400(
        self,
        client,
        fake_bigquery,
        small_pages,
        cursor_clock,
        path,
        body,
        identity,
        vanish,
    ):
        from tests.paging_support import payload_of

        _seed(fake_bigquery, identity)
        first = client.post(path, json=body).json()
        cursor = first["metadata"]["next"]
        getattr(fake_bigquery, vanish)(payload_of(cursor)["job_id"])

        resp = client.post(path, json=_with_cursor(body, cursor))

        assert resp.status_code == 400
        assert resp.json()["status"] == "error"

    def test_every_rejection_cause_gets_one_message(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        from tests.paging_support import DOWNLOAD, payload_of

        _seed(fake_bigquery, "device_name")
        first = client.post(f"{V2}/data-download", json=DOWNLOAD).json()
        cursor = first["metadata"]["next"]
        bad = _bad_cursors(cursor, cursor_clock)
        messages = set()
        for cause in ("changed", "unsigned", "malformed"):
            resp = client.post(
                f"{V2}/data-download", json=_with_cursor(DOWNLOAD, bad[cause]())
            )
            assert resp.status_code == 400
            messages.add(resp.json()["message"])
        fake_bigquery.forget_job(payload_of(cursor)["job_id"])
        resp = client.post(f"{V2}/data-download", json=_with_cursor(DOWNLOAD, cursor))
        assert resp.status_code == 400
        messages.add(resp.json()["message"])
        assert len(messages) == 1

    def test_every_route_gets_the_same_message(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        messages = set()
        for path, body, identity in _paged_routes():
            resp = client.post(path, json=_with_cursor(body, "not-a-cursor"))
            assert resp.status_code == 400
            messages.add(resp.json()["message"])
        assert len(messages) == 1
        assert fake_bigquery.queries == []

    def test_refused_page_read_is_a_503(
        self, client, fake_bigquery, small_pages, cursor_clock
    ):
        from google.api_core.exceptions import Forbidden
        from tests.paging_support import DOWNLOAD

        _seed(fake_bigquery, "device_name")
        first = client.post(f"{V2}/data-download", json=DOWNLOAD).json()
        fake_bigquery.read_error = Forbidden(
            "Access Denied", errors=[{"reason": "accessDenied"}]
        )

        resp = client.post(
            f"{V2}/data-download",
            json=_with_cursor(DOWNLOAD, first["metadata"]["next"]),
        )

        assert resp.status_code == 503
        assert resp.json()["status"] == "error"

    @pytest.mark.parametrize(
        "path, body",
        [(f"{V2}/data-download", "DOWNLOAD"), (f"{V3}/raw-data", "RAW")],
        ids=["v2/data-download", "v3/raw-data"],
    )
    def test_csv_walk_returns_every_record_once_with_the_page_headers(
        self, client, fake_bigquery, small_pages, cursor_clock, path, body
    ):
        from tests import paging_support

        body = {**getattr(paging_support, body), "downloadType": "csv"}
        _seed(fake_bigquery, "device_name")
        keys = []
        cursor = None
        for _ in range(20):
            resp = client.post(path, json=_with_cursor(body, cursor))
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/csv")
            rows = _csv_rows(resp.text)
            assert resp.headers["x-total-count"] == str(len(rows))
            keys.extend((row["datetime"], row["device_name"]) for row in rows)
            if "x-next-cursor" in resp.headers:
                assert resp.headers["x-has-more"] == "true"
                cursor = resp.headers["x-next-cursor"]
            else:
                assert resp.headers["x-has-more"] == "false"
                break
        assert len(keys) == 7
        assert len(set(keys)) == 7
        assert len(fake_bigquery.queries) == 1

    @pytest.mark.parametrize(
        "path", [f"{V2}/dashboard/chart/data", f"{V2}/dashboard/chart/d3/data"]
    )
    def test_pie_chart_returns_its_whole_result(
        self, client, fake_bigquery, small_pages, cursor_clock, path
    ):
        from tests.paging_support import chart_body, pie_frame

        fake_bigquery.result_frame = pie_frame()
        resp = client.post(path, json=chart_body("pie"))

        assert resp.status_code == 200
        envelope = resp.json()
        assert {point["label"]: point["value"] for point in envelope["data"]} == {
            "Site One": 20.0,
            "Site Two": 50.0,
        }
        assert envelope["metadata"] == {
            "total_count": 2,
            "has_more": False,
            "next": None,
        }
        assert len(fake_bigquery.queries) == 1


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

    def test_readiness_returns_503_when_the_ping_fails(self, client, monkeypatch):
        async def failed_ping() -> bool:
            return False

        monkeypatch.setattr("api.utils.cache.cache_ping", failed_ping)
        resp = client.get("/health/ready")

        assert resp.status_code == 503
        body = resp.json()
        assert body["status"] == "not_ready"
        assert body["checks"]["redis"] is False


# ---------------------------------------------------------------------------
# Grid report endpoints
# ---------------------------------------------------------------------------


class TestAirQualityReportEndpoint:
    """/report serves grids and cohorts; the body names which, the same
    way /summary does."""

    _WINDOW = {
        "start_time": "2024-01-01T00:00:00",
        "end_time": "2024-02-01T00:00:00",
    }
    _PATH = "/api/v2/analytics/report"

    def test_entity_reaches_the_builder(self, client):
        """The kind is derived from the body, not the path."""
        with patch(
            "api.services.build_entity_report", return_value={"airquality": {}}
        ) as mock_build:
            client.post(self._PATH, json={"cohort_id": "cohort-1", **self._WINDOW})

        assert mock_build.call_args.args[:2] == ("cohort", "cohort-1")

    def test_equal_dates_returns_422(self, client):
        resp = client.post(
            self._PATH,
            json={
                "grid_id": "grid-1",
                "start_time": self._WINDOW["start_time"],
                "end_time": self._WINDOW["start_time"],
            },
        )
        assert resp.status_code == 422

    def test_no_entity_returns_422(self, client):
        resp = client.post(self._PATH, json=dict(self._WINDOW))
        assert resp.status_code == 422

    def test_both_entities_returns_422(self, client):
        resp = client.post(
            self._PATH,
            json={"grid_id": "g1", "cohort_id": "c1", **self._WINDOW},
        )
        assert resp.status_code == 422

    def test_oversized_window_is_a_400_error_envelope(self, client):
        from api.utils.exceptions import QueryTooLarge

        with patch(
            "api.services.build_entity_report",
            side_effect=QueryTooLarge(
                limit_bytes=1073741824, required_bytes=5557452800
            ),
        ):
            resp = client.post(self._PATH, json={"grid_id": "grid-1", **self._WINDOW})

        assert resp.status_code == 400
        body = resp.json()
        assert body["status"] == "error"
        assert body["message"]


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

    def test_patch_requires_request_id(self, client):
        resp = client.patch("/api/v2/analytics/data-export")
        assert resp.status_code == 422

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
    """The gateway identity header decides the caller when it is present, and
    a ?userId= that disagrees with it gets a 403. When the header is absent,
    ?userId= decides the caller while REQUIRE_GATEWAY_IDENTITY is off, and the
    request gets a 401 when it is on. See api/dependencies.py for the staged
    rollout this pins."""

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
            "/api/v2/analytics/data/reports/monthly",
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


@contextmanager
def _raising_route(path: str = "/__test_boom__"):
    """Temporarily mount a route that raises, then remove it.

    Adding a route does not rebuild the middleware stack, so the request still
    travels the production stack on its way in and out.
    """
    from main import app

    async def boom():
        raise RuntimeError("kaboom")

    app.add_api_route(path, boom, methods=["GET"])
    try:
        yield path
    finally:
        app.router.routes = [
            r for r in app.router.routes if getattr(r, "path", None) != path
        ]


class TestMiddleware:
    """The stack order these assert is load-bearing, not incidental.

    Starlette registers middleware inside-out, so anything registered after
    CORSMiddleware ends up wrapping it — and any response produced out there
    reaches the browser without Access-Control-Allow-Origin.  A browser then
    blocks it before JavaScript can read the status or body, turning a
    perfectly good JSON error into an opaque `TypeError: Failed to fetch`.
    """

    ORIGIN = {"Origin": "https://platform.airqo.net"}

    def test_cors_is_the_outermost_user_middleware(self):
        from main import app

        # user_middleware[0] is outermost at runtime. CORS must sit above
        # every layer that can answer without reaching the router.
        assert "CORS" in str(app.user_middleware[0]), (
            "CORSMiddleware must be registered LAST so it wraps the rate "
            "limiter, the host check and the 500 handler"
        )

    def test_unhandled_error_carries_cors_and_request_id(self, client: TestClient):
        with _raising_route() as path:
            resp = client.get(path, headers=self.ORIGIN)

        assert resp.status_code == 500
        assert resp.headers.get("access-control-allow-origin")
        assert resp.headers.get("x-request-id")
        assert resp.json() == {
            "message": "Internal server error",
            "status": "error",
            "data": None,
            "metadata": None,
        }

    def test_unhandled_error_honours_inbound_request_id(self, client: TestClient):
        with _raising_route() as path:
            resp = client.get(
                path, headers={**self.ORIGIN, "X-Request-ID": "gateway-abc-123"}
            )

        assert resp.status_code == 500
        assert resp.headers["x-request-id"] == "gateway-abc-123"

    def test_rate_limited_response_carries_cors_and_request_id(
        self, client: TestClient
    ):
        from api.middlewares.rate_limiter import RateLimiterMiddleware

        # The limiter returns its 429 without calling downstream, so this only
        # picks up CORS headers while CORSMiddleware wraps it.
        with _raising_route() as path, patch.object(
            RateLimiterMiddleware,
            "_consume_quota",
            new=AsyncMock(return_value=False),
        ):
            resp = client.get(path, headers=self.ORIGIN)

        assert resp.status_code == 429
        assert resp.headers.get("access-control-allow-origin")
        assert resp.headers.get("x-request-id")

    def test_cors_preflight_is_still_answered(self, client: TestClient):
        with _raising_route() as path:
            resp = client.options(
                path,
                headers={**self.ORIGIN, "Access-Control-Request-Method": "GET"},
            )

        assert resp.status_code == 200
        assert resp.headers.get("access-control-allow-origin")


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
        assert body["message"]

    def test_forbidden_query_is_a_503_error_envelope(
        self, client, valid_export_payload
    ):
        """The 503 envelope of a refusal carries the fixed message of the
        service, which differs from the message of a cancelled query."""
        from api.services import _cancelled_error
        from api.utils.exceptions import QueryForbidden

        bigquery_message = "Access Denied: Table measurements: Permission denied"
        with patch(
            "api.services.AsyncBigQueryApi.query_data_async",
            new_callable=AsyncMock,
            side_effect=QueryForbidden(reason="accessDenied", message=bigquery_message),
        ):
            resp = client.post(
                "/api/v2/analytics/data-download", json=valid_export_payload
            )

        assert resp.status_code == 503
        body = resp.json()
        assert self._ENVELOPE_KEYS <= set(body)
        assert body["status"] == "error"
        assert body["data"] is None
        assert bigquery_message not in body["message"]
        assert body["message"] != _cancelled_error().detail

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
