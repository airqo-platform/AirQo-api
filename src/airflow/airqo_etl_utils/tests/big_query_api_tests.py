# Import pytest and other modules as needed
import pandas as pd
import pytest

from airqo_etl_utils.bigquery_api import BigQueryApi


@pytest.fixture
def mock_bigquery_client(mocker):
    mock_client = mocker.Mock()
    mock_client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame(
            [
                ["2021-01-01 00:00:00", 1, 10],
                ["2021-01-01 01:00:00", 2, 20],
                ["2021-01-01 02:00:00", 3, 30],
            ],
            columns=["created_at", "device_number", "pm2_5"],
        )
    )
    return mock_client


@pytest.mark.parametrize(
    "method",
    [
        BigQueryApi.fetch_hourly_forecast_training_data,
        BigQueryApi.fetch_daily_forecast_training_data,
    ],
)
def test_fetch_data_columns(method, mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    df = method(api)
    assert list(df.columns) == ["created_at", "device_number", "pm2_5"]
    assert isinstance(df, pd.DataFrame)
    assert not df.empty


def test_fetch_hourly_forecast_training_data_exception(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.side_effect = Exception("Bigquery error")
    with pytest.raises(Exception) as e:
        df = api.fetch_hourly_forecast_training_data()
    assert "Bigquery error" in str(e.value)


def test_fetch_hourly_forecast_training_data_null():
    api = BigQueryApi()
    api.client = mock_bigquery_client()
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame(
            {
                "created_at": ["2021-01-01 00:00:00", "2021-01-01 01:00:00"],
                "device_number": [1, 2],
                "pm2_5": [None, None],
            }
        )
    )
    with pytest.raises(Exception) as e:
        df = api.fetch_hourly_forecast_training_data()
    assert "pm2_5 column cannot be null" in str(e.value)


def test_fetch_daily_forecast_training_data_date_range(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame(
            {
                "created_at": [
                    "2020-01-01 00:00:00",
                    "2020-06-01 00:00:00",
                    "2020-12-01 00:00:00",
                ],
                "device_number": [1, 2, 3],
                "pm2_5": [10, 20, 30],
            }
        )
    )
    df = api.fetch_daily_forecast_training_data()
    assert df["created_at"].min() >= pd.Timestamp.now() - pd.DateOffset(months=12)


def test_fetch_raw_readings_empty(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame()
    )
    with pytest.raises(Exception) as e:
        df = api.fetch_raw_readings()
        assert "No data found" in str(e.value)