from datetime import datetime
from unittest.mock import MagicMock
import os
import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.config import configuration
from airqo_etl_utils.data_validator import DataValidationUtils
from airqo_etl_utils.datautils import DataUtils
from airqo_etl_utils.bigquery_api import BigQueryApi


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "bq_test: mark a test as a bigquery class method"
    )


# -------------------------------------
# Fixtures
# -------------------------------------


@pytest.fixture(scope="session")
def lc_raw_data():
    """Fixture providing low cost raw data."""
    return pd.DataFrame(
        {
            "tenant": ["", "", ""],
            "timestamp": [
                "2025-05-07 10:54:12+00:00",
                "2025-05-07 10:55:42+00:00",
                "2025-05-07 10:14:54+00:00",
            ],
            "site_id": ["6437f682da79c", "64a27372da707f9d5c", "6737f682da70d5c"],
            "device_number": [1000000, 2000000, 3000000],
            "device_id": ["a", "b", "c"],
            "latitude": [-1.414625899410, -2.424775899411, -3.434625899412],
            "longitude": [10.8535027580331, 1.0530502580332, 2.8530250280333],
            "pm2_5": [None, None, None],
            "s1_pm2_5": [0.0, 0.0, 0.0],
            "s2_pm2_5": [9.3, 9.45, 6.9],
            "pm10": [None, None, None],
            "s1_pm10": [0.0, 0.0, 0.0],
            "s2_pm10": [10.1, 10.73, 7.88],
            "no2": [None, None, None],
            "pm1": [None, None, None],
            "s1_pm1": [None, None, None],
            "s2_pm1": [None, None, None],
            "pressure": [None, None, None],
            "s1_pressure": [None, None, None],
            "s2_pressure": [None, None, None],
            "temperature": [28.24, 28.11, 44.67],
            "humidity": [None, None, 28.48],
            "voc": [None, None, None],
            "s1_voc": [None, None, None],
            "s2_voc": [None, None, None],
            "wind_speed": [0.0, 0.0, 0.0],
            "altitude": [0.0, 0.0, 0.0],
            "satellites": [0.0, 0.0, 0.0],
            "hdop": [0.0, 0.0, 0.0],
            "device_temperature": [None, None, None],
            "device_humidity": [0.0, 0.0, 0.0],
            "battery": [4.14, 4.15, 4.15],
            "co": [None, None, None],
            "nh3": [None, None, None],
            "co2": [None, None, None],
            "hcho": [None, None, None],
            "tvoc": [None, None, None],
            "intaketemperature": [None, None, None],
            "intakehumidity": [None, None, None],
            "network": ["zzzz", "zzzz", "zzzz"],
            "device_category": ["lowcost", "lowcost", "lowcost"],
        }
    )


@pytest.fixture(scope="session")
def lc_no_data():
    """Fixture providing empty low cost raw data."""
    # Return empty DataFrame with same columns as lc_raw_data
    columns = [
        "tenant",
        "timestamp",
        "site_id",
        "device_number",
        "device_id",
        "latitude",
        "longitude",
        "pm2_5",
        "s1_pm2_5",
        "s2_pm2_5",
        "pm10",
        "s1_pm10",
        "s2_pm10",
        "no2",
        "pm1",
        "s1_pm1",
        "s2_pm1",
        "pressure",
        "s1_pressure",
        "s2_pressure",
        "temperature",
        "humidity",
        "voc",
        "s1_voc",
        "s2_voc",
        "wind_speed",
        "altitude",
        "satellites",
        "hdop",
        "device_temperature",
        "device_humidity",
        "battery",
        "co",
        "nh3",
        "co2",
        "hcho",
        "tvoc",
        "intaketemperature",
        "intakehumidity",
        "network",
        "device_category",
    ]
    return pd.DataFrame(columns=columns)


