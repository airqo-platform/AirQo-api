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
from unittest.mock import AsyncMock, MagicMock, patch

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
    MonitoringSiteRequest,
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


@pytest.fixture(autouse=True)
def mock_bigquery_client(monkeypatch):
    """Intercept cloud-client construction at the application's own seam.

    Tests must never build a real BigQuery/GCS client: doing so resolves GCP
    credentials and, because the factories are lru_cached, would pin whatever
    was built into the cache for the rest of the session. Patching the
    factories means no client is ever constructed and no cache state leaks —
    so no cache_clear() bookkeeping is needed.

    Individual tests that need specific query results should additionally
    patch query_data_async / get_sites_async etc.
    """
    bq_client = MagicMock(name="shared_bigquery_client")
    gcs_client = MagicMock(name="shared_storage_client")

    for module in _CLIENT_FACTORY_IMPORT_SITES:
        for attr, client in (
            ("shared_bigquery_client", bq_client),
            ("shared_storage_client", gcs_client),
        ):
            monkeypatch.setattr(f"{module}.{attr}", lambda c=client: c, raising=False)

    # Belt and braces: anything constructing a client directly still gets a mock
    # rather than reaching for real credentials.
    monkeypatch.setattr("google.cloud.bigquery.Client", MagicMock)
    monkeypatch.setattr("google.cloud.storage.Client", MagicMock)


@pytest.fixture(autouse=True)
def mock_privacy_filter(monkeypatch):
    """Approve every site/device by default so no test hits device-registry.

    Mirrors the helper's success envelope, echoing the input list back.
    Tests exercising the privacy behaviour itself re-patch
    api.services.filter_non_private_sites_devices explicitly.
    """

    def _passthrough(filter_type, filter_value):
        return {"status": "success", "message": "ok", "data": list(filter_value)}

    monkeypatch.setattr("api.services.filter_non_private_sites_devices", _passthrough)


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
def mock_bq_result(sample_df):
    """Default BigQuery return value: (DataFrame, metadata)."""
    metadata = {"total_count": 2, "has_more": False, "next": None}
    return sample_df, metadata


@pytest.fixture
def mock_bq_empty(empty_df):
    metadata = {"total_count": 0, "has_more": False, "next": None}
    return empty_df, metadata


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
