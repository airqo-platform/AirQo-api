"""
Shared construction of BigQuery job configs, and the translation of the
errors BigQuery returns for a request it did not complete.

Every query this service runs is billed by bytes scanned, and several of the
endpoints that issue them are reachable unauthenticated.  `maximum_bytes_billed`
makes BigQuery reject a job over the ceiling outright rather than run it, so
the cap is enforced server-side.

Use `query_job_config(...)` in place of `bigquery.QueryJobConfig(...)`; it
accepts the same keyword arguments and layers the guards on top.  Run each
BigQuery and Cloud Storage request inside `translate_incomplete_queries`.
"""

from __future__ import annotations

import logging
import re
from contextlib import contextmanager
from functools import lru_cache
from typing import Any, Optional

from google.api_core.exceptions import (
    Forbidden,
    GoogleAPICallError,
    RetryError,
    TooManyRequests,
)
from google.cloud import bigquery, storage

from api.utils.exceptions import (
    QueryCancelled,
    QueryForbidden,
    QueryRateLimited,
    QueryTimedOut,
    QueryTooLarge,
)
from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def shared_bigquery_client() -> bigquery.Client:
    """
    One BigQuery client per process.

    Constructing a client resolves Application Default Credentials, which
    reads the service-account file from disk and, on GKE, calls the metadata
    server over HTTP.  Mirrors the `@lru_cache`'d MongoClient in
    api/models/base/mongo_base.py.
    """
    return bigquery.Client()


@lru_cache(maxsize=1)
def shared_storage_client() -> storage.Client:
    """One GCS client per process — same reasoning as the BigQuery client."""
    return storage.Client()


# BigQuery signals "this job would exceed maximum_bytes_billed" with the reason
# bytesBilledLimitExceeded.  A real refusal arrived as
# google.api_core.exceptions.InternalServerError (HTTP 500).  The translation
# identifies the refusal by its reason and its message.
_BYTES_LIMIT_REASONS = {"bytesBilledLimitExceeded", "billingTierLimitExceeded"}

# "Query exceeded limit for bytes billed: 1073741824. 5557452800 or higher
# required." — the second figure is what the job would have scanned.
_BYTES_BILLED_RE = re.compile(
    r"bytes billed:\s*(\d+)\D+?(\d+)\s+or higher required", re.IGNORECASE
)


def _is_bytes_limit_error(exc: GoogleAPICallError) -> bool:
    return (
        any(
            getattr(error, "get", lambda _k: None)("reason") in _BYTES_LIMIT_REASONS
            for error in (exc.errors or [])
        )
        or "maximum bytes billed" in str(exc).lower()
        or "limit for bytes billed" in str(exc).lower()
    )


def _parse_byte_figures(message: str) -> tuple[int | None, int | None]:
    """Pull (limit, required) out of BigQuery's rejection message."""
    match = _BYTES_BILLED_RE.search(message)
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


# BigQuery reports a job stopped at `job_timeout_ms` and a job cancelled
# through jobs.cancel with the same reason, "stopped".  Both arrived as
# google.api_core.exceptions.Cancelled (HTTP 499) from real jobs.  The
# translation identifies a stopped job by its reason, and the message tells
# the two apart.  Observed:
#   "Job execution was cancelled: Job timed out after 2 sec"
#   "Job execution was cancelled: User requested cancellation"
_STOPPED_REASON = "stopped"
_TIMED_OUT_TEXT = "job timed out"

# The BigQuery error reference also lists the reason "timeout" (HTTP 400) for
# a job whose execution exceeded its timeout.  The reason table of the library
# has no entry for it, so a job error with this reason arrives as
# InternalServerError, and a REST error with it arrives as BadRequest.
_TIMEOUT_REASON = "timeout"

# The reasons of a rate refusal.  The library raises TooManyRequests for a job
# that failed with rateLimitExceeded, and restarts a job that failed with
# either reason until its job retry ends.
_RATE_LIMIT_REASONS = frozenset({"rateLimitExceeded", "jobRateLimitExceeded"})


def _stop_message(exc: GoogleAPICallError) -> str | None:
    """The message of a stopped job, or None for any other error."""
    for error in exc.errors or []:
        get = getattr(error, "get", lambda _k: None)
        if get("reason") == _STOPPED_REASON:
            return get("message") or str(exc)
    return None


def _has_reason(exc: GoogleAPICallError, reason: str) -> bool:
    """True when a dictionary in exc.errors carries the reason."""
    return any(
        getattr(error, "get", lambda _k: None)("reason") == reason
        for error in exc.errors or []
    )


# A 403 arrives as Forbidden from a REST request and from a job error, and as
# its subclass PermissionDenied from the gRPC read session that to_dataframe
# opens.  The library retries a 403 with the reason rateLimitExceeded.  A 403
# that is still refused at the end of the retry arrives wrapped in a
# RetryError, and the retry of a query insert wraps that RetryError in a
# second one.  The cause of the innermost RetryError is the last Forbidden.
def _forbidden_cause(exc: Exception) -> Optional[Forbidden]:
    """The Forbidden that an error carries, or None for any other error."""
    while isinstance(exc, RetryError):
        exc = exc.cause
    return exc if isinstance(exc, Forbidden) else None


def _rate_limit_cause(exc: Exception) -> Optional[GoogleAPICallError]:
    """The rate refusal that an error carries, or None for any other error."""
    while isinstance(exc, RetryError):
        exc = exc.cause
    if isinstance(exc, TooManyRequests):
        return exc
    if isinstance(exc, GoogleAPICallError) and any(
        _has_reason(exc, reason) for reason in _RATE_LIMIT_REASONS
    ):
        return exc
    return None