@pytest.fixture(scope="session")
def lc_averaged_data():
    """Fixture providing low cost averaged data."""
    return pd.DataFrame(
        {
            "tenant": ["", "", ""],
            "timestamp": [
                "2025-05-07 10:00:00+00:00",
                "2025-05-07 11:00:00+00:00",
                "2025-05-07 12:00:00+00:00",
            ],
            "site_id": ["6437f682da79c", "64a27372da707f9d5c", "6737f682da70d5c"],
            "device_number": [1000000, 2000000, 3000000],
            "device_id": ["a", "b", "c"],
            "latitude": [-1.414625899410, -2.424775899411, -3.434625899412],
            "longitude": [10.8535027580331, 1.0530502580332, 2.8530250280333],
            "pm2_5": [15.5, 18.2, 12.8],
            "pm10": [22.3, 25.1, 19.7],
            "temperature": [28.24, 28.11, 44.67],
            "humidity": [65.2, 68.5, 70.1],
            "network": ["zzzz", "zzzz", "zzzz"],
            "device_category": ["lowcost", "lowcost", "lowcost"],
        }
    )


@pytest.fixture(scope="session")
def bam_raw_data():
    """Fixture providing BAM raw data."""
    return pd.DataFrame(
        {
            "tenant": ["", "", ""],
            "site_id": ["skVJdbywYE7chQWz", "AbEMRQTyS2av6FHu", "P9vWuc8nLDhk3QNrXKM"],
            "device_number": [10000001, 20000001, 30000001],
            "device_id": ["xxxx_01", "xxxx_01", "xxxx_01"],
            "timestamp": [
                "2025-05-07 10:00:00+00:00",
                "2025-05-07 07:00:00+00:00",
                "2025-05-07 08:00:00+00:00",
            ],
            "latitude": [6.52039, 5.92032, 4.52092],
            "longitude": [1.40032, 2.40032, 3.40032],
            "realtime_conc": [13.9, 22.0, 24.8],
            "hourly_conc": [14.8, 25.0, 23.6],
            "short_time_conc": [15.2, 25.4, 23.9],
            "air_flow": [16.59, 16.59, 16.59],
            "wind_speed": [0.0, 0.0, 0.0],
            "wind_direction": [0.0, 0.0, 0.0],
            "temperature": [31.5, 28.3, 29.1],
            "humidity": [71.0, 83.0, 81.0],
            "barometric_pressure": [760.2, 758.9, 759.4],
            "filter_temperature": [42.4, 40.0, 40.4],
            "filter_humidity": [30.0, 35.0, 34.0],
            "status": [0, 0, 0],
            "network": ["xxxx", "xxxx", "xxxx"],
            "device_category": ["bam", "bam", "bam"],
        }
    )


@pytest.fixture(scope="session")
def bam_averaged_data():
    """Fixture providing BAM averaged data."""
    return pd.DataFrame(
        {
            "tenant": ["", "", ""],
            "site_id": ["skVJdbywYE7chQWz", "AbEMRQTyS2av6FHu", "P9vWuc8nLDhk3QNrXKM"],
            "device_number": [10000001, 20000001, 30000001],
            "device_id": ["xxxx_01", "xxxx_01", "xxxx_01"],
            "timestamp": [
                "2025-05-07 10:00:00+00:00",
                "2025-05-07 11:00:00+00:00",
                "2025-05-07 12:00:00+00:00",
            ],
            "latitude": [6.52039, 5.92032, 4.52092],
            "longitude": [1.40032, 2.40032, 3.40032],
            "pm2_5": [14.8, 25.0, 23.6],
            "pm10": [18.5, 28.2, 26.8],
            "temperature": [31.5, 28.3, 29.1],
            "humidity": [71.0, 83.0, 81.0],
            "network": ["xxxx", "xxxx", "xxxx"],
            "device_category": ["bam", "bam", "bam"],
        }
    )


