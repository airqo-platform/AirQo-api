"""
Support for the paging tests.

The module holds an in-memory stand-in for the BigQuery client that stores
each query result and serves pages of it by row offset, a fixed clock for the
cursor module, result frames and request bodies with 2026 dates, and helpers
that read and change cursor tokens.
"""

from __future__ import annotations

import itertools
import json
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import Any, Dict, List, Optional

import pandas as pd
from google.api_core.exceptions import NotFound

from api.utils.cursor_utils import _b64decode, _b64encode

PROJECT = "test-project"
LOCATION = "europe-west1"


# ---------------------------------------------------------------------------
# Fake BigQuery client
# ---------------------------------------------------------------------------


class FakeRowIterator:
    """
    FakeRowIterator serves one read of a stored result from ``start_index`` on.

    The read honours ``start_index`` when the caller sets ``max_results`` or
    turns the Storage Read API off, as the real client does.
    """

    def __init__(
        self, client: "FakeBigQueryClient", job_id: str, start_index, max_results
    ):
        self._client = client
        self._job_id = job_id
        self._start = start_index or 0
        self._max = max_results
        self.total_rows = len(client.stored[job_id])

    def to_dataframe(self, *args, create_bqstorage_client: bool = True, **kwargs):
        frame = self._client.stored[self._job_id]
        if self._max is None and create_bqstorage_client:
            # The Storage Read API path reads the table from its first row.
            page = frame
        elif self._max is None:
            page = frame.iloc[self._start :]
        else:
            page = frame.iloc[self._start : self._start + self._max]
        self._client.reads.append(
            SimpleNamespace(
                job_id=self._job_id,
                start_index=self._start,
                max_results=self._max,
                bqstorage=create_bqstorage_client,
                rows=len(page),
            )
        )
        return page.reset_index(drop=True).copy()


class FakeQueryJob:
    """FakeQueryJob stands in for a query job of the fake client."""

    job_type = "query"

    def __init__(self, client: "FakeBigQueryClient", job_id: str):
        self._client = client
        self.job_id = job_id
        self.project = client.project
        self.location = client.location

    def result(
        self,
        page_size=None,
        max_results=None,
        retry=None,
        timeout=None,
        start_index=None,
        job_retry=None,
    ):
        return self._client._rows(self.job_id, start_index, max_results)


class FakeBigQueryClient:
    """
    FakeBigQueryClient stores each query result in memory.

    ``result_frame`` is the result of the next query.  ``queries``,
    ``job_lookups`` and ``reads`` record every call, so a test can prove how
    many queries ran and which rows each page read.  Every read raises
    ``read_error`` when a test sets it.
    """

    def __init__(self) -> None:
        self.project = PROJECT
        self.location = LOCATION
        self.result_frame = pd.DataFrame()
        self.stored: Dict[str, pd.DataFrame] = {}
        self.jobs: set = set()
        self.queries: List[Any] = []
        self.job_lookups: List[Any] = []
        self.reads: List[Any] = []
        self.read_error: Optional[Exception] = None
        self._ids = itertools.count(1)

    def query(self, query, job_config=None, **kwargs) -> FakeQueryJob:
        self.queries.append(SimpleNamespace(sql=query, job_config=job_config))
        job_id = f"job_2026_{next(self._ids)}"
        self.stored[job_id] = self.result_frame.reset_index(drop=True).copy()
        self.jobs.add(job_id)
        return FakeQueryJob(self, job_id)

    def get_job(self, job_id, project=None, location=None, **kwargs) -> FakeQueryJob:
        self.job_lookups.append(SimpleNamespace(job_id=job_id, location=location))
        if job_id not in self.jobs or location != self.location:
            raise NotFound(f"Not found: Job {self.project}:{location}.{job_id}")
        return FakeQueryJob(self, job_id)

    def expire_result(self, job_id: str) -> None:
        """Remove the stored result while the job record stays."""
        self.stored.pop(job_id)

    def forget_job(self, job_id: str) -> None:
        """Remove the job record and its stored result."""
        self.jobs.discard(job_id)
        self.stored.pop(job_id, None)

    def _rows(self, job_id, start_index, max_results) -> FakeRowIterator:
        if self.read_error is not None:
            raise self.read_error
        if job_id not in self.stored:
            raise NotFound(f"Not found: Table {self.project}:_anon.anon_{job_id}")
        return FakeRowIterator(self, job_id, start_index, max_results)


# ---------------------------------------------------------------------------
# Fixed clock for api/utils/cursor_utils
# ---------------------------------------------------------------------------


class CursorClock:
    """CursorClock replaces the clock of ``api.utils.cursor_utils`` and starts at 12:00 UTC on 2026-03-02."""

    def __init__(self) -> None:
        self._now = datetime(2026, 3, 2, 12, tzinfo=timezone.utc).timestamp()

    def time(self) -> float:
        return self._now

    def advance(self, seconds: float) -> None:
        self._now += seconds


