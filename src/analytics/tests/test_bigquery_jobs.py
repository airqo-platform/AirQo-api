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

    def test_logs_and_reraises_byte_limit_rejection(self, caplog):
        with caplog.at_level(logging.WARNING):
            with pytest.raises(Forbidden):
                with log_cost_rejections("unit-test"):
                    raise self._forbidden("bytesBilledLimitExceeded")

        assert "bigquery cost limit exceeded" in caplog.text
        assert "unit-test" in caplog.text

    def test_recognises_message_without_structured_reason(self, caplog):
        with caplog.at_level(logging.WARNING):
            with pytest.raises(Forbidden):
                with log_cost_rejections("unit-test"):
                    raise Forbidden("Query exceeded limit for maximum bytes billed")

        assert "bigquery cost limit exceeded" in caplog.text

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
