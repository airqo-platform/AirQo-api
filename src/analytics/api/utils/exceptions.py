from __future__ import annotations

from typing import Optional


class PrivacyScreeningUnavailable(Exception):
    """device-registry could not be reached to screen private members.

    Raised by the report builder on the public path only.  It is deliberately
    fail-closed: serving an unscreened report because the registry was down
    would publish exactly the entries screening exists to withhold.  The
    service layer maps this to a 503.
    """

    def __init__(
        self, message: str = "Unable to verify site/device privacy status."
    ) -> None:
        self.message = message
        super().__init__(message)


class ExportRequestNotFound(Exception):
    def __init__(self, message="Export request does not exist", request_id=""):
        self.message = message
        if request_id != "":
            self.message = f"Export request with id {request_id} does not exist"
        super().__init__(self.message)


def format_bytes(num_bytes: Optional[int]) -> str:
    """Render a byte count as a short human-readable size (e.g. "5.2 GB")."""
    if num_bytes is None or num_bytes < 0:
        return "an unknown amount"
    units = ("bytes", "KB", "MB", "GB", "TB")
    idx = 0
    value = float(num_bytes)
    while value >= 1024 and idx < len(units) - 1:
        value /= 1024
        idx += 1
    if idx == 0:
        return f"{int(value)} {units[idx]}"
    return f"{value:.1f} {units[idx]}"


class QueryNotCompleted(Exception):
    """
    BigQuery did not complete a query.

    api/utils/bigquery_jobs.translate_incomplete_queries raises one subclass
    for each cause, and the service layer (api.services._query_error) answers
    each one with the response that tells the requester what to do.
    """


class QueryTooLarge(QueryNotCompleted):
    """
    BigQuery refused a query for exceeding the bytes-billed ceiling.

    The ceiling (settings.bigquery_max_bytes_billed, applied by
    api/utils/bigquery_jobs.query_job_config) is enforced by BigQuery when it
    plans the job, so a query raising this scanned nothing and cost nothing.

    Bytes are billed per partition scanned, so the date range drives the
    figure: narrowing the window is what brings a refused query under the
    ceiling.  Filtering to fewer sites or devices does not, since those are
    applied after the scan.

    This class carries the two figures.  api.services._too_large_error renders
    them for the operator log and builds the response the requester sees.
    """

    def __init__(self, limit_bytes: int, required_bytes: Optional[int] = None) -> None:
        self.limit_bytes = limit_bytes
        self.required_bytes = required_bytes
        super().__init__()


class QueryTimedOut(QueryNotCompleted):
    """
    BigQuery stopped a query that ran longer than the job timeout.

    The timeout (settings.bigquery_job_timeout_ms, applied by
    api/utils/bigquery_jobs.query_job_config) is applied by BigQuery while
    the job runs.  BigQuery might attempt to stop the job, and a stopped job
    can still incur costs depending on the stage at which it was stopped, up
    to the byte ceiling.

    This class carries the timeout in milliseconds and whether the request
    shapes the query: a query built from the request's date range, filters or
    frequency (``depends_on_request=True``) gets a response that names those
    fields, and a query fixed by the service, such as a membership lookup,
    gets a response that asks the caller to try again.
    """

    def __init__(self, timeout_ms: int, depends_on_request: bool = True) -> None:
        self.timeout_ms = timeout_ms
        self.depends_on_request = depends_on_request
        super().__init__()


class QueryCancelled(QueryNotCompleted):
    """
    A query was cancelled before it finished, for a reason other than the
    job timeout, such as a cancel request from the console or the bq tool.

    The request itself was valid, so the same request can succeed when it is
    sent again.  This class carries the message BigQuery gave for the stop.
    """

    def __init__(self, message: str = "") -> None:
        self.message = message
        super().__init__(message)
