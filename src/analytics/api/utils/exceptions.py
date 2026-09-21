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


class QueryTooLarge(Exception):
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