# The reason of a job error and of a REST error is the "reason" key of a
# dictionary in exc.errors.  A REST error can also carry its reason in an
# ErrorInfo dictionary in exc.details.  A gRPC error, such as the
# PermissionDenied of a read session, carries the call object in exc.errors
# and its reason in exc.reason.  exc.reason raises AttributeError when the
# library stored the error details of a REST response as a plain dictionary.
_ERROR_INFO_TYPE = "type.googleapis.com/google.rpc.ErrorInfo"


def _error_reason(exc: GoogleAPICallError, preferred=frozenset()) -> str:
    """
    The reason code of the error, or "unknown" when it carries none.

    A reason in ``preferred`` comes before the other reasons of the error,
    so the record names the reason that selected the translation.
    """
    reasons = [
        str(reason)
        for reason in (
            getattr(error, "get", lambda _k: None)("reason")
            for error in exc.errors or []
        )
        if reason
    ]
    for reason in reasons:
        if reason in preferred:
            return reason
    if reasons:
        return reasons[0]
    for detail in exc.details or []:
        get = getattr(detail, "get", lambda _k: None)
        if get("@type") == _ERROR_INFO_TYPE and get("reason"):
            return str(get("reason"))
    try:
        reason = exc.reason
    except AttributeError:
        reason = None
    return str(reason) if reason else "unknown"


@contextmanager
def translate_incomplete_queries(context: str, *, depends_on_request: bool = True):
    """
    Translate a request that BigQuery did not complete into the matching
    QueryNotCompleted subclass, which callers render as the response that
    tells the requester what to do.  Every other error propagates untouched.

    A request refused with HTTP 403 becomes QueryForbidden, which carries the
    reason code of the refusal.  The record names the reason and the
    BigQuery message, so an operator can tell a permission or billing
    refusal from a quota or rate refusal.  The requester receives a fixed
    message from the service layer.  Search the logs for "bigquery request
    forbidden" to find them.

    A request refused for rate with any other error, such as the
    TooManyRequests of a job that failed with rateLimitExceeded, becomes
    QueryRateLimited, which carries the reason code.  Search the logs for
    "bigquery request rate limited" to find them.

    A query over the byte ceiling becomes QueryTooLarge.  BigQuery applies
    `maximum_bytes_billed` while planning the job, so that refusal means
    nothing was scanned and nothing was billed.  Search the logs for
    "bigquery cost limit" to find them.

    A query stopped at `job_timeout_ms`, and a job that failed with the
    reason "timeout", become QueryTimedOut.  BigQuery
    might attempt to stop the job, and a stopped job can still incur costs
    depending on the stage at which it was stopped, up to the byte ceiling.
    ``depends_on_request`` is carried on the exception: False marks a query
    the service builds from fixed values, such as a membership lookup.  Search the logs for
    "bigquery job timed out" to find them.

    A query cancelled for any other reason, such as a cancel request from the
    console or the bq tool, becomes QueryCancelled.  Search the logs for
    "bigquery job cancelled" to find them.
    """
    try:
        yield
    except (GoogleAPICallError, RetryError) as exc:
        forbidden = _forbidden_cause(exc)
        if forbidden is not None:
            reason = _error_reason(forbidden)
            logger.error(
                "bigquery request forbidden (%s): reason=%s: %s",
                context,
                reason,
                forbidden.message,
            )
            raise QueryForbidden(reason=reason, message=forbidden.message) from exc
        rate_limited = _rate_limit_cause(exc)
        if rate_limited is not None:
            reason = _error_reason(rate_limited, _RATE_LIMIT_REASONS)
            logger.error(
                "bigquery request rate limited (%s): reason=%s: %s",
                context,
                reason,
                rate_limited.message,
            )
            raise QueryRateLimited(reason=reason, message=rate_limited.message) from exc
        if isinstance(exc, RetryError):
            raise
        if _is_bytes_limit_error(exc):
            limit, required = _parse_byte_figures(str(exc))
            limit = limit or settings.bigquery_max_bytes_billed
            logger.warning(
                "bigquery cost limit exceeded (%s): limit=%s bytes, required=%s "
                "bytes — raise BIGQUERY_MAX_BYTES_BILLED if this query is legitimate",
                context,
                limit,
                required,
            )
            raise QueryTooLarge(limit_bytes=limit, required_bytes=required) from exc
        message = _stop_message(exc)
        if _has_reason(exc, _TIMEOUT_REASON) or (
            message is not None and _TIMED_OUT_TEXT in message.lower()
        ):
            timeout_ms = settings.bigquery_job_timeout_ms
            logger.warning(
                "bigquery job timed out (%s): limit=%s ms", context, timeout_ms
            )
            raise QueryTimedOut(
                timeout_ms=timeout_ms, depends_on_request=depends_on_request
            ) from exc
        if message is None:
            raise
        logger.warning("bigquery job cancelled (%s): %s", context, message)
        raise QueryCancelled(message=message) from exc


def query_job_config(**kwargs: Any) -> bigquery.QueryJobConfig:
    """
    Build a QueryJobConfig with cost and time guards applied.

    Explicitly passed `maximum_bytes_billed` / `job_timeout_ms` win, so a
    caller with a legitimately larger job (the export worker, say) can raise
    its own ceiling without removing the default for everyone else.
    """
    config = bigquery.QueryJobConfig(**kwargs)

    if config.maximum_bytes_billed is None:
        config.maximum_bytes_billed = settings.bigquery_max_bytes_billed

    if getattr(config, "job_timeout_ms", None) is None:
        config.job_timeout_ms = settings.bigquery_job_timeout_ms

    return config
