import pandas as pd
import pytest

from airqo_etl_utils.bigquery_api import BigQueryApi


@pytest.fixture
def mock_bigquery_client(mocker):
    mock_client = mocker.Mock()
    mock_client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame(
            [
                ["2023-01-01 00:00:00", "device_1", 10, 20],
                ["2023-01-01 00:00:00", "device_2", 30, 40],
                ["2023-01-01 00:00:00", "device_3", 50, 60],
            ],
            columns=["timestamp", "device_id", "s1_pm2_5", "s2_pm2_5"],
        )
    )

    return mock_client


def test_fetch_raw_readings_empty(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame()
    )
    with pytest.raises(Exception) as e:
        df = api.fetch_raw_readings()
        assert "No data found" in str(e.value)
