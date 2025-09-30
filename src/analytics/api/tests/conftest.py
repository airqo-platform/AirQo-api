import pandas as pd
import pytest
from unittest.mock import MagicMock, patch
import os

from limits.storage import Storage

os.environ["REDIS_SERVER"] = "localhost"
os.environ["REDIS_PORT"] = "6379"


class MockRedisCache:
    """Mock implementation of Redis cache client for Flask-Caching testing"""

    def __init__(self, *args, **kwargs):
        self.cache_data = {}

    def get(self, key):
        return self.cache_data.get(key)

    def set(self, key, value, timeout=None):
        self.cache_data[key] = value
        return True

    def delete(self, *keys):
        for key in keys:
            if key in self.cache_data:
                del self.cache_data[key]
        return len(keys)

    def expire(self, key, time):
        """Mock expire method for Redis compatibility."""
        return True

    def clear(self):
        """Mock clear method"""
        self.cache_data.clear()
        return True

    def has(self, key):
        """Mock has method"""
        return key in self.cache_data

    def add(self, key, value, timeout=None):
        """Mock add method"""
        if key not in self.cache_data:
            self.cache_data[key] = value
            return True
        return False


class MockRedisLimiterStorage(Storage):
    """Mock implementation for Flask-Limiter Redis storage"""

    def __init__(self, storage_uri, **options):
        self.storage_uri = storage_uri
        self.options = options
        self.storage_data = {}
        self.wrap_exceptions = True  # Required by Storage base class

    @property
    def base_exceptions(self):
        """Return base exception class for Redis storage"""
        return Exception  # Use generic exception for mock

    def incr(self, key, expiry, amount=1, elastic_expiry=False):
        """Mock incr method for rate limiting with all required parameters"""
        current = self.storage_data.get(key, 0)
        self.storage_data[key] = current + amount
        return self.storage_data[key]

    def get(self, key):
        return self.storage_data.get(key, 0)

    def set(self, key, value, timeout=None):
        self.storage_data[key] = value
        return True

    def clear(self):
        self.storage_data.clear()

    def reset(self):
        """Reset storage"""
        self.storage_data.clear()

    def check(self):
        """Health check method"""
        return True

    def get_expiry(self, key):
        """Mock get_expiry method"""
        return -1  # No expiry

    def lua_incr_expire(self, keys, args):
        """Mock Lua script execution for rate limiting"""
        if keys:
            key = keys[0]
            if args:
                expiry, amount = args[0], args[1] if len(args) > 1 else 1
                return self.incr(key, expiry, amount)
        return 1

    # Add properties to match Storage interface
    @property
    def base_uri(self):
        return self.storage_uri


class MockCacheClient:
    """Mock implementation of Flask-Cache for testing"""

    def __init__(self):
        self.cache_data = {}

    def get(self, key):
        return self.cache_data.get(key)

    def set(self, key, value, *args, **kwargs):
        self.cache_data[key] = value
        return True

    def delete(self, *keys):
        for key in keys:
            if key in self.cache_data:
                del self.cache_data[key]
        return len(keys)

    def expire(self, key, time):
        """Mock expire method for Redis compatibility."""
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

    def _memoize_make_cache_key(self, *args, **kwargs):
        """Mock implementation to prevent actual cache key generation"""
        return "mock_cache_key"

    def init_app(self, app):
        """Mock init_app method for Flask-Caching compatibility"""
        pass

    def clear(self):
        """Mock clear method"""
        self.cache_data.clear()
        return True


# Create global mock instances
mock_cache_instance = MockCacheClient()
mock_limiter_storage_instance = MockRedisLimiterStorage("redis://localhost:6379")

# Patch Flask-Caching backends to return our mock
patch("flask_caching.backends.RedisCache", MockRedisCache).start()
patch("redis.Redis", MockRedisCache).start()

# Patch Flask-Limiter storage to prevent Redis connections - need multiple paths
patch("limits.storage.redis.RedisStorage", MockRedisLimiterStorage).start()
patch("limits.storage.RedisStorage", MockRedisLimiterStorage).start()

# Also patch the storage_from_string function to return our mock
def mock_storage_from_string(storage_uri, **kwargs):
    return mock_limiter_storage_instance


patch("limits.storage.storage_from_string", mock_storage_from_string).start()

# Import after patching
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


@pytest.fixture(autouse=True)
def mock_redis_cache():
    """
    Fixture that automatically mocks Redis cache for all tests.
    This prevents tests from connecting to a real Redis instance.
    """
    global mock_cache_instance

    # Additional patching for any modules that might import cache
    with patch("main.cache", mock_cache_instance), patch(
        "api.models.bigquery_api.cache", mock_cache_instance
    ), patch("api.utils.cursor_utils.cache", mock_cache_instance), patch(
        "api.models.site.cache", mock_cache_instance
    ), patch(
        "api.models.exceedance.cache", mock_cache_instance
    ), patch(
        "api.models.events.cache", mock_cache_instance
    ):
        yield mock_cache_instance
