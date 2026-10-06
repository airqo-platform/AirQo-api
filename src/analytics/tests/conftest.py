"""
Pytest configuration and fixtures for analytics2 FastAPI tests.

Patches external I/O (BigQuery, Redis) at the module level so no real
network calls are made during the test suite.
"""

from __future__ import annotations

import os

# The suite must run with no .env and no ambient config (CI has neither).
# config.py instantiates settings at import time and refuses the default
# SECRET_KEY outside development, so force a dev environment before any
# app module is imported. setdefault keeps a real environment in charge.
os.environ.setdefault("APP_ENV", "development")

import pytest
from datetime import datetime, timedelta, timezone
from typing import Any, Dict
from unittest.mock import MagicMock

import pandas as pd
from fastapi.testclient import TestClient

# ---------------------------------------------------------------------------
# Patch settings BEFORE importing the app so config.settings
# is the test instance throughout all imports.
# ---------------------------------------------------------------------------
from tests.test_config import test_settings
import config

config.settings = test_settings  # type: ignore[assignment]

from main import app  # noqa: E402  (must come after settings patch)
from api.schemas.requests import (  # noqa: E402
    DataExportRequest,
    DashboardChartRequest,
    RawDataExportRequest,
)


# ---------------------------------------------------------------------------
# In-memory cache store — shared across fixtures in one test session
# ---------------------------------------------------------------------------

_cache_store: Dict[str, Any] = {}


async def _fake_cache_get(key: str) -> Any:
    return _cache_store.get(key)


async def _fake_cache_set(key: str, value: Any, expire: int = 60) -> None:
    _cache_store[key] = value


async def _fake_cache_incr(key: str, expire: int) -> int:
    """In-memory stand-in for the atomic Redis INCR the limiter relies on."""
    count = int(_cache_store.get(key, 0)) + 1
    _cache_store[key] = str(count)
    return count


async def _fake_init_cache() -> None:
    pass


async def _fake_cache_ping() -> bool:
    return True


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# Modules that import the shared client factories by name. Patching only the
# defining module would miss these, since `from ... import x` binds the object.
_CLIENT_FACTORY_IMPORT_SITES = (
    "api.utils.bigquery_jobs",
    "api.models.bigquery_api",
    "api.models.async_bigquery_api",
    "api.models.device_summary_queries",
    "api.models.data_export",
    "api.utils.pollutants.report",
)


def _install_bigquery_client(monkeypatch, client) -> None:
    """Make the BigQuery client factory return ``client`` at every import site."""
    for module in _CLIENT_FACTORY_IMPORT_SITES:
        monkeypatch.setattr(
            f"{module}.shared_bigquery_client", lambda c=client: c, raising=False
        )


@pytest.fixture(autouse=True)
def mock_bigquery_client(monkeypatch):
    """Intercept cloud-client construction at the application's own seam.

    Tests must never build a real BigQuery/GCS client: doing so resolves GCP
    credentials and, because the factories are lru_cached, would pin whatever
    was built into the cache for the rest of the session. Patching the
    factories means no client is ever constructed and no cache state leaks —
    so no cache_clear() bookkeeping is needed.

    Individual tests that need specific query results should additionally
    patch query_data_async or get_sites_async, or request the
    ``fake_bigquery`` fixture.
    """
    gcs_client = MagicMock(name="shared_storage_client")

    _install_bigquery_client(monkeypatch, MagicMock(name="shared_bigquery_client"))
    for module in _CLIENT_FACTORY_IMPORT_SITES:
        monkeypatch.setattr(
            f"{module}.shared_storage_client", lambda c=gcs_client: c, raising=False
        )

    # Belt and braces: anything constructing a client directly still gets a mock
    # rather than reaching for real credentials.
    monkeypatch.setattr("google.cloud.bigquery.Client", MagicMock)
    monkeypatch.setattr("google.cloud.storage.Client", MagicMock)


@pytest.fixture
def fake_bigquery(monkeypatch):
    """Install a BigQuery client that stores each query result and serves pages of it.

    The fixture runs after ``mock_bigquery_client``, so the fake replaces the
    MagicMock at every import site of the factory.
    """
    from tests.paging_support import FakeBigQueryClient

    client = FakeBigQueryClient()
    _install_bigquery_client(monkeypatch, client)
    return client


@pytest.fixture
def small_pages(monkeypatch) -> int:
    """Set the page size to three rows, so a few rows span several pages."""
    monkeypatch.setattr(test_settings, "data_export_limit", 3)
    return 3


@pytest.fixture
def cursor_clock(monkeypatch):
    """Fix the clock of the cursor module at a 2026 time.  ``advance`` moves it."""
    import api.utils.cursor_utils as cursor_utils
    from tests.paging_support import CursorClock

    clock = CursorClock()
    monkeypatch.setattr(cursor_utils, "time", clock)
    return clock


