"""
Tests for the scheduled-export Celery worker chain.

Covers:
  - doc_to_data_export_request maps documents that carry
    filter_type/filter_value, and documents that carry separate devices and
    sites lists;
  - the retry filter selects failed requests that have retries left;
  - data_export_query accepts the frequency as the enum or as a string;
  - the worker marks a request that BigQuery refuses with HTTP 403 as
    failed, and keeps a retry only for a quota or rate refusal;
  - the export and devices-summary helpers translate a 403 into
    QueryForbidden.

No Mongo/BigQuery/Redis needed: models are constructed without __init__ or
exercised as pure functions.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from bson import ObjectId
from google.api_core.exceptions import Forbidden

from api.models.data_export import DataExportModel
from api.models.export_queries import data_export_query
from api.utils.exceptions import QueryForbidden, QueryRateLimited
from constants import DataExportStatus, Frequency


def _base_doc(**overrides):
    doc = {
        "_id": ObjectId(),
        "start_date": datetime(2024, 1, 1, tzinfo=timezone.utc),
        "end_date": datetime(2024, 2, 1, tzinfo=timezone.utc),
        "data_links": [],
        "request_date": datetime(2024, 1, 1, tzinfo=timezone.utc),
        "user_id": "u1",
        "status": "scheduled",
        "frequency": "hourly",
        "export_format": "csv",
        "pollutants": ["pm2_5"],
        "retries": 3,
    }
    doc.update(overrides)
    return doc


class TestDocToDataExportRequest:
    def test_new_format_doc_round_trips(self):
        """Docs written by the FastAPI /data-export service carry
        filter_type/filter_value and must map through unchanged."""
        doc = _base_doc(filter_type="sites", filter_value=["s1", "s2"])
        request = DataExportModel.doc_to_data_export_request(doc)
        assert request.filter_type == "sites"
        assert request.filter_value == ["s1", "s2"]
        assert request.frequency == Frequency.HOURLY

    def test_legacy_doc_devices_shimmed(self):
        """A document can store separate devices/sites lists."""
        doc = _base_doc(devices=["d1"], sites=[])
        request = DataExportModel.doc_to_data_export_request(doc)
        assert request.filter_type == "devices"
        assert request.filter_value == ["d1"]

    def test_legacy_doc_sites_shimmed(self):
        doc = _base_doc(devices=[], sites=["s1"])
        request = DataExportModel.doc_to_data_export_request(doc)
        assert request.filter_type == "sites"
        assert request.filter_value == ["s1"]


class TestScheduledAndFailedFilter:
    def test_retry_filter_uses_correctly_spelled_retries(self):
        """The filter selects failed requests on the "retries" field, so a
        failed request with retries left is picked up again."""
        model = DataExportModel.__new__(DataExportModel)
        model.collection = MagicMock()
        model.collection.find.return_value = []

        model.get_scheduled_and_failed_requests()

        filter_set = model.collection.find.call_args.args[0]
        failed_branch = filter_set["$or"][1]["$and"]
        assert {"retries": {"$gt": 0}} in failed_branch
        assert not any("retires" in cond for cond in failed_branch)


class TestDataExportQuery:
    _ARGS = {
        "start_date": "2024-01-01T00:00:00Z",
        "end_date": "2024-02-01T00:00:00Z",
        "pollutants": ["pm2_5"],
    }

    def test_accepts_plain_string_frequency(self):
        query = data_export_query(
            filter_type="devices",
            filter_value=["d1"],
            frequency="daily",
            **self._ARGS,
        )
        assert "`test_daily_data`" in query

    def test_raw_frequency_uses_raw_table(self):
        query = data_export_query(
            filter_type="devices",
            filter_value=["d1"],
            frequency=Frequency.RAW,
            **self._ARGS,
        )
        assert "`test_raw_data`" in query

    @staticmethod
    def _inner_measurement_columns(leg: str, table: str) -> list:
        """Columns of the innermost SELECT that reads the measurement table
        — the list whose count/order must align across the UNION legs
        (the outer wrappers select `data.*` and are structurally equal)."""
        before_from = leg.split(f" FROM {table} ")[0]
        inner = before_from[before_from.rindex("SELECT") + len("SELECT") :]
        columns, depth, current = [], 0, ""
        for ch in inner:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            if ch == "," and depth == 0:
                columns.append(current.strip())
                current = ""
            else:
                current += ch
        if current.strip():
            columns.append(current.strip())
        return [c for c in columns if c]

    def test_bam_union_legs_have_matching_columns(self):
        """Both legs of the BAM union produce identical alias lists,
        positionally, because a UNION ALL with mismatched column counts is
        invalid SQL."""
        query = data_export_query(
            filter_type="devices",
            filter_value=["d1"],
            frequency=Frequency.HOURLY,
            start_date="2024-01-01T00:00:00Z",
            end_date="2024-02-01T00:00:00Z",
            pollutants=["pm2_5", "pm10"],
        )
        left, right = query.split("UNION ALL")

        left_cols = self._inner_measurement_columns(left, "`test_hourly_data`")
        right_cols = self._inner_measurement_columns(right, "`test_bam_hourly_data`")

        assert len(left_cols) == len(right_cols)
        # Positional alias alignment: compare the trailing "AS alias" tokens
        left_aliases = [c.split(" AS ")[-1].strip() for c in left_cols]
        right_aliases = [c.split(" AS ")[-1].strip() for c in right_cols]
        assert left_aliases == right_aliases
        assert left_aliases[:3] == ["pm2_5", "pm10", "datetime"]
        assert "ROUND(`test_bam_hourly_data`.pm2_5, 2) AS pm2_5" in query

    def test_non_hourly_and_non_device_queries_have_no_union(self):
        """The union must not leak into other workflows."""
        for kwargs in (
            {
                "filter_type": "devices",
                "filter_value": ["d1"],
                "frequency": Frequency.RAW,
            },
            {"filter_type": "devices", "filter_value": ["d1"], "frequency": "daily"},
            {
                "filter_type": "sites",
                "filter_value": ["s1"],
                "frequency": Frequency.HOURLY,
            },
        ):
            query = data_export_query(**kwargs, **self._ARGS)
            assert "UNION ALL" not in query, kwargs

    def test_device_ids_maps_to_devices_branch(self):
        query = data_export_query(
            filter_type="device_ids",
            filter_value=["d1"],
            frequency=Frequency.HOURLY,
            **self._ARGS,
        )
        assert "device_id IN UNNEST(['d1'])" in query

    def test_sites_branch(self):
        query = data_export_query(
            filter_type="sites",
            filter_value=["s1"],
            frequency=Frequency.HOURLY,
            **self._ARGS,
        )
        assert ".id IN UNNEST(['s1'])" in query
        assert "UNION ALL" not in query


class TestWorkerImports:
    def test_celery_app_imports_on_config_alone(self):
        """The worker image installs requirements.txt only, so the module
        imports on config alone."""
        import celery_app

        assert celery_app.celery.conf.task_default_queue == "analytics"


def _refused(reason: str = "accessDenied") -> Forbidden:
    return Forbidden("refused", errors=[{"reason": reason, "message": "refused"}])


def _export_request():
    return DataExportModel.doc_to_data_export_request(
        _base_doc(
            filter_type="sites",
            filter_value=["s1"],
            start_date=datetime(2026, 1, 1, tzinfo=timezone.utc),
            end_date=datetime(2026, 2, 1, tzinfo=timezone.utc),
            request_date=datetime(2026, 2, 2, tzinfo=timezone.utc),
        )
    )


class TestWorkerForbidden:
    """A request that BigQuery refuses with HTTP 403 is marked failed. It keeps
    a retry only when the reason clears on its own."""

    def _run(self, monkeypatch, error):
        import celery_app

        request = _export_request()
        model = MagicMock()
        model.get_scheduled_and_failed_requests.return_value = [request]
        model.update_request_status_and_retries.return_value = True
        model.has_data.side_effect = error
        monkeypatch.setattr(celery_app, "DataExportModel", lambda: model)
        monkeypatch.setattr(celery_app, "data_export_query", lambda **_: "select 1")

        celery_app.data_export_task()
        return request, model

    @pytest.mark.parametrize(
        "reason,retries",
        [("accessDenied", 0), ("quotaExceeded", 2), ("rateLimitExceeded", 2)],
    )
    def test_refused_request_is_failed(self, monkeypatch, caplog, reason, retries):
        with caplog.at_level(logging.WARNING, logger="celery_app"):
            request, model = self._run(
                monkeypatch, QueryForbidden(reason=reason, message="refused")
            )

        assert request.status == DataExportStatus.FAILED
        assert request.retries == retries
        model.export_query_results_to_table.assert_not_called()
        records = [r for r in caplog.records if r.name == "celery_app"]
        assert [r.levelno for r in records] == [logging.WARNING]
        assert reason in records[0].args
        assert "data check" in records[0].args

    def test_rate_limited_request_keeps_a_retry(self, monkeypatch):
        request, _ = self._run(
            monkeypatch,
            QueryRateLimited(reason="rateLimitExceeded", message="refused"),
        )

        assert request.status == DataExportStatus.FAILED
        assert request.retries == 2

    def test_other_failure_is_logged_with_its_stage(self, monkeypatch, caplog):
        with caplog.at_level(logging.WARNING, logger="celery_app"):
            request, _ = self._run(monkeypatch, RuntimeError("mongo down"))

        assert request.status == DataExportStatus.FAILED
        assert request.retries == 2
        records = [r for r in caplog.records if r.name == "celery_app"]
        assert [r.levelno for r in records] == [logging.ERROR]
        assert records[0].exc_info is not None
        assert "data check" in records[0].args


class TestExportModelForbidden:
    """Each BigQuery and Cloud Storage request of an export step translates
    a 403 into QueryForbidden."""

    def _model(self):
        model = DataExportModel.__new__(DataExportModel)
        model.bigquery_client = MagicMock()
        model.bucket = MagicMock()
        model.bucket.name = "exports"
        model.dataset = "dataset"
        model.project = "project"
        return model

    def _request(self):
        return _export_request()

    def test_constructor_sends_no_storage_request(self, monkeypatch):
        monkeypatch.setattr(
            "api.models.base.mongo_base.FastAPIPyMongoModel.__init__",
            lambda self, **_: None,
        )
        model = DataExportModel()

        model.cloud_storage_client.get_bucket.assert_not_called()
        model.cloud_storage_client.bucket.assert_called_once()

    def test_data_check(self):
        client = MagicMock()
        client.query.return_value.result.side_effect = _refused()
        with patch(
            "api.models.data_export.shared_bigquery_client", return_value=client
        ):
            with pytest.raises(QueryForbidden):
                self._model().has_data("select 1")

    def test_table_export(self):
        model = self._model()
        model.bigquery_client.query.side_effect = _refused("quotaExceeded")
        with pytest.raises(QueryForbidden) as exc:
            model.export_query_results_to_table("select 1", self._request())

        assert exc.value.transient is True

    def test_refused_extract_keeps_the_files_of_the_previous_run(self):
        model = self._model()
        old_file = MagicMock()
        old_file.name = "u1/r1/20260101T000000/download_000000000000.csv"
        model.bucket.list_blobs.return_value = [old_file]
        model.bigquery_client.extract_table.return_value.result.side_effect = _refused()

        with pytest.raises(QueryForbidden):
            model.export_table_to_gcs(self._request())

        old_file.delete.assert_not_called()

    def test_extract_then_delete_only_the_files_of_earlier_runs(self):
        model = self._model()
        request = self._request()
        old_file = MagicMock()
        old_file.name = f"{request.gcs_folder()}20260101T000000/download_0.csv"

        def list_blobs(prefix):
            destination = model.bigquery_client.extract_table.call_args.args[1]
            new_file = MagicMock()
            new_file.name = destination.split(f"/{model.bucket.name}/", 1)[1]
            list_blobs.new_file = new_file
            return [old_file, new_file]

        model.bucket.list_blobs.side_effect = list_blobs
        model.export_table_to_gcs(request)

        old_file.delete.assert_called_once()
        list_blobs.new_file.delete.assert_not_called()

    def test_link_listing(self):
        model = self._model()
        model.bucket.list_blobs.side_effect = _refused()
        with pytest.raises(QueryForbidden):
            model.get_data_links(self._request())


class TestDevicesSummaryForbidden:
    """The devices-summary job translates a 403 and exits with status 1."""

    def test_hourly_data_query(self):
        from api.models.device_summary_queries import get_devices_hourly_data

        client = MagicMock()
        client.query.side_effect = _refused()
        with patch(
            "api.models.device_summary_queries.shared_bigquery_client",
            return_value=client,
        ):
            with pytest.raises(QueryForbidden):
                get_devices_hourly_data(datetime(2026, 1, 1, tzinfo=timezone.utc))

    def test_save(self):
        from api.models.device_summary_queries import save_devices_summary_data

        client = MagicMock()
        client.load_table_from_dataframe.return_value.result.side_effect = _refused()
        with patch(
            "api.models.device_summary_queries.shared_bigquery_client",
            return_value=client,
        ):
            with pytest.raises(QueryForbidden):
                save_devices_summary_data(pd.DataFrame())

    def test_job_exits_with_status_1(self, monkeypatch):
        import devices_summary

        monkeypatch.setattr(
            type(devices_summary.settings), "init_logging", lambda *_: None
        )
        monkeypatch.setattr(
            devices_summary,
            "get_devices_hourly_data",
            MagicMock(side_effect=QueryForbidden(reason="accessDenied")),
        )

        assert devices_summary.main() == 1
