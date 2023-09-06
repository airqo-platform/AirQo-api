# Import pytest and other modules as needed
from unittest import mock

import pandas as pd
import pytest

from airqo_etl_utils.bigquery_api import BigQueryApi


@pytest.fixture
def mock_bigquery_client1(mocker):
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


@pytest.fixture
def mock_bigquery_client2():
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
            fake_job.result.return_value.to_dataframe.return_value = (
                sample_df
            )
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

@pytest.mark.parametrize(
    "start_date_time, expected_df",
    [
        (
            "2023-01-01",
            pd.DataFrame(
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
            ),
        ),
        ("2023-01-02", pd.DataFrame()),
    ],
)
def test_fetch_data_correct_se(mock_bigquery_client2, start_date_time, expected_df):

    """Tests the fetch_data method for the happy path scenarios."""

    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client2

    actual_df = bq_api.fetch_data(start_date_time)
    pd.testing.assert_frame_equal(actual_df, expected_df)


@pytest.mark.parametrize("start_date_time", ["2023-13-01", "2023-01-32", "invalid"])
def test_fetch_data_invalid_date(mock_bigquery_client2, start_date_time):
    """Tests the fetch_data method for the scenario where an invalid date string is passed."""

    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client2

    with pytest.raises(ValueError):
        bq_api.fetch_data(start_date_time)

@pytest.mark.parametrize("start_date_time", ["2023-01-03"])
def test_fetch_data_bigquery_error(mock_bigquery_client2, start_date_time):
    """Tests the fetch_data method for the scenario where a bigquery.GoogleAPIError is raised."""

    # Create an instance of BigQueryApi with the mocked client
    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client2

    with pytest.raises(Exception):
        bq_api.fetch_data(start_date_time)



def test_fetch_raw_readings_empty(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame()
    )
    with pytest.raises(Exception) as e:
        df = api.fetch_raw_readings()
        assert "No data found" in str(e.value)
