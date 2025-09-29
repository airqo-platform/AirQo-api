import pandas as pd
import pytest
from unittest.mock import MagicMock, patch


class MockCacheClient:
    """Mock implementation of Redis cache client for testing"""

    def __init__(self):
        self.cache_data = {}

    def get(self, key):
        return self.cache_data.get(key)

    def set(self, key, value, *args, **kwargs):
        self.cache_data[key] = value
        return True

    def expire(self, key, time):
        """Mock expire method for Redis compatibility."""
        # Just return True since this is a mock
        return True

    def delete(self, *keys):
        for key in keys:
            if key in self.cache_data:
                del self.cache_data[key]
        return len(keys)

    def memoize(self, timeout=None, make_name=None, source=None, **kwargs):
        """
        Improved memoize decorator mock that properly handles decorated functions.
        When used as a decorator, it returns the function unchanged.
        """

        def decorator(func):
            # Simply return the original function without changes
            return func

        return decorator

    # Add this method for Flask-Caching compatibility
    def _memoize_make_cache_key(*args, **kwargs):
        """Mock implementation to prevent actual cache key generation"""
        return "mock_cache_key"


# Mock the cache before any other imports
mock_cache_client = MockCacheClient()

# Patch environment variables to prevent Redis connections
patch.dict("os.environ", {"REDIS_SERVER": "mock_redis", "REDIS_PORT": "6379"}).start()

# Patch at the module level before any imports happen
patch("main.cache", mock_cache_client).start()
patch("api.models.bigquery_api.cache", mock_cache_client).start()
patch("api.utils.cursor_utils.cache", mock_cache_client).start()
patch("flask_caching.Cache", return_value=mock_cache_client).start()

from manage import app as flask_app


@pytest.fixture
def app():
    """Return the pre-configured Flask app for testing."""
    # Set testing configuration
    flask_app.config["TESTING"] = True
    return flask_app


@pytest.fixture
def client(app):
    """Create a test client for the Flask application."""
    return app.test_client()


@pytest.fixture
def mock_aqcsv_globals():
    FREQUENCY_MAPPER = {"hourly": 60, "daily": 1440, "raw": 1}

    POLLUTANT_BIGQUERY_MAPPER = {
        "pm2_5": ["pm2_5_calibrated_value", "pm2_5_raw_value"],
        "pm10": ["pm10_calibrated_value", "pm10_raw_value"],
        "no2": ["no2_calibrated_value", "no2_raw_value"],
    }

    BIGQUERY_FREQUENCY_MAPPER = {
        "raw": {
            "pm2_5": ["pm2_5", "s1_pm2_5", "s2_pm2_5"],
            "pm10": ["pm10", "s1_pm10", "s2_pm10"],
            "no2": ["no2"],
        },
        "daily": {
            "pm2_5": ["pm2_5_calibrated_value", "pm2_5_raw_value"],
            "pm10": ["pm10_calibrated_value", "pm10_raw_value"],
            "no2": ["no2_calibrated_value", "no2_raw_value"],
        },
        "hourly": {
            "pm2_5": ["pm2_5_calibrated_value", "pm2_5_raw_value"],
            "pm10": ["pm10_calibrated_value", "pm10_raw_value"],
            "no2": ["no2_calibrated_value", "no2_raw_value"],
        },
    }

    AQCSV_QC_CODE_MAPPER = {"averaged": "1", "estimated": "2"}

    AQCSV_PARAMETER_MAPPER = {"pm2_5": "88101", "pm10": "81102"}

    return {
        "FREQUENCY_MAPPER": FREQUENCY_MAPPER,
        "POLLUTANT_BIGQUERY_MAPPER": POLLUTANT_BIGQUERY_MAPPER,
        "BIGQUERY_FREQUENCY_MAPPER": BIGQUERY_FREQUENCY_MAPPER,
        "AQCSV_QC_CODE_MAPPER": AQCSV_QC_CODE_MAPPER,
        "AQCSV_PARAMETER_MAPPER": AQCSV_PARAMETER_MAPPER,
    }


@pytest.fixture
def mock_dataframe():
    return pd.DataFrame(
        {
            "site_id": ["site_1", "site_2", "site_3"],
            "timestamp": [
                "2021-10-10 00:00:00",
                "2021-10-10 01:00:00",
                "2021-10-10 02:00:00",
            ],
            "parameter": ["pm2_5", "pm10"],
            "pm2_5_calibrated_value": [1.2, 1.3, 1.4],
            "pm10_calibrated_value": [2.2, 2.3, 2.4],
            "site_latitude": [36.9914, 37.3314, 37.4414],
            "site_longitude": [-122.0609, -122.0309, -123.0609],
        }
    )


@pytest.fixture
def mock_download_service():
    """Create a mock for the DownloadService."""
    mock = MagicMock()
    return mock


@pytest.fixture
def mock_response_builder():
    """Create a mock for the ResponseBuilder."""
    mock = MagicMock()
    return mock


class MockCacheClient:
    """Mock implementation of Redis cache client for testing"""

    def __init__(self):
        self.cache_data = {}

    def get(self, key):
        return self.cache_data.get(key)

    def set(self, key, value, *args, **kwargs):
        self.cache_data[key] = value
        return True

    def expire(self, key, time):
        """Mock expire method for Redis compatibility."""
        # Just return True since this is a mock
        return True

    def memoize(self, timeout=None, make_name=None, source=None, **kwargs):
        """
        Improved memoize decorator mock that properly handles decorated functions.
        When used as a decorator, it returns the function unchanged.
        """

        def decorator(func):
            # Simply return the original function without changes
            return func

        return decorator

    # Add this method for Flask-Caching compatibility
    def _memoize_make_cache_key(*args, **kwargs):
        """Mock implementation to prevent actual cache key generation"""
        return "mock_cache_key"


@pytest.fixture(autouse=True)
def mock_redis_cache():
    """
    Fixture that provides access to the mocked Redis cache for all tests.
    The cache is already mocked at the module level to prevent Redis connections.
    """
    global mock_cache_client
    return mock_cache_client
