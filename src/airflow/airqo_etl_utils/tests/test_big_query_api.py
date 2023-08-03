import pytest
import pandas as pd
from airqo_etl_utils.bigquery_api import BigQueryApi


# Create an instance of the class to test as a fixture
@pytest.fixture
def api():
    return BigQueryApi()


def test_fetch_hourly_forecast_training_data(api):
    df = api.fetch_hourly_forecast_training_data()
    assert isinstance(df, pd.DataFrame)
    assert list(df.columns) == ["created_at", "device_number", "pm2_5"]
    assert len(df) > 0

def test_fetch_daily_forecast_training_data(api):
    df = api.fetch_daily_forecast_training_data()
    assert isinstance(df, pd.DataFrame)
    assert list(df.columns) == ["created_at", "device_number", "pm2_5"]
    assert len(df) > 0


if __name__ == "__main__":
    pytest.main()