@pytest.fixture(scope="session")
def consolidate_data():
    """Fixture providing consolidated data."""
    return pd.DataFrame(
        {
            "tenant": ["", "", ""],
            "timestamp": [
                "2025-05-07 07:00:00+00:00",
                "2025-05-07 05:00:00+00:00",
                "2025-05-07 02:00:00+00:00",
            ],
            "site_id": ["d84344001eaaaa", "d84344001eaaaa", "d84344001eaaaa"],
            "site_name": ["G, M", "G, M", "G, M"],
            "site_description": ["G, M", "G, M", "G, M"],
            "site_latitude": [1.6052463, 1.6052463, 1.6052463],
            "site_longitude": [2.624193, 2.624193, 2.624193],
            "site_altitude": [1134.0, 1134.0, 1134.0],
            "device_number": [10000001, 10000001, 10000001],
            "device_id": ["cccc_j5_90", "cccc_j5_90", "cccc_j5_90"],
            "device_latitude": [0.25776, 0.25776, 0.25776],
            "device_longitude": [32.63686, 32.63686, 32.63686],
            "pm2_5": [11.846800000000009, 7.785300000000057, 7.321100000000033],
            "pm10": [17.986119252887818, None, None],
            "temperature": [18.02857153756278, 18.13333288828532, 18.00833336512248],
            "humidity": [95.22, 97.162, 97.685],
            "network": ["airqo", "airqo", "airqo"],
            "device_category": ["lowcost", "lowcost", "lowcost"],
            "country": ["Uganda", "Uganda", "Uganda"],
            "region": ["Central Region", "Central Region", "Central Region"],
            "city": ["Kampala", "Kampala", "Kampala"],
        }
    )


@pytest.fixture(scope="session")
def weather_data():
    """Fixture providing weather data."""
    return pd.DataFrame(
        {
            "station_code": ["TA00001", "TA00001", "TA00001"],
            "timestamp": [
                "2025-05-07 21:00:00+00:00",
                "2025-05-07 16:00:00+00:00",
                "2025-05-07 14:00:00+00:00",
            ],
            "temperature": [20.39166688919068, 22.12499984105428, 24.09166685740153],
            "humidity": [93.20000062386195, 82.87499994039536, 77.22499966621399],
            "wind_speed": [3.04583332935969, 2.8858333230018616, 2.6991666555404663],
            "atmospheric_pressure": [
                88.15000089009602,
                87.9875005086263,
                87.86750030517578,
            ],
            "radiation": [0.0, 0.0, 32.48333295186361],
            "vapor_pressure": [None, None, None],
            "wind_gusts": [3.39166663090388, 3.1800000270207724, 3.639166673024496],
            "precipitation": [0.0, 0.0, 0.0],
            "wind_direction": [311.9166666666667, 312.5833333333333, 316.25],
        }
    )


@pytest.fixture(scope="session")
def devices_data():
    """Fixture providing devices data."""
    return pd.DataFrame(
        {
            "site_id": ["r8Qn65qyg9RHevhwfbB", "r8Qn65q4G9RHevhweyud", ""],
            "device_category": ["lowcost", "lowcost", "lowcost"],
            "_id": ["ma9pMkjs7cYb6B4tKX", "majs7cYET2Db6B4tSX", "NG9pMkjs7cYETB4tKX"],
            "status": ["deployed", "deployed", "recalled"],
            "isActive": [True, True, False],
            "name": ["33_22_lw", "0123lw", "airqo_9876lw"],
            "network": ["xxxx", "zzzz", "airqo"],
            "longitude": [32.9284726, 3.9036253, 22.9837123],
            "latitude": [0.1425362, 1.4895023, 43.9872473],
            "device_number": [-1, 1122222, 5555666],
            "key": ["UZv7psG4uFbmNDkf26Y", "", ""],
        }
    )


