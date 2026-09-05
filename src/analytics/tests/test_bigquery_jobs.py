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
from google.api_core.exceptions import Forbidden
from google.cloud import bigquery

from api.utils.bigquery_jobs import log_cost_rejections, query_job_config
from api.utils.exceptions import QueryTooLarge, format_bytes
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

    def test_dry_run_gets_no_deadline(self):
        """Dry runs are metadata-only; a timeout would only add a failure mode."""
        config = query_job_config(dry_run=True)
        assert config.job_timeout_ms is None

    def test_ceiling_tracks_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "bigquery_max_bytes_billed", 4242)
        assert query_job_config().maximum_bytes_billed == 4242


class TestCostRejectionLogging:
    def _forbidden(self, reason: str) -> Forbidden:
        return Forbidden("quota exceeded", errors=[{"reason": reason}])

    def test_logs_and_translates_byte_limit_rejection(self, caplog):
        """Raised as QueryTooLarge so callers can answer with a 400 telling
        the requester to narrow the window, instead of a bare 500."""
        with caplog.at_level(logging.WARNING):
            with pytest.raises(QueryTooLarge):
                with log_cost_rejections("unit-test"):
                    raise self._forbidden("bytesBilledLimitExceeded")

        assert "bigquery cost limit exceeded" in caplog.text
        assert "unit-test" in caplog.text

    def test_recognises_message_without_structured_reason(self, caplog):
        with caplog.at_level(logging.WARNING):
            with pytest.raises(QueryTooLarge):
                with log_cost_rejections("unit-test"):
                    raise Forbidden("Query exceeded limit for maximum bytes billed")

        assert "bigquery cost limit exceeded" in caplog.text

    def test_parses_the_limit_and_required_figures(self):
        """BigQuery states both numbers in the message; they drive the
        "shorten by about Nx" advice the caller renders."""
        message = (
            "Query exceeded limit for bytes billed: 1073741824. "
            "5557452800 or higher required."
        )
        with pytest.raises(QueryTooLarge) as exc:
            with log_cost_rejections("unit-test"):
                raise Forbidden(
                    message, errors=[{"reason": "bytesBilledLimitExceeded"}]
                )

        assert exc.value.limit_bytes == 1073741824
        assert exc.value.required_bytes == 5557452800
        # 5557452800 / 1073741824 = 5.17… → round up
        assert exc.value.reduction_factor == 6

    def test_falls_back_to_the_configured_limit_when_unparseable(self):
        with pytest.raises(QueryTooLarge) as exc:
            with log_cost_rejections("unit-test"):
                raise self._forbidden("bytesBilledLimitExceeded")

        assert exc.value.limit_bytes == settings.bigquery_max_bytes_billed
        assert exc.value.required_bytes is None
        assert exc.value.reduction_factor is None

    def test_original_forbidden_is_kept_as_the_cause(self):
        """The BigQuery text stays available for the logs even though the
        client sees the friendly message."""
        original = self._forbidden("bytesBilledLimitExceeded")
        with pytest.raises(QueryTooLarge) as exc:
            with log_cost_rejections("unit-test"):
                raise original

        assert exc.value.__cause__ is original

    def test_unrelated_forbidden_is_not_logged_as_cost(self, caplog):
        with caplog.at_level(logging.WARNING):
            with pytest.raises(Forbidden):
                with log_cost_rejections("unit-test"):
                    raise self._forbidden("accessDenied")

        assert "bigquery cost limit exceeded" not in caplog.text

    def test_other_exceptions_pass_through_untouched(self):
        with pytest.raises(ValueError):
            with log_cost_rejections("unit-test"):
                raise ValueError("unrelated")

    def test_success_path_is_transparent(self):
        with log_cost_rejections("unit-test"):
            result = 1 + 1
        assert result == 2


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
        "name",
        [
            "",
            "a.b.c.d",  # four parts
            "table; DROP TABLE x",
            "table`",  # would close the backtick quoting
            "tab le",
            "proj.`ds`.table",
        ],
    )
    def test_rejects_malformed_names(self, name):
        from api.utils.utils import Utils

        with pytest.raises(ValueError, match="Invalid BigQuery table name"):
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
