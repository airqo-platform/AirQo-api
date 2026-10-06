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
from google.api_core.exceptions import (
    BadRequest,
    Cancelled,
    Forbidden,
    InternalServerError,
    PermissionDenied,
    RetryError,
    TooManyRequests,
    from_http_status,
)
from google.rpc import error_details_pb2

from api.utils.bigquery_jobs import translate_incomplete_queries, query_job_config
from api.utils.exceptions import (
    QueryCancelled,
    QueryForbidden,
    QueryRateLimited,
    QueryTimedOut,
    QueryTooLarge,
)
from config import settings


class TestQueryJobConfig:
    def test_applies_job_timeout_by_default(self):
        config = query_job_config()
        # The SDK round-trips this through the REST body, so it comes back a str.
        assert int(config.job_timeout_ms) == settings.bigquery_job_timeout_ms

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

    def test_unrelated_api_error_passes_through(self):
        original = BadRequest("Syntax error", errors=[{"reason": "invalidQuery"}])
        with pytest.raises(BadRequest) as exc:
            with translate_incomplete_queries("unit-test"):
                raise original

        assert exc.value is original

    def test_other_exceptions_pass_through_untouched(self):
        with pytest.raises(ValueError):
            with translate_incomplete_queries("unit-test"):
                raise ValueError("unrelated")


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


def _helper_records(caplog):
    return [r for r in caplog.records if r.name == "api.utils.bigquery_jobs"]


class TestForbiddenTranslation:
    """Every form of a 403 becomes QueryForbidden and writes one ERROR record
    that carries the reason."""

    @pytest.mark.parametrize(
        "reason,transient",
        [
            ("accessDenied", False),
            ("billingNotEnabled", False),
            ("blocked", False),
            ("quotaExceeded", True),
            ("rateLimitExceeded", True),
            ("responseTooLarge", False),
        ],
    )
    def test_forbidden_becomes_query_forbidden(self, caplog, reason, transient):
        # from_http_status builds the error the way the library does for a
        # refused request and for a failed job.
        original = from_http_status(
            403, "refused", errors=[{"reason": reason, "message": "refused"}]
        )
        with caplog.at_level(logging.ERROR, logger="api.utils.bigquery_jobs"):
            with pytest.raises(QueryForbidden) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise original

        assert exc.value.reason == reason
        assert exc.value.transient is transient
        assert exc.value.__cause__ is original
        records = _helper_records(caplog)
        assert [r.levelno for r in records] == [logging.ERROR]
        assert reason in records[0].args

    def test_forbidden_inside_nested_retry_errors(self, caplog):
        """The retry of a query insert wraps the RetryError of the request
        retry, so a rate refusal arrives two levels deep."""
        forbidden = Forbidden("rate", errors=[{"reason": "rateLimitExceeded"}])
        wrapped = RetryError("insert retry", RetryError("request retry", forbidden))
        with caplog.at_level(logging.ERROR, logger="api.utils.bigquery_jobs"):
            with pytest.raises(QueryForbidden) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise wrapped

        assert exc.value.reason == "rateLimitExceeded"
        assert exc.value.__cause__ is wrapped
        assert len(_helper_records(caplog)) == 1

    def test_retry_error_without_a_forbidden_passes_through(self):
        wrapped = RetryError("request retry", InternalServerError("backend"))
        with pytest.raises(RetryError) as exc:
            with translate_incomplete_queries("unit-test"):
                raise wrapped

        assert exc.value is wrapped

    def test_permission_denied_carries_its_grpc_reason(self):
        """The read session of a row download raises PermissionDenied, whose
        reason comes from the gRPC error details."""
        info = error_details_pb2.ErrorInfo(reason="IAM_PERMISSION_DENIED")
        with pytest.raises(QueryForbidden) as exc:
            with translate_incomplete_queries("unit-test"):
                raise PermissionDenied("denied", error_info=info)

        assert exc.value.reason == "IAM_PERMISSION_DENIED"

    def test_forbidden_without_a_reason(self):
        with pytest.raises(QueryForbidden) as exc:
            with translate_incomplete_queries("unit-test"):
                raise PermissionDenied("denied")

        assert exc.value.reason == "unknown"
        assert exc.value.transient is False

    def test_rest_forbidden_with_its_reason_in_an_error_info_detail(self):
        """A REST response can carry its reason only in an ErrorInfo detail."""
        original = from_http_status(
            403,
            "API disabled",
            details=[
                {
                    "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                    "reason": "SERVICE_DISABLED",
                }
            ],
        )
        with pytest.raises(QueryForbidden) as exc:
            with translate_incomplete_queries("unit-test"):
                raise original

        assert exc.value.reason == "SERVICE_DISABLED"


class TestRateLimitTranslation:
    """A rate refusal that arrives as any error other than a Forbidden becomes
    QueryRateLimited and writes one ERROR record that carries the reason."""

    def test_rate_limited_job_after_the_job_retry(self, caplog):
        """The library raises TooManyRequests for a job that failed with
        rateLimitExceeded, and wraps it in a RetryError when its job retry
        ends."""
        too_many = TooManyRequests(
            "rate", errors=[{"reason": "rateLimitExceeded", "message": "rate"}]
        )
        wrapped = RetryError("job retry", too_many)
        with caplog.at_level(logging.ERROR, logger="api.utils.bigquery_jobs"):
            with pytest.raises(QueryRateLimited) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise wrapped

        assert exc.value.reason == "rateLimitExceeded"
        assert exc.value.transient is True
        assert exc.value.__cause__ is wrapped
        records = _helper_records(caplog)
        assert [r.levelno for r in records] == [logging.ERROR]
        assert "rateLimitExceeded" in records[0].args

    def test_record_names_the_rate_reason_among_other_reasons(self):
        original = InternalServerError(
            "job failed",
            errors=[{"reason": "invalid"}, {"reason": "jobRateLimitExceeded"}],
        )
        with pytest.raises(QueryRateLimited) as exc:
            with translate_incomplete_queries("unit-test"):
                raise original

        assert exc.value.reason == "jobRateLimitExceeded"

    def test_too_many_requests_without_a_reason(self):
        with pytest.raises(QueryRateLimited) as exc:
            with translate_incomplete_queries("unit-test"):
                raise TooManyRequests("rate")

        assert exc.value.reason == "unknown"
        assert exc.value.transient is True


class TestTimeoutReasonTranslation:
    """A job error with the reason "timeout" becomes QueryTimedOut, as a job
    stopped at the job timeout does."""

    @pytest.mark.parametrize("error_class", [InternalServerError, BadRequest])
    def test_timeout_reason_becomes_query_timed_out(self, caplog, error_class):
        # The library raises InternalServerError for a job error with this
        # reason, and BadRequest for a REST error with it.
        original = error_class(
            "Job execution timeout exceeded", errors=[{"reason": "timeout"}]
        )
        with caplog.at_level(logging.WARNING, logger="api.utils.bigquery_jobs"):
            with pytest.raises(QueryTimedOut) as exc:
                with translate_incomplete_queries("unit-test"):
                    raise original

        assert exc.value.timeout_ms == settings.bigquery_job_timeout_ms
        assert exc.value.__cause__ is original
        assert [r.levelno for r in _helper_records(caplog)] == [logging.WARNING]


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
