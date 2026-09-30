"""
Shared construction of BigQuery job configs.

Every query this service runs is billed by bytes scanned, and several of the
endpoints that issue them are reachable unauthenticated. Before this helper
existed there was no ceiling anywhere in the codebase: a single wide-window
request could scan a whole partitioned table, and a runaway query had no
deadline. `maximum_bytes_billed` makes BigQuery reject such a job outright
rather than run it, so the cap is enforced server-side rather than by hoping
callers behave.

Use `query_job_config(...)` in place of `bigquery.QueryJobConfig(...)`; it
accepts the same keyword arguments and simply layers the guards on top.
"""

from __future__ import annotations

import logging
import re
from contextlib import contextmanager
from functools import lru_cache
from typing import Any

from google.api_core.exceptions import GoogleAPICallError
from google.cloud import bigquery, storage

from api.utils.exceptions import QueryCancelled, QueryTimedOut, QueryTooLarge
from config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def shared_bigquery_client() -> bigquery.Client:
    """
    One BigQuery client per process.

    Constructing a client resolves Application Default Credentials — reading
    the service-account file from disk and, on GKE, calling the metadata
    server over HTTP. That was happening per request, on the event loop,
    inside `async def` handlers. Mirrors the `@lru_cache`'d MongoClient in
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


def _stop_message(exc: GoogleAPICallError) -> str | None:
    """The message of a stopped job, or None for any other error."""
    for error in exc.errors or []:
        get = getattr(error, "get", lambda _k: None)
        if get("reason") == _STOPPED_REASON:
            return get("message") or str(exc)
    return None


@contextmanager
def translate_incomplete_queries(context: str, *, depends_on_request: bool = True):
    """
    Translate a query that BigQuery did not complete into the matching
    QueryNotCompleted subclass, which callers render as the response that
    tells the requester what to do.  Everything else propagates untouched.

    A query over the byte ceiling becomes QueryTooLarge.  BigQuery applies
    `maximum_bytes_billed` while planning the job, so that refusal means
    nothing was scanned and nothing was billed.  Search the logs for
    "bigquery cost limit" to find them.

    A query stopped at `job_timeout_ms` becomes QueryTimedOut.  BigQuery
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
    except GoogleAPICallError as exc:
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
        if message is None:
            raise
        if _TIMED_OUT_TEXT in message.lower():
            timeout_ms = settings.bigquery_job_timeout_ms
            logger.warning(
                "bigquery job timed out (%s): limit=%s ms", context, timeout_ms
            )
            raise QueryTimedOut(
                timeout_ms=timeout_ms, depends_on_request=depends_on_request
            ) from exc
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
