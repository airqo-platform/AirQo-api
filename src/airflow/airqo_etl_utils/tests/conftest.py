import numpy as np
import pandas as pd
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers",
        "bq_test: mark a test as a bigquery class method"
    )
class ForecastFixtures:
    @staticmethod
    @pytest.fixture(scope="session")
    def hourly_data():
        return pd.DataFrame({
            "device_number": [1, 1, 1, 2, 2, 2],
        "created_at": ["2021-08-01 00:00:00", "2021-08-01 01:00:00", "2021-08-01 02:00:00",
                       "2021-08-01 00:00:00", "2021-08-01 01:00:00", "2021-08-01 02:00:00"],
        "pm2_5": [10.0, np.nan, 12.0, 15.0, np.nan, np.nan]
        })

    @staticmethod
    @pytest.fixture(scope="session")
    def daily_data():
        return pd.DataFrame({
            "device_number": [1, 1, 1, 2, 2, 2],
        "created_at": ["2021-08-01 00:00:00", "2021-08-02 00:00:00", "2021-08-03 00:00:00",
                       "2021-08-01 00:00:00", "2021-08-02 00:00:00", "2021-08-03 00:00:00"],
        "pm2_5": [10.0, np.nan, 12.0, 15.0, np.nan, np.nan]
        })

    @staticmethod
    @pytest.fixture(scope="session")
    def hourly_output():
        return pd.DataFrame({
            "device_number": [1, 1, 1, 2, 2, 2],
        "created_at": ["2021-08-01 00:00:00", "2021-08-01 01:00:00", "2021-08-01 02:00:00",
                       "2021-08-01 00:00:00", "2021-08-01 01:00:00", "2021-08-01 02:00:00"],
        "pm2_5": [10.0, 11.0, 12.0, 15.0, 16.0, 17.0]
        })

    @staticmethod
    @pytest.fixture(scope="session")
    def daily_output():
        return pd.DataFrame({
            "device_number": [1, 1, 1, 2, 2, 2],
        "created_at": ["2021-08-01 00:00:00", "2021-08-02 00:00:00", "2021-08-03 00:00:00",
                       "2021-08-01 00:00:00", "2021-08-02 00:00:00", "2021-08-03 00:00:00"],
        "pm2_5": [10.0, 11.0, 12.0, 15.0, 16.0, 17.0]
        })
