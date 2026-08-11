"""
Tests for the scheduled-export Celery worker chain.

Covers the defects fixed during the Flask→FastAPI modernisation:
  - doc_to_data_export_request constructed the dataclass with devices=/sites=
    kwargs that don't exist, so every request errored and was silently
    skipped — new docs use filter_type/filter_value, legacy docs are shimmed;
  - the retry filter queried a misspelled "retires" field, so failed
    requests never retried;
  - data_export_query received a string frequency but called .value on it,
    crashing every export — it now accepts the enum (or a string).

No Mongo/BigQuery/Redis needed: models are constructed without __init__ or
exercised as pure functions.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
from bson import ObjectId

from api.models.data_export import DataExportModel
from api.models.export_queries import data_export_query
from constants import Frequency


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
        """Pre-migration docs stored separate devices/sites/airqlouds lists."""
        doc = _base_doc(devices=["d1"], sites=[], airqlouds=[])
        request = DataExportModel.doc_to_data_export_request(doc)
        assert request.filter_type == "devices"
        assert request.filter_value == ["d1"]

    def test_legacy_doc_sites_shimmed(self):
        doc = _base_doc(devices=[], sites=["s1"], airqlouds=[])
        request = DataExportModel.doc_to_data_export_request(doc)
        assert request.filter_type == "sites"
        assert request.filter_value == ["s1"]


class TestScheduledAndFailedFilter:
    def test_retry_filter_uses_correctly_spelled_retries(self):
        """Regression: the filter said "retires", so failed requests with
        retries remaining were never picked up again."""
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

    def test_accepts_frequency_enum(self):
        """Regression: the old chain passed a str into code calling .value."""
        query = data_export_query(
            filter_type="devices",
            filter_value=["d1"],
            frequency=Frequency.HOURLY,
            **self._ARGS,
        )
        assert "`test_hourly_data`" in query

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

    def test_invalid_frequency_raises(self):
        with pytest.raises(ValueError, match="Invalid frequency"):
            data_export_query(
                filter_type="devices",
                filter_value=["d1"],
                frequency="weekly",
                **self._ARGS,
            )

    def test_hourly_devices_includes_bam_union(self):
        """Regression: the original compared the enum against the string
        'hourly' (always False), so BAM data was never unioned in."""
        query = data_export_query(
            filter_type="devices",
            filter_value=["d1"],
            frequency=Frequency.HOURLY,
            **self._ARGS,
        )
        assert "UNION ALL" in query
        assert "`test_bam_hourly_data`" in query

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
        """Regression: the original BAM leg emitted two raw/calibrated
        columns per pollutant vs one on the main leg — mismatched UNION ALL
        column counts are invalid SQL, so every hourly device export failed.
        Both legs must now produce identical alias lists, positionally."""
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

    def test_airqlouds_rejected_with_actionable_message(self):
        """airqlouds is deprecated and its branch removed. Records queued
        before the change must fail with an explanation, not a generic
        "unsupported filter type"."""
        with pytest.raises(ValueError, match="deprecated"):
            data_export_query(
                filter_type="airqlouds",
                filter_value=["a1"],
                frequency=Frequency.HOURLY,
                **self._ARGS,
            )

    def test_unsupported_filter_type_raises(self):
        with pytest.raises(ValueError, match="Unsupported export filter"):
            data_export_query(
                filter_type="grid_ids",
                filter_value=["g1"],
                frequency=Frequency.HOURLY,
                **self._ARGS,
            )


class TestWorkerImports:
    def test_celery_app_imports_without_flask(self):
        """The worker image installs requirements.txt only (no Flask) — the
        module must import cleanly on config alone."""
        import celery_app

        assert celery_app.celery.conf.task_default_queue == "analytics"

    def test_devices_summary_imports(self):
        import devices_summary  # noqa: F401