# ---------------------------------------------------------------------------
# Result frames
# ---------------------------------------------------------------------------

DEVICE_COLUMNS = [
    "datetime",
    "timestamp",
    "device_id",
    "site_id",
    "site_name",
    "network",
    "pm2_5",
]


def device_frame(rows: int) -> pd.DataFrame:
    """
    Build ``rows`` hourly rows for two devices on 2026-03-01, in time order.

    Each row carries a distinct ``pm2_5`` value, and the pair (datetime,
    device_id) is unique, so a cleaning step keeps every row.
    """
    records = []
    for index in range(rows):
        hour, device = divmod(index, 2)
        stamp = f"2026-03-01 {hour:02d}:00:00"
        records.append(
            {
                "datetime": f"{stamp}Z",
                "timestamp": pd.Timestamp(f"{stamp}+00:00"),
                "device_id": ["dev_a", "dev_b"][device],
                "site_id": ["site_1", "site_2"][device],
                "site_name": ["Site One", "Site Two"][device],
                "network": "airqo",
                "pm2_5": 10.0 + index,
            }
        )
    return pd.DataFrame(records, columns=DEVICE_COLUMNS)


def pie_frame() -> pd.DataFrame:
    """
    Build six hourly rows on 2026-03-01 for two sites, interleaved by hour.

    Site One holds 10, 20 and 30 and Site Two holds 40, 50 and 60, so the
    means are 20 and 50 over the whole frame and 15 and 40 over its first
    three rows.
    """
    frame = device_frame(6)
    frame["pm2_5"] = [10.0, 40.0, 20.0, 50.0, 30.0, 60.0]
    return frame


FORECAST_COLUMNS = ["datetime", "timestamp", "country", "city", "network", "pm2_5"]


def forecast_frame(rows: int) -> pd.DataFrame:
    """
    Build ``rows`` hourly satellite rows on 2026-03-01 for one country and two cities.

    The pair (datetime, city) is unique, so the cleaning step keeps every row.
    """
    records = []
    for index in range(rows):
        hour, city = divmod(index, 2)
        stamp = f"2026-03-01 {hour:02d}:00:00"
        records.append(
            {
                "datetime": f"{stamp}Z",
                "timestamp": pd.Timestamp(f"{stamp}+00:00"),
                "country": "Uganda",
                "city": ["Gulu", "Kampala"][city],
                "network": "satellite",
                "pm2_5": 10.0 + index,
            }
        )
    return pd.DataFrame(records, columns=FORECAST_COLUMNS)


# ---------------------------------------------------------------------------
# Request bodies (wire format)
# ---------------------------------------------------------------------------

WINDOW = {
    "startDateTime": "2026-03-01T00:00:00Z",
    "endDateTime": "2026-03-02T00:00:00Z",
}

DOWNLOAD = {
    **WINDOW,
    "device_ids": ["dev_a", "dev_b"],
    "pollutants": ["pm2_5"],
    "frequency": "hourly",
    "datatype": "calibrated",
}

RAW = {
    **WINDOW,
    "device_ids": ["dev_a", "dev_b"],
    "pollutants": ["pm2_5"],
    "frequency": "raw",
}


def chart_body(chart_type: str) -> Dict[str, Any]:
    """Build the body of a dashboard chart request of ``chart_type`` at hourly frequency."""
    return {
        **WINDOW,
        "device_ids": ["dev_a", "dev_b"],
        "pollutants": ["pm2_5"],
        "frequency": "hourly",
        "chartType": chart_type,
    }


FORECAST = {**WINDOW, "country": "Uganda"}


# ---------------------------------------------------------------------------
# Token helpers
# ---------------------------------------------------------------------------


def _encode(payload: Any) -> str:
    return _b64encode(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    )


def payload_of(token: str) -> Dict[str, Any]:
    """Decode the JSON payload of a token."""
    payload_b64, _, _ = token.rpartition(".")
    return json.loads(_b64decode(payload_b64))


def with_changed_payload(token: str, **changes: Any) -> str:
    """Return the token with ``changes`` applied to its payload and its original signature kept."""
    payload = {**payload_of(token), **changes}
    _, _, signature = token.rpartition(".")
    return f"{_encode(payload)}.{signature}"


def tampered(token: str) -> str:
    """Return the token with its offset moved by one and its original signature kept."""
    return with_changed_payload(token, offset=payload_of(token)["offset"] + 1)


def unsigned(token: str) -> str:
    """Return the payload of the token without its signature."""
    payload_b64, _, _ = token.rpartition(".")
    return payload_b64
