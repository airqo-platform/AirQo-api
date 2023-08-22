import numpy as np
import pandas as pd
import pytest


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "bq_test: mark a test as a bigquery class method"
    )


class ForecastFixtures:
    @staticmethod
    @pytest.fixture(scope="session")
    def hourly_data():
        return pd.DataFrame(
            {
                "device_number": [1, 1, 1, 2, 2, 2],
                "created_at": [
                    "2021-08-01 00:00:00",
                    "2021-08-01 01:00:00",
                    "2021-08-01 02:00:00",
                    "2021-08-01 00:00:00",
                    "2021-08-01 01:00:00",
                    "2021-08-01 02:00:00",
                ],
                "pm2_5": [10.0, np.nan, 12.0, 15.0, np.nan, np.nan],
            }
        )

    @staticmethod
    @pytest.fixture(scope="session")
    def daily_data():
        return pd.DataFrame(
            {
                "device_number": [1, 1, 1, 2, 2, 2],
                "created_at": [
                    "2021-08-01 00:00:00",
                    "2021-08-02 00:00:00",
                    "2021-08-03 00:00:00",
                    "2021-08-01 00:00:00",
                    "2021-08-02 00:00:00",
                    "2021-08-03 00:00:00",
                ],
                "pm2_5": [10.0, np.nan, 12.0, 15.0, np.nan, np.nan],
            }
        )

    @staticmethod
    @pytest.fixture(scope="session")
    def hourly_output():
        return pd.DataFrame(
            {
                "device_number": [1, 1, 1, 2, 2, 2],
                "created_at": [
                    "2021-08-01 00:00:00",
                    "2021-08-01 01:00:00",
                    "2021-08-01 02:00:00",
                    "2021-08-01 00:00:00",
                    "2021-08-01 01:00:00",
                    "2021-08-01 02:00:00",
                ],
                "pm2_5": [10.0, 11.0, 12.0, 15.0, 16.0, 17.0],
            }
        )

    @staticmethod
    @pytest.fixture(scope="session")
    def daily_output():
        return pd.DataFrame(
            {
                "device_number": [1, 1, 1, 2, 2, 2],
                "created_at": [
                    "2021-08-01 00:00:00",
                    "2021-08-02 00:00:00",
                    "2021-08-03 00:00:00",
                    "2021-08-01 00:00:00",
                    "2021-08-02 00:00:00",
                    "2021-08-03 00:00:00",
                ],
                "pm2_5": [10.0, 11.0, 12.0, 15.0, 16.0, 17.0],
            }
        )


@pytest.fixture(scope="session")
def mongo_fixture():
    from airqo_etl_utils.mongo_client import MongoClient

    return MongoClient(uri="mongodb://localhost:27017", db_name="test_db")


class FaultDetectionFixtures:
    @classmethod
    @pytest.fixture(scope="session")
    def df_valid(cls):
        return pd.DataFrame(
            {
                "device_name": ["A", "A", "A", "A", "B", "B", "B", "B"],
                "s1_pm2_5": [10, 11, 12, 13, 20, 21, 22, 23],
                "s2_pm2_5": [9, 10, 11, 12, 19, 20, 21, 22],
            }
        )

    @classmethod
    @pytest.fixture(scope="session")
    def df_invalid_corr(cls):
        return pd.DataFrame(
            {
                "device_name": ["A", "A", "A", "A", "B", "B", "B", "B"],
                "s1_pm2_5": [10, 11, 12, 13, 20, -21, -22, -23],
                "s2_pm2_5": [9, 10, 11, 12, 19, 20, 21, 22],
            }
        )

    @classmethod
    @pytest.fixture(scope="session")
    def df_invalid_nan(cls):
        return pd.DataFrame(
            {
                "device_name": ["A", "A", "A", "A", "B", "B", "B", "B"],
                "s1_pm2_5": [10, None, None, None, None, None, None, None],
                "s2_pm2_5": [9, None, None, None, None, None, None, None],
            }
        )

    @classmethod
    @pytest.fixture(scope="session")
    def df_invalid_type(cls):
        return [1, 2, 3]

    @classmethod
    @pytest.fixture(scope="session")
    def df_invalid_columns(cls):
        return pd.DataFrame(
            {
                "device_name": ["A", "A", "A", "A"],
                "s1_pm10": [10, 11, 12, 13],
                "s2_pm10": [9, 10, 11, 12],
            }
        )

    @classmethod
    @pytest.fixture(scope="session")
    def df_invalid_empty(cls):
        return pd.DataFrame()

    @classmethod
    @pytest.fixture(scope="session")
    def expected_output(cls):
        return pd.DataFrame(
            {
                "device_name": ["B"],
                "correlation_fault": [1],
                "missing_data_fault": [0],
                "created_at": [datetime.now().isoformat(timespec="seconds")],
            }
        )
