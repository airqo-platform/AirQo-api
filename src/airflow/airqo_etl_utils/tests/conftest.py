import random
import string
from datetime import datetime
from unittest import mock
from unittest.mock import MagicMock

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.config import configuration


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "bq_test: mark a test as a bigquery class method"
    )


class ForecastFixtures:
    @staticmethod
    @pytest.fixture(scope="session")
    def preprocessing_sample_df():
        data = pd.DataFrame(
            {
                "device_id": ["A", "B"],
                "site_id": ["X", "Y"],
                "device_category": ["LOWCOST", "BAM"],
                "pm2_5": [1, 2],
                "timestamp": ["2023-01-01", "2023-02-01"],
            }
        )
        return data

    @staticmethod
    @pytest.fixture
    def feat_eng_sample_df_daily():
        data = {
            "timestamp": pd.date_range(end=pd.Timestamp.now(), periods=365).tolist(),
            "device_id": ["device1"] * 365,
            "pm2_5": range(1, 366),
        }
        return pd.DataFrame(data)

    @staticmethod
    @pytest.fixture
    def feat_eng_sample_df_hourly():
        data = {
            "timestamp": pd.date_range(
                end=pd.Timestamp.now(), periods=24 * 14, freq="H"
            ).tolist(),
            "device_id": ["device1"] * 24 * 14,
            "pm2_5": range(1, 24 * 14 + 1),
        }
        return pd.DataFrame(data)

    @staticmethod
    @pytest.fixture
    def sample_dataframe_for_location_features():
        data = {
            "timestamp": pd.date_range(end=pd.Timestamp.now(), periods=100).tolist(),
            "device_id": ["device1"] * 100,
            "latitude": np.random.uniform(-90, 90, 100),
            "longitude": np.random.uniform(-180, 180, 100),
        }
        return pd.DataFrame(data)

    @staticmethod
    @pytest.fixture
    def sample_hourly_forecast_data():
        return pd.DataFrame(
            {
                "device_id": ["dev1", "dev1", "dev2"],
                "pm2_5": [10, 15, 20],
                "timestamp": [
                    datetime(2023, 1, 1, 0),
                    datetime(2023, 1, 1, 1),
                    datetime(2023, 1, 1, 2),
                ],
            }
        )

    @staticmethod
    @pytest.fixture
    def sample_daily_forecast_data():
        return pd.DataFrame(
            {
                "device_id": ["dev1", "dev1", "dev2"],
                "pm2_5": [10, 15, 20],
                "timestamp": [
                    datetime(2023, 1, 1),
                    datetime(2023, 1, 2),
                    datetime(2023, 1, 3),
                ],
            }
        )

    @staticmethod
    @pytest.fixture
    def mock_db():
        mock_client = MagicMock()
        mock_db = mock_client[configuration.MONGO_DATABASE_NAME]
        mock_db.hourly_forecasts = MagicMock()
        mock_db.daily_forecasts = MagicMock()
        return mock_db


class FaultDetectionFixtures:
    @classmethod
    @pytest.fixture(scope="session")
    def df_valid(cls):
        return pd.DataFrame(
            {
                "device_name": [
                    "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
                    for _ in range(100)
                ],
                "s1_pm2_5": np.random.uniform(0, 100, 100),
                "s2_pm2_5": np.random.uniform(0, 100, 1000),
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


class BigQueryFixtures:
    @staticmethod
    @pytest.fixture
    def mock_bigquery_client():
        """A fixture that mocks the bigquery.Client object."""

        fake_client = mock.Mock()

        sample_df = pd.DataFrame(
            {
                "device_id": ["A", "A", "B", "B"],
                "timestamp": [
                    "2023-01-01 00:00:00",
                    "2023-01-01 01:00:00",
                    "2023-01-01 00:00:00",
                    "2023-01-01 01:00:00",
                ],
                "site_id": [1, 1, 2, 2],
                "pm2_5": [10.0, 12.0, 15.0, 18.0],
                "latitude": [10.0, 10.0, 20.0, 20.0],
                "longitude": [10.0, 10.0, 20.0, 20.0],
                "device_category": ["A", "A", "B", "B"],
            }
        )

        fake_data_empty_result = pd.DataFrame()

        fake_error = "Fake error"

        def fake_query(query, job_config):
            fake_job = mock.Mock()

            if "2023-01-01" in query:
                fake_job.result.return_value.to_dataframe.return_value = sample_df
            elif "2023-01-02" in query:
                fake_job.result.return_value.to_dataframe.return_value = (
                    fake_data_empty_result
                )
            elif "2023-01-03" in query:
                fake_job.result.side_effect = fake_error
            else:
                raise ValueError("Invalid date")

            return fake_job

        fake_client.query.side_effect = fake_query

        return fake_client
