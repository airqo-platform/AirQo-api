import pandas as pd
import pytest


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
