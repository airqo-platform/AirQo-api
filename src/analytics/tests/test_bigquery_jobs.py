"""
Tests for BigQuery cost/time guards (api/utils/bigquery_jobs.py).

Every query this service runs is billed by bytes scanned and several of the
endpoints issuing them are unauthenticated, so the ceiling is enforced
server-side by BigQuery rather than by trusting callers. The cap starts
deliberately tight, which makes the rejection logging part of the contract:
it is how the right value gets discovered.
"""

from __future__ import annotations

import logging

import pytest
from google.api_core.exceptions import Cancelled, Forbidden, InternalServerError
from google.cloud import bigquery

from api.utils.bigquery_jobs import translate_incomplete_queries, query_job_config
from api.utils.exceptions import (
    QueryCancelled,
    QueryTimedOut,
    QueryTooLarge,
    format_bytes,
)
from config import settings


class TestQueryJobConfig:
    def test_applies_byte_ceiling_by_default(self):
        config = query_job_config()
        assert config.maximum_bytes_billed == settings.bigquery_max_bytes_billed

    def test_applies_job_timeout_by_default(self):
        config = query_job_config()
        # The SDK round-trips this through the REST body, so it comes back a str.
        assert int(config.job_timeout_ms) == settings.bigquery_job_timeout_ms

    def test_preserves_caller_kwargs(self):
        params = [bigquery.ScalarQueryParameter("x", "STRING", "y")]
        config = query_job_config(query_parameters=params)
        assert config.query_parameters == params
        assert config.maximum_bytes_billed == settings.bigquery_max_bytes_billed

    def test_explicit_ceiling_wins(self):
        """The export worker can legitimately need a larger budget than the
        request path without lifting the default for everyone."""
        config = query_job_config(maximum_bytes_billed=99)
        assert config.maximum_bytes_billed == 99

    def test_ceiling_tracks_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "bigquery_max_bytes_billed", 4242)
        assert query_job_config().maximum_bytes_billed == 4242


def byte_limit_refusal():
    """The error BigQuery returned for a query over maximum_bytes_billed, as
    captured from a real job with a limit of 1000 bytes."""
    message = (
        "Query exceeded limit for bytes billed: 1000. 10485760 or higher required."
    )
    return InternalServerError(
        message, errors=[{"reason": "bytesBilledLimitExceeded", "message": message}]
    )


class TestByteLimitTranslation:
    def test_refusal_becomes_query_too_large(self, caplog):
        """Raised as QueryTooLarge so callers can answer with a 400 telling
        the requester to narrow the window, instead of a bare 500. The figures
        come from the BigQuery message, and the original error stays available
        for the logs."""
        original = byte_limit_refusal()
        with caplog.at_level(logging.WARNING):
            with pytest.raises(QueryTooLarge) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise original

        assert exc.value.limit_bytes == 1000
        assert exc.value.required_bytes == 10485760
        assert exc.value.__cause__ is original
        assert "bigquery cost limit exceeded" in caplog.text
        assert "unit-test" in caplog.text

    def test_unrelated_api_error_passes_through(self, caplog):
        with caplog.at_level(logging.WARNING):
            with pytest.raises(Forbidden):
                with translate_incomplete_queries("unit-test"):
                    raise Forbidden(
                        "Access Denied", errors=[{"reason": "accessDenied"}]
                    )

        assert "bigquery cost limit exceeded" not in caplog.text

    def test_other_exceptions_pass_through_untouched(self):
        with pytest.raises(ValueError):
            with translate_incomplete_queries("unit-test"):
                raise ValueError("unrelated")

    def test_success_path_is_transparent(self):
        with translate_incomplete_queries("unit-test"):
            result = 1 + 1
        assert result == 2


def _stopped(message: str) -> Cancelled:
    """The error BigQuery returns for a stopped job, as captured from real jobs.

    A job stopped at job_timeout_ms and a job cancelled through jobs.cancel
    both arrived as Cancelled (HTTP 499) with the reason "stopped"; only the
    message differs.
    """
    return Cancelled(
        message, errors=[{"message": message, "domain": "global", "reason": "stopped"}]
    )


