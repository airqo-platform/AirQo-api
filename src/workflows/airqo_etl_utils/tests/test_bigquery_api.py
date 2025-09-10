from unittest import mock
import pandas as pd
import unittest
from airqo_etl_utils.bigquery_api import BigQueryApi
import pandas as pd
import pytest

from airqo_etl_utils.bigquery_api import BigQueryApi


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
def test_fetch_data_correct_se(mock_bigquery_client, start_date_time, expected_df):
    """Tests the fetch_data method for scenarios when correct data is retrieved."""

    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client

    actual_df = bq_api.fetch_device_data_for_forecast_job(start_date_time, "train")
    pd.testing.assert_frame_equal(actual_df, expected_df)


@pytest.mark.parametrize("start_date_time", ["2023-13-01", "2023-01-32", "invalid"])
def test_fetch_data_invalid_date(mock_bigquery_client, start_date_time):
    """Tests the fetch_data method for the scenario where an invalid date string is passed."""

    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client

    with pytest.raises(ValueError):
        bq_api.fetch_device_data_for_forecast_job(start_date_time, "train")


@pytest.mark.parametrize("start_date_time", ["2023-01-03"])
def test_fetch_data_bigquery_error(mock_bigquery_client, start_date_time):
    """Tests the fetch_data method for the scenario where a bigquery.GoogleAPIError is raised."""

    # Create an instance of BigQueryApi with the mocked client
    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client

    with pytest.raises(Exception):
        bq_api.fetch_device_data_for_forecast_job(start_date_time, "train")


def test_fetch_raw_readings_empty(mock_bigquery_client):
    api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame()
    )
    with pytest.raises(Exception) as e:
        df = api.fetch_raw_readings()
        assert "No data found" in str(e.value)


class TestFetchMaxMinValues(unittest.TestCase):
    @mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client")
    def test_fetch_max_min_values_success(self, MockBigQueryClient):
        """Test successful fetching of max/min values."""
        mock_client = MockBigQueryClient.return_value
        mock_query_result = mock.MagicMock()
        mock_query_result.to_dataframe.return_value = pd.DataFrame(
            {
                "sample_count_pm2_5": [100],
                "maximum_pm2_5": [50.0],
                "minimum_pm2_5": [10.0],
                "average_pm2_5": [30.0],
                "sample_count_pm10": [100],
                "maximum_pm10": [80.0],
                "minimum_pm10": [20.0],
                "average_pm10": [50.0],
            }
        )
        mock_client.query.return_value.result.return_value = mock_query_result

        api = BigQueryApi()
        result = api.fetch_max_min_values(
            table="test_table",
            start_date_time="2023-01-01T00:00:00Z",
            end_date_time="2023-01-02T00:00:00Z",
            unique_id="device_id",
            filter="test_device",
            pollutant={"pm2_5": ["pm2_5"], "pm10": ["pm10"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 2)
        self.assertIn("pollutant", result.columns)
        self.assertIn("minimum", result.columns)
        self.assertIn("maximum", result.columns)
        self.assertEqual(result.iloc[0]["pollutant"], "pm2_5")
        self.assertEqual(result.iloc[1]["pollutant"], "pm10")

    @mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client")
    def test_fetch_max_min_values_empty_result(self, MockBigQueryClient):
        """Test handling of empty BigQuery result."""
        mock_client = MockBigQueryClient.return_value
        mock_query_result = mock.MagicMock()
        mock_query_result.to_dataframe.return_value = pd.DataFrame()
        mock_client.query.return_value.result.return_value = mock_query_result

        api = BigQueryApi()
        result = api.fetch_max_min_values(
            table="test_table",
            start_date_time="2023-01-01T00:00:00Z",
            end_date_time="2023-01-02T00:00:00Z",
            unique_id="device_id",
            filter="test_device",
            pollutant={"pm2_5": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)

    @mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client")
    def test_fetch_max_min_values_query_failure(self, MockBigQueryClient):
        """Test handling of BigQuery query failure."""
        mock_client = MockBigQueryClient.return_value
        mock_client.query.side_effect = Exception("Query failed")

        api = BigQueryApi()
        with self.assertRaises(Exception):
            api.fetch_max_min_values(
                table="test_table",
                start_date_time="2023-01-01T00:00:00Z",
                end_date_time="2023-01-02T00:00:00Z",
                unique_id="device_id",
                filter="test_device",
                pollutant={"pm2_5": ["pm2_5"]},
            )

    @mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client")
    def test_fetch_max_min_values_missing_columns(self, MockBigQueryClient):
        """Test handling when expected columns are missing in BigQuery result."""
        mock_client = MockBigQueryClient.return_value
        mock_query_result = mock.MagicMock()
        mock_query_result.to_dataframe.return_value = pd.DataFrame(
            {
                "sample_count_pm2_5": [100],
                # Missing minimum_pm2_5, etc.
            }
        )
        mock_client.query.return_value.result.return_value = mock_query_result

        api = BigQueryApi()
        result = api.fetch_max_min_values(
            table="test_table",
            start_date_time="2023-01-01T00:00:00Z",
            end_date_time="2023-01-02T00:00:00Z",
            unique_id="device_id",
            filter="test_device",
            pollutant={"pm2_5": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 1)
        self.assertIsNone(result.iloc[0]["minimum"])  # Should handle missing gracefully
