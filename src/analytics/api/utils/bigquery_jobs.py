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

from google.api_core.exceptions import Forbidden
from google.cloud import bigquery, storage

from api.utils.exceptions import QueryTooLarge
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


# BigQuery signals "this job would exceed maximum_bytes_billed" as a 403 whose
# reason is bytesBilledLimitExceeded.
_BYTES_LIMIT_REASONS = {"bytesBilledLimitExceeded", "billingTierLimitExceeded"}

# "Query exceeded limit for bytes billed: 1073741824. 5557452800 or higher
# required." — the second figure is what the job would have scanned.
_BYTES_BILLED_RE = re.compile(
    r"bytes billed:\s*(\d+)\D+?(\d+)\s+or higher required", re.IGNORECASE
)


def _is_bytes_limit_error(exc: Forbidden) -> bool:
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


@contextmanager
def log_cost_rejections(context: str):
    """
    Translate queries rejected for exceeding the byte ceiling into
    QueryTooLarge, which callers render as a 400 telling the requester to
    narrow the window.  Everything else propagates untouched.

    BigQuery applies `maximum_bytes_billed` while planning the job, so a
    rejection here means nothing was scanned and nothing was billed.

    The cap starts deliberately tight, so these log lines are the signal for
    where to set it: each one names the query that was refused and the limit
    it hit. Search the logs for "bigquery cost limit" to find them.
    """
    try:
        yield
    except Forbidden as exc:
        if not _is_bytes_limit_error(exc):
            raise
        limit, required = _parse_byte_figures(str(exc))
        limit = limit or settings.bigquery_max_bytes_billed
        logger.warning(
            "bigquery cost limit exceeded (%s): limit=%s bytes, required=%s bytes — "
            "raise BIGQUERY_MAX_BYTES_BILLED if this query is legitimate",
            context,
            limit,
            required,
        )
        raise QueryTooLarge(limit_bytes=limit, required_bytes=required) from exc


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

    # Dry runs are metadata-only and finish immediately; a deadline on them
    # would only add a way to fail.
    if not config.dry_run and getattr(config, "job_timeout_ms", None) is None:
        config.job_timeout_ms = settings.bigquery_job_timeout_ms

    return config
