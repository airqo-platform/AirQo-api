import pandas as pd
import pytest

from airqo_etl_utils.bigquery_api import BigQueryApi
from airqo_etl_utils.tests.conftest import BigQueryFixtures


class TestsBigQueryApi(BigQueryFixtures):
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
    def test_fetch_data_correct_se(
        self, mock_bigquery_client, start_date_time, expected_df
    ):
        """Tests the fetch_data method for scenarios when correct data is retrieved."""

        bq_api = BigQueryApi()
        bq_api.client = mock_bigquery_client

        actual_df = bq_api.fetch_data(start_date_time, "train")
        pd.testing.assert_frame_equal(actual_df, expected_df)

    @pytest.mark.parametrize("start_date_time", ["2023-13-01", "2023-01-32", "invalid"])
    def test_fetch_data_invalid_date(self, mock_bigquery_client, start_date_time):
        """Tests the fetch_data method for the scenario where an invalid date string is passed."""

        bq_api = BigQueryApi()
        bq_api.client = mock_bigquery_client

        with pytest.raises(ValueError):
            bq_api.fetch_data(start_date_time, "train")

    @pytest.mark.parametrize("start_date_time", ["2023-01-03"])
    def test_fetch_data_bigquery_error(self, mock_bigquery_client, start_date_time):
        """Tests the fetch_data method for the scenario where a bigquery.GoogleAPIError is raised."""
        bq_api = BigQueryApi()
        bq_api.client = mock_bigquery_client

        with pytest.raises(Exception):
            bq_api.fetch_data(start_date_time, "train")

    def test_fetch_raw_readings_empty(self, mock_bigquery_client):
        api = BigQueryApi()
        api.client = mock_bigquery_client
        api.client.query.return_value.result.return_value.to_dataframe.return_value = (
            pd.DataFrame()
        )
        with pytest.raises(Exception) as e:
            df = api.fetch_raw_readings()
            assert "No data found" in str(e.value)