@pytest.fixture(autouse=True)
def mock_privacy_filter(monkeypatch):
    """Approve every site/device by default so no test hits device-registry.

    Mirrors the helper's success envelope, echoing the input list back.
    Tests exercising the privacy behaviour itself re-patch the relevant
    binding explicitly.

    Patched at every module that imports the name, not just where it was
    first used: the report builder binds its own reference, and a patch on
    api.services alone left that path free to open a real connection to
    device-registry.
    """

    def _passthrough(filter_type, filter_value):
        return {"status": "success", "message": "ok", "data": list(filter_value)}

    monkeypatch.setattr("api.services.filter_non_private_sites_devices", _passthrough)
    monkeypatch.setattr(
        "api.models.base.data_processing.filter_non_private_sites_devices",
        _passthrough,
    )


@pytest.fixture
def privacy_kwarg(monkeypatch):
    """Records the keyword arguments each service hands _filter_from_request,
    then delegates to the real one.

    Lets a test assert that a service states the `privacy` flag without
    pinning which value it states, so the suite holds whichever way a path is
    wired and never rides on the parameter's default.
    """
    import api.services as services

    real = services._filter_from_request
    calls = []

    async def spy(data, **kwargs):
        calls.append(kwargs)
        return await real(data, **kwargs)

    monkeypatch.setattr(services, "_filter_from_request", spy)
    return calls


@pytest.fixture(autouse=True)
def clear_cache():
    """Reset the in-memory cache before every test."""
    _cache_store.clear()
    yield
    _cache_store.clear()


@pytest.fixture(autouse=True)
def clear_mongo_client_cache():
    """Reset the process-wide shared MongoClient between tests so patched
    MongoClient classes never leak across test boundaries."""
    from api.models.base.mongo_base import _shared_client

    _shared_client.cache_clear()
    yield
    _shared_client.cache_clear()


@pytest.fixture(autouse=True)
def patch_cache(monkeypatch):
    """Replace Redis cache functions with in-memory equivalents."""
    monkeypatch.setattr("api.utils.cache.cache_get", _fake_cache_get)
    monkeypatch.setattr("api.utils.cache.cache_set", _fake_cache_set)
    monkeypatch.setattr("api.utils.cache.cache_incr", _fake_cache_incr)
    monkeypatch.setattr("api.utils.cache.init_cache", _fake_init_cache)
    monkeypatch.setattr("api.utils.cache.cache_ping", _fake_cache_ping)
    # Also patch where middlewares import them directly
    monkeypatch.setattr("api.middlewares.rate_limiter.cache_incr", _fake_cache_incr)


@pytest.fixture
def sample_df() -> pd.DataFrame:
    """A small realistic BigQuery result DataFrame."""
    return pd.DataFrame(
        {
            "datetime": ["2023-01-01 12:00:00Z", "2023-01-01 13:00:00Z"],
            "device_id": ["device1", "device2"],
            "site_id": ["site1", "site2"],
            "pm2_5": [15.5, 20.3],
            "pm10": [25.7, 30.2],
            "temperature": [24.5, 23.8],
            "humidity": [65.3, 67.2],
            "site_name": ["Site A", "Site B"],
        }
    )


@pytest.fixture
def empty_df() -> pd.DataFrame:
    return pd.DataFrame()


@pytest.fixture
def client() -> TestClient:
    """FastAPI test client — no BigQuery or Redis calls required."""
    return TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Reusable valid request dicts (wire format — camelCase)
# ---------------------------------------------------------------------------


@pytest.fixture
def valid_export_payload() -> Dict[str, Any]:
    start = (datetime.now(tz=timezone.utc) - timedelta(days=7)).isoformat()
    end = datetime.now(tz=timezone.utc).isoformat()
    return {
        "startDateTime": start,
        "endDateTime": end,
        "network": "airqo",
        "device_category": "lowcost",
        "pollutants": ["pm2_5"],
        "sites": ["site1", "site2"],
        "frequency": "daily",
        "datatype": "calibrated",
        "downloadType": "json",
    }


@pytest.fixture
def valid_raw_payload() -> Dict[str, Any]:
    start = (datetime.now(tz=timezone.utc) - timedelta(days=3)).isoformat()
    end = datetime.now(tz=timezone.utc).isoformat()
    return {
        "startDateTime": start,
        "endDateTime": end,
        "network": "airqo",
        "device_category": "lowcost",
        "pollutants": ["pm2_5"],
        "sites": ["site1"],
        "frequency": "raw",
    }


@pytest.fixture
def valid_dashboard_payload() -> Dict[str, Any]:
    start = (datetime.now(tz=timezone.utc) - timedelta(days=7)).isoformat()
    end = datetime.now(tz=timezone.utc).isoformat()
    return {
        "startDateTime": start,
        "endDateTime": end,
        "network": "airqo",
        "device_category": "lowcost",
        "pollutants": ["pm2_5"],
        "sites": ["site1"],
        "frequency": "daily",
        "chartType": "line",
    }


# ---------------------------------------------------------------------------
# Pydantic request objects (for service-layer unit tests)
# ---------------------------------------------------------------------------


@pytest.fixture
def export_request(valid_export_payload) -> DataExportRequest:
    return DataExportRequest(**valid_export_payload)


@pytest.fixture
def raw_request(valid_raw_payload) -> RawDataExportRequest:
    return RawDataExportRequest(**valid_raw_payload)


@pytest.fixture
def dashboard_request(valid_dashboard_payload) -> DashboardChartRequest:
    return DashboardChartRequest(**valid_dashboard_payload)