class TestStoppedJobTranslation:
    """A stopped job becomes QueryTimedOut when BigQuery stopped it at the job
    timeout, and QueryCancelled when it was cancelled for any other reason."""

    def test_job_stopped_at_the_timeout_becomes_query_timed_out(self, caplog):
        stopped = _stopped("Job execution was cancelled: Job timed out after 2 sec")
        with caplog.at_level(logging.WARNING):
            with pytest.raises(QueryTimedOut) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise stopped

        assert exc.value.timeout_ms == settings.bigquery_job_timeout_ms
        assert exc.value.depends_on_request is True
        assert exc.value.__cause__ is stopped
        assert "bigquery job timed out" in caplog.text

    def test_cancel_request_becomes_query_cancelled(self, caplog):
        stopped = _stopped("Job execution was cancelled: User requested cancellation")
        with caplog.at_level(logging.WARNING):
            with pytest.raises(QueryCancelled) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise stopped

        assert exc.value.__cause__ is stopped
        assert "bigquery job cancelled" in caplog.text


class TestByteFormatting:
    @pytest.mark.parametrize(
        "num_bytes,expected",
        [
            (1073741824, "1.0 GB"),
            (5557452800, "5.2 GB"),
            (1536, "1.5 KB"),
            (512, "512 bytes"),
            (0, "0 bytes"),
            (None, "an unknown amount"),
            (-1, "an unknown amount"),
        ],
    )
    def test_renders_sizes_a_person_can_read(self, num_bytes, expected):
        assert format_bytes(num_bytes) == expected


class TestTableNameValidation:
    """Table names come from operator config and are interpolated into SQL
    rather than bound, so the shape is checked before it reaches a query."""

    @pytest.mark.parametrize(
        "name",
        [
            "measurements",
            "metadata.devices",
            "airqo-250220.metadata.devices_devices",
            "proj_1.ds-2.table_3",
            # Hyphens are required for GCP project IDs, so "--" is allowed;
            # inside backticks it is part of the identifier, not a comment.
            "odd--name",
        ],
    )
    def test_accepts_bare_and_qualified_names(self, name):
        from api.utils.utils import Utils

        assert Utils.table_name(name) == f"`{name}`"

    @pytest.mark.parametrize(
        "name,expected",
        [
            ("`measurements`", "`measurements`"),
            (
                "`airqo-250220.consolidated_data_stage.hourly_device_measurements`",
                "`airqo-250220.consolidated_data_stage.hourly_device_measurements`",
            ),
            ("  `metadata.devices`  ", "`metadata.devices`"),
            ("` metadata.devices `", "`metadata.devices`"),
        ],
    )
    def test_wrapping_an_already_quoted_name_is_idempotent(self, name, expected):
        """Some deployments configure the backticks into the value itself.
        Wrapping again would emit ``name`` and fail the query."""
        from api.utils.utils import Utils

        assert Utils.table_name(name) == expected

    @pytest.mark.parametrize(
        "name",
        [
            "",
            "a.b.c.d",  # four parts
            "table; DROP TABLE x",
            "table`",  # would close the backtick quoting
            "`table",  # unmatched, so the pair is not stripped
            "``",
            "tab$le",
            "   ",  # whitespace-only collapses to empty
            "proj.`ds`.table",
            "`proj.`ds`.table`",
        ],
    )
    def test_rejects_malformed_names(self, name):
        from api.utils.utils import Utils

        with pytest.raises(ValueError, match="not a valid BigQuery table name"):
            Utils.table_name(name)

    def test_every_configured_table_passes(self):
        """A malformed setting should fail loudly here, not mid-query."""
        from api.utils.utils import Utils

        configured = [
            v
            for k, v in vars(settings).items()
            if k.startswith("bigquery_") and isinstance(v, str)
        ]
        assert configured, "expected bigquery_* settings to be present"
        for table in configured:
            assert Utils.table_name(table).startswith("`")