@pytest.fixture(scope="session")
def sites_data():
    """Fixture providing sites data."""
    return pd.DataFrame(
        {
            "_id": ["e00137667aaf86", "67aa5555af169", "67aa67aaf1423"],
            "nearest_tahmo_station": [
                "{'id': -1, 'code': None, 'longitude': -1, 'latitude': -1, 'timezone': None}",
                "{'id': -1, 'code': None, 'longitude': -1, 'latitude': -1, 'timezone': None}",
                "{'id': -1, 'code': None, 'longitude': -1, 'latitude': -1, 'timezone': None}",
            ],
            "images": [[], [], []],
            "groups": [
                "['xxxx', 'steel_&somewhere3', 'somewhere']",
                "['xxxx', 'steel_&somewhere3', 'somewhere']",
                "['xxxx', 'steel_&somewhere3', 'somewhere']",
            ],
            "site_codes": [
                "['e00137667aaf86', 'Namanve (Industries)', 'site_538']",
                "['67aa5555af169', 'Namanve (New Town 0973)', 'site_537']",
                "['67aa67aaf1423', 'Namanve (Main Gate Area)', 'site_536']",
            ],
            "formatted_name": [
                "00193464092 somewhere099, SomeCountry",
                "001934666, somewhere099, SomeCountry",
                "4543535, TheYoung002, SomeCountry",
            ],
            "location_name": [
                "location1, somewhere1",
                "location2, somewhere2",
                "location3, somewhere2",
            ],
            "latitude": [0.34743, 0.343922, 0.347548],
            "longitude": [3.696, 3.29, 3.393],
            "name": ["Weigh Bridge", "Boundary wall", "Main Gate Area"],
            "network": ["network1", "network2", "network3"],
            "country": ["country1", "country2", "country3"],
            "region": ["region1", "region2", "region3"],
            "city": ["city1", "city2", "city3"],
            "site_id": ["e00137667aaf86", "67aa5555af169", "67aa67aaf1423"],
            "weather_stations": [[], [], []],
        }
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


# ----------------------------------------------------------------
# Tests for querying devices and sites data from device registry.
# ----------------------------------------------------------------
@pytest.fixture
def mock_load_devices_or_sites_cached_data(monkeypatch):
    """Fixture to mock the load_cached_data method."""
    mock_load_cached_data = MagicMock()
    monkeypatch.setattr(
        "airqo_etl_utils.datautils.DataUtils.load_cached_data", mock_load_cached_data
    )
    return mock_load_cached_data


@pytest.fixture
def mock_fetch_devices_from_api(monkeypatch):
    """Fixture to mock the fetch_devices_from_api method."""
    mock_fetch_devices_from_api = MagicMock()
    monkeypatch.setattr(
        "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api",
        mock_fetch_devices_from_api,
    )
    return mock_fetch_devices_from_api


@pytest.fixture
def airqo_device_keys():
    """Fixture to mock the device keys."""
    keys = {
        "airqo_0123lw": "Rc7zM4r8ZD5n3XdUjsQKVk",
        "airqo_9876lw": "XQ9hvMYw7RqSe4cG8PWfBm",
    }
    return keys


@pytest.fixture
def mock_fetch_sites_from_api(monkeypatch):
    """Fixture to mock the get_sites method."""
    mock_load_sites = MagicMock()
    monkeypatch.setattr(
        "airqo_etl_utils.datautils.DataUtils.fetch_sites_from_api", mock_load_sites
    )
    return mock_load_sites


# ----------------------------------------------------------------
# Tests for querying data from bigquery.
# ----------------------------------------------------------------
@pytest.fixture
def mock_bigquery_api(monkeypatch):
    """Fixture to mock the BigQueryApi class."""
    mock_api = MagicMock()
    monkeypatch.setattr("airqo_etl_utils.datautils.BigQueryApi", lambda: mock_api)
    return mock_api


@pytest.fixture
def mock_data_utils(monkeypatch):
    """Fixture to mock the DataUtils module."""
    mock_utils = MagicMock()
    monkeypatch.setattr("airqo_etl_utils.datautils.DataUtils", mock_utils)
    return mock_utils


@pytest.fixture
def mock_data_validation_utils(monkeypatch):
    """Fixture to mock the DataValidationUtils module."""
    mock_validation = MagicMock()
    monkeypatch.setattr(
        "airqo_etl_utils.datautils.DataValidationUtils", mock_validation
    )
    return mock_validation
