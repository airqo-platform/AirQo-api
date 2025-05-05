from datetime import datetime
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


class DevicesFixtures:
    devices = {
        "site_id": [
            "r8Qn65q4GPyg9RHevhwfbB",
            "r8Qn65q4GPyg9RHevhweyud",
            np.nan,
            "r8Qn65q4GPyg9sdfdwfbB",
            "r8Qn65q4GPypepf7hwfbB",
            "r8Qn6443rfypepf7hwfbB",
        ],
        "device_category": [
            "lowcost",
            "lowcost",
            "lowcost",
            "lowcost",
            "bam",
            "lowcost",
        ],
        "_id": [
            "ma9pMkjs7cYET2Db6B4tKX",
            "ma9pMkjs7cYET2Db6B4tSX",
            "NG9pMkjs7cYET2Db6B4tKX",
            "NG9pMkjs7cYEOKWN44tKX",
            "NG9pMkjs44RWEET2Db6B4tKX",
            "NG9pMkjs44R77e66wyy3nE",
        ],
        "status": [
            "deployed",
            "deployed",
            "recalled",
            "deployed",
            "not deployed",
            "deployed",
        ],
        "isActive": [True, True, False, True, False, True],
        "name": [
            "iqair_33_22_lw",
            "airqo_0123lw",
            "airqo_9876lw",
            "iqair_44_21lw",
            "metone_99_33bm",
            "iqair_55_32lw",
        ],
        "network": ["iqair", "airqo", "airqo", "iqair", "metone", "iqair"],
        "longitude": [
            32.9284726,
            3.9036253,
            22.9837123,
            36.9837663,
            18.9837123,
            81.9845133,
        ],
        "latitude": [
            0.1425362,
            1.4895023,
            43.9872473,
            7.9884673,
            41.4372563,
            14.4375553,
        ],
        "device_number": [-1, 1122222, 5555666, 7777666, -1, -1],
        "key": [
            "UZ3xav7psG4uFbmNDkf26Y",
            np.nan,
            np.nan,
            "qhpdmXnxTGyjzsU4Vu5H8W",
            np.nan,
            np.nan,
        ],
    }

    @classmethod
    @pytest.fixture(scope="session")
    def cached_device_df(cls):
        devices = cls.devices
        return pd.DataFrame(devices)

    @classmethod
    @pytest.fixture(scope="session")
    def api_device_df(cls):
        devices = cls.devices
        return pd.DataFrame(devices)

    @pytest.fixture(scope="session")
    def airqo_device_keys(cls):
        keys = {
            "airqo_0123lw": "Rc7zM4r8ZD5n3XdUjsQKVk",
            "airqo_9876lw": "XQ9hvMYw7RqSe4cG8PWfBm",
        }
        return keys


class SitesFitures:
    @pytest.fixture
    def cached_sites_df():
        pass

    @pytest.fixture
    def api_sites_df():
        pass
