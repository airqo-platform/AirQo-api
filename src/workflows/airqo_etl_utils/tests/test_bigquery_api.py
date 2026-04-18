from unittest import mock
from pathlib import Path
import pandas as pd
import unittest
from airqo_etl_utils.bigquery_api import BigQueryApi
import pytest

from airqo_etl_utils.utils import Result
from airqo_etl_utils.sql.query_manager import Query


@pytest.fixture
def mock_bigquery_client(monkeypatch):
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

    fake_error = Exception("Fake error")

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

    # Provide a simple storage adapter that delegates to the fake client
    class FakeStorageAdapter:
        def execute_query(self, query, query_parameters=None, use_cache=True):
            try:
                job = fake_client.query(query, None)
                df = job.result().to_dataframe()
                return Result(data=df)
            except Exception as e:
                return Result(error=str(e))

    # Patch the module-level get_configured_storage used by BigQueryApi
    import airqo_etl_utils.bigquery_api as bq_mod

    monkeypatch.setattr(bq_mod, "get_configured_storage", lambda: FakeStorageAdapter())

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
    """Tests the fetch_data method for the scenario where the underlying query returns an error.

    Current behaviour: BigQueryApi.execute_data_query returns an empty DataFrame on adapter errors,
    so the fetch method should return an empty DataFrame rather than raise.
    """

    bq_api = BigQueryApi()
    bq_api.client = mock_bigquery_client

    df = bq_api.fetch_device_data_for_forecast_job(start_date_time, "train")
    assert isinstance(df, pd.DataFrame)
    assert df.empty


def test_fetch_raw_readings_empty(mock_bigquery_client):
    with mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client"):
        api = BigQueryApi()
    api.client = mock_bigquery_client
    api.client.query.return_value.result.return_value.to_dataframe.return_value = (
        pd.DataFrame()
    )
    with pytest.raises(ValueError, match="No data found from bigquery"):
        api.fetch_raw_readings()


@pytest.fixture
def fault_detection_raw_readings_df():
    return pd.DataFrame(
        {
            "timestamp": [
                "2026-03-01 00:00:00",
                "2026-03-01 01:00:00",
                "2026-03-01 00:00:00",
                "2026-03-01 01:00:00",
            ],
            "device_id": ["device-a", "device-a", "device-b", "device-b"],
            "latitude": [0.3476, 0.3476, 0.3136, 0.3136],
            "longitude": [32.5825, 32.5825, 32.5811, 32.5811],
            "s1_pm2_5": [10.0, 14.0, 20.0, 24.0],
            "s2_pm2_5": [11.0, 13.0, 19.0, 25.0],
            "pm2_5": [10.5, 13.5, 19.5, 24.5],
            "battery": [3.9, 3.8, 4.0, 3.9],
        }
    )


def test_fetch_raw_readings_uses_faultdetection_sql_and_hourly_aggregation(
    monkeypatch, fault_detection_raw_readings_df
):
    captured = {}
    expected_query = Query(
        name="fault_detection_raw_device_readings",
        sql=(
            "SELECT * FROM {raw_measurements_table} "
            "WHERE DATE(timestamp) >= DATE_SUB(CURRENT_DATE(), INTERVAL {lookback_days} DAY)"
        ),
        source=Path(
            "src/workflows/airqo_etl_utils/sql/faultdetection/2026041701fault_detection.sql"
        ),
    )

    with mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client"):
        api = BigQueryApi()

    def fake_get_query(name):
        captured["query_name"] = name
        captured["source"] = expected_query.source
        return expected_query

    def fake_execute_data_query(query):
        captured["rendered_query"] = query
        return fault_detection_raw_readings_df.copy()

    monkeypatch.setattr("airqo_etl_utils.bigquery_api.query_manager.get_query", fake_get_query)
    monkeypatch.setattr(api, "execute_data_query", fake_execute_data_query)
    api.raw_measurements_table = "project.dataset.raw_measurements"
    monkeypatch.setattr(
        "airqo_etl_utils.bigquery_api.configuration.FAULT_DETECTION_LOOKBACK_DAYS",
        14,
    )

    result = api.fetch_raw_readings()

    assert captured["query_name"] == "fault_detection_raw_device_readings"
    assert captured["source"].parent.name == "faultdetection"
    assert "project.dataset.raw_measurements" in captured["rendered_query"]
    assert "INTERVAL 14 DAY" in captured["rendered_query"]
    assert list(result["device_id"]) == ["device-a", "device-a", "device-b", "device-b"]
    assert isinstance(result["timestamp"].dtype, pd.DatetimeTZDtype)


def test_fetch_raw_readings_query_failure_raises(monkeypatch):
    with mock.patch("airqo_etl_utils.bigquery_api.bigquery.Client"):
        api = BigQueryApi()

    def raise_query_error(_query):
        raise RuntimeError("BigQuery unavailable")

    monkeypatch.setattr(api, "execute_data_query", raise_query_error)

    with pytest.raises(RuntimeError, match="BigQuery unavailable"):
        api.fetch_raw_readings()


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
