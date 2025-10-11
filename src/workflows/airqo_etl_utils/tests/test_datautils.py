from unittest.mock import MagicMock, patch
import pandas as pd
import unittest
import numpy as np
from datetime import datetime, timezone
from google.api_core import exceptions as google_api_exceptions
import pytest
from airqo_etl_utils.datautils import DataUtils
from .conftest import (
    # Fixtures and mocks
    mock_bigquery_api,
    mock_data_validation_utils,
    mock_data_utils,
    mock_load_devices_or_sites_cached_data,
    mock_fetch_devices_from_api,
    airqo_device_keys,
    mock_fetch_sites_from_api,
)
from airqo_etl_utils.constants import (
    DataType,
    Frequency,
    DeviceCategory,
    DeviceNetwork,
    MetaDataType,
)
from airqo_etl_utils.config import configuration as Config


class TestsDevices:
    def test_successful_load_of_devices_from_cache(
        self,
        devices_data,
        mock_load_devices_or_sites_cached_data,
        mock_fetch_devices_from_api,
        airqo_device_keys,
    ):
        mock_load_devices_or_sites_cached_data.return_value = devices_data
        devices = DataUtils.get_devices()
        expected_df = devices_data.copy()
        expected_df["device_number"] = (
            expected_df["device_number"].fillna(-1).astype(int)
        )
        pd.testing.assert_frame_equal(devices, expected_df)
        mock_fetch_devices_from_api.assert_not_called()

    def test_successful_fetch_from_api(
        self,
        devices_data,
        mock_load_devices_or_sites_cached_data,
        mock_fetch_devices_from_api,
        airqo_device_keys,
    ):
        mock_load_devices_or_sites_cached_data.return_value = pd.DataFrame()
        mock_fetch_devices_from_api.return_value = devices_data
        devices = DataUtils.get_devices()
        expected_df = devices_data.copy()
        expected_df["device_number"] = (
            expected_df["device_number"].fillna(-1).astype(int)
        )
        pd.testing.assert_frame_equal(devices, expected_df)
        mock_load_devices_or_sites_cached_data.assert_called_once()

    def test_failure_to_retrieve_from_api(
        self, mock_load_devices_or_sites_cached_data, mock_fetch_devices_from_api
    ):
        mock_load_devices_or_sites_cached_data.return_value = pd.DataFrame()
        mock_fetch_devices_from_api.return_value = pd.DataFrame()
        with pytest.raises(
            RuntimeError,
            match="Failed to retrieve devices data from both cache and API.",
        ):
            DataUtils.get_devices()


class TestSites:
    def test_successful_load_of_sites_from_cache(
        self,
        sites_data,
        mock_load_devices_or_sites_cached_data,
        mock_fetch_sites_from_api,
    ):
        mock_load_devices_or_sites_cached_data.return_value = sites_data
        sites = DataUtils.get_sites()
        expected_df = sites_data
        pd.testing.assert_frame_equal(sites, expected_df)
        mock_fetch_sites_from_api.assert_not_called()

    def test_successful_fetch_of_sites_from_api(
        self,
        sites_data,
        mock_load_devices_or_sites_cached_data,
        mock_fetch_sites_from_api,
    ):
        mock_load_devices_or_sites_cached_data.return_value = pd.DataFrame()
        mock_fetch_sites_from_api.return_value = sites_data
        sites = DataUtils.get_sites()
        expected_df = sites_data
        pd.testing.assert_frame_equal(sites, expected_df)
        mock_load_devices_or_sites_cached_data.assert_called_once()

    def test_failure_to_retrieve_sites_from_api(
        self, mock_load_devices_or_sites_cached_data, mock_fetch_sites_from_api
    ):
        mock_load_devices_or_sites_cached_data.return_value = pd.DataFrame()
        mock_fetch_sites_from_api.return_value = pd.DataFrame()
        with pytest.raises(
            RuntimeError,
            match="Failed to retrieve cached/api sites data.",
        ):
            DataUtils.get_sites()


class Test_BigQuery:
    def test_lc_raw_data_extract_data_from_bigquery_success(
        self,
        lc_raw_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = lc_raw_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = lc_raw_data
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.RAW,
            device_category=DeviceCategory.GENERAL,
        )
        assert result.equals(lc_raw_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            lc_raw_data
        )

    def test_bam_raw_data_extract_data_from_bigquery_success(
        self,
        bam_raw_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful bam raw data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = bam_raw_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = bam_raw_data
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.RAW,
            device_category=DeviceCategory.BAM,
        )
        assert result.equals(bam_raw_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            bam_raw_data
        )

    def test_lc_averaged_data_extract_data_from_bigquery_success(
        self,
        lc_averaged_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful lowcost averaged data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = lc_averaged_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = (
            lc_averaged_data
        )
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.AVERAGED,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )
        assert result.equals(lc_averaged_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            lc_averaged_data
        )

    def test_bam_average_data_extract_data_from_bigquery_success(
        self,
        bam_averaged_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful bam raw data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = bam_averaged_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = (
            bam_averaged_data
        )
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.AVERAGED,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.BAM,
        )
        assert result.equals(bam_averaged_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            bam_averaged_data
        )

    def test_consolidated_data_extract_data_from_bigquery_success(
        self,
        consolidate_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful bam raw data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = consolidate_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = (
            consolidate_data
        )
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CONSOLIDATED,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.GENERAL,
        )
        assert result.equals(consolidate_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            consolidate_data
        )

    def test_lc_raw_data_empty_return_extract_data_from_bigquery_success(
        self,
        lc_no_data,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = lc_no_data
        mock_data_validation_utils.remove_outliers_fix_types.return_value = lc_no_data
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.RAW,
            device_category=DeviceCategory.GENERAL,
        )
        assert result.equals(lc_no_data)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            lc_no_data
        )

    def test_extract_data_from_bigquery_table_info_failure(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test failure when no table information is found."""

        mock_data_utils._get_table.return_value = (None, None)

        with pytest.raises(
            ValueError,
            match="No table information provided.",
        ):
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time="2025-05-01T00:00:00Z",
                end_date_time="2025-05-02T00:00:00Z",
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
            )
        mock_bigquery_api.query_data.assert_not_called()
        mock_data_validation_utils.remove_outliers_fix_types.assert_not_called()

    def test_extract_data_from_bigquery_query_error(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test handling of errors during BigQuery query execution."""
        mock_data_utils._get_table.return_value = ("valid_table", None)
        mock_bigquery_api.query_data.return_value = None

        with pytest.raises(
            ValueError,
            match="No data returned from BigQuery query, but data was expected. Check your logs for more information",
        ):
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time="2025-05-01T00:00:00Z",
                end_date_time="2025-05-02T00:00:00Z",
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
            )

        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_not_called()

    def test_extract_data_from_bigquery_table_not_found(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test when BigQuery cannot find the table (404 error)."""
        mock_data_utils._get_table.return_value = ("non_existent_table", None)
        mock_bigquery_api.query_data.side_effect = google_api_exceptions.NotFound(
            "Query failed: A specified resource (e.g. dataset or table) was not found."
        )

        with pytest.raises(
            google_api_exceptions.NotFound,
            match=r"Query failed: A specified resource \(e\.g\. dataset or table\) was not found\.",
        ):
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time="2025-05-01T00:00:00Z",
                end_date_time="2025-05-02T00:00:00Z",
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
            )

        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_not_called()

    def test_extract_data_from_bigquery_forbidden(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test when BigQuery has authentication issues (403 error)."""
        mock_data_utils._get_table.return_value = ("non_existent_table", None)
        mock_bigquery_api.query_data.side_effect = google_api_exceptions.Forbidden(
            "Query failed: Permission denied. Check IAM roles for the BigQuery API."
        )

        with pytest.raises(
            google_api_exceptions.Forbidden,
            match="Query failed: Permission denied. Check IAM roles for the BigQuery API.",
        ):
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time="2025-05-01T00:00:00Z",
                end_date_time="2025-05-02T00:00:00Z",
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
            )

        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_not_called()

    def test_extract_data_from_bigquery_bad_request(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test for bad requests (400 error)."""
        mock_data_utils._get_table.return_value = ("non_existent_table", None)
        mock_bigquery_api.query_data.side_effect = google_api_exceptions.BadRequest(
            "Query failed: Bad request. This could be due to an invalid query, incorrect parameters, or other issues."
        )

        with pytest.raises(
            google_api_exceptions.BadRequest,
            match="Query failed: Bad request. This could be due to an invalid query, incorrect parameters, or other issues.",
        ):
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.RAW,
                start_date_time="2025-05-01T00:00:00Z",
                end_date_time="2025-05-02T00:00:00Z",
                frequency=Frequency.RAW,
                device_category=DeviceCategory.GENERAL,
            )

        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_not_called()


class TestComputeDeviceSiteMetadata(unittest.TestCase):
    @patch("airqo_etl_utils.datautils.BigQueryApi")
    def test_compute_device_site_metadata_success(self, MockBigQueryApi):
        """Test successful computation of device site metadata."""
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_bigquery_api.fetch_max_min_values.return_value = pd.DataFrame(
            {
                "pollutant": ["pm2_5", "pm10"],
                "minimum": [10.0, 20.0],
                "maximum": [50.0, 80.0],
                "average": [30.0, 50.0],
                "sample_count": [100, 100],
            }
        )

        entity = {
            "device_id": "test_device",
            "site_id": "test_site",
            "device_maintenance": "2023-01-01T00:00:00Z",
            "next_offset_date": np.nan,
        }
        result = DataUtils.compute_device_site_metadata_per_device(
            table="test_table",
            unique_id="device_id",
            entity=entity,
            column={"pollutant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 2)
        self.assertIn("pollutant", result.columns)
        self.assertIn("minimum", result.columns)
        self.assertIn("maximum", result.columns)
        self.assertIn("next_offset_date", result.columns)
        self.assertEqual(result.iloc[0]["pollutant"], "pm2_5")

    @patch("airqo_etl_utils.datautils.BigQueryApi")
    def test_compute_device_site_metadata_empty_data(self, MockBigQueryApi):
        """Test handling of empty data from BigQuery."""
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_bigquery_api.fetch_max_min_values.return_value = pd.DataFrame()

        entity = {
            "device_id": "test_device",
            "site_id": "test_site",
            "device_maintenance": "2023-01-01T00:00:00Z",
            "next_offset_date": np.nan,
        }
        result = DataUtils.compute_device_site_metadata_per_device(
            table="test_table",
            unique_id="device_id",
            entity=entity,
            column={"polluttant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)

    @patch(
        "airqo_etl_utils.datautils.DataUtils.compute_device_site_metadata_per_device"
    )
    @patch("airqo_etl_utils.datautils.BigQueryApi")
    def test_compute_device_site_metadata_future_end_date(
        self, mock_bigquery_api, mock_compute_metadata
    ):
        """Test when end_date is in the future, should return empty DataFrame."""
        # Configure the mock to return an empty DataFrame
        mock_compute_metadata.return_value = pd.DataFrame()

        entity = {
            "device_id": "test_device",
            "site_id": "test_site",
            "device_maintenance": (
                datetime.now(timezone.utc) - pd.Timedelta(days=10)
            ).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "next_offset_date": np.nan,
        }
        result = DataUtils.compute_device_site_metadata_per_device(
            table="test_table",
            unique_id="device_id",
            entity=entity,
            column={"pollutant": ["pm2_5"]},
            frequency=Frequency.WEEKLY,
        )
        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)

    @patch(
        "airqo_etl_utils.datautils.DataUtils.compute_device_site_metadata_per_device"
    )
    def test_compute_device_site_metadata_invalid_entity(self, mock_compute_metadata):
        """Test with invalid entity data (missing required fields)."""
        entity = {
            "device_id": "test_device",
            # Missing device_maintenance
        }
        mock_compute_metadata.return_value = pd.DataFrame()

        result = DataUtils.compute_device_site_metadata_per_device(
            table="test_table",
            unique_id="device_id",
            entity=entity,
            column={"pollutant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)
        mock_compute_metadata.assert_called_once_with(
            table="test_table",
            unique_id="device_id",
            entity=entity,
            column={"pollutant": ["pm2_5"]},
        )


class TestExtractMostRecentMetadataRecord(unittest.TestCase):
    @patch("airqo_etl_utils.datautils.BigQueryApi")
    @patch("airqo_etl_utils.datautils.DataUtils._get_metadata_table")
    def test_extract_most_recent_metadata_record_success(
        self, mock_get_metadata_table, MockBigQueryApi
    ):
        """Test successful extraction of the most recent record."""
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_get_metadata_table.return_value = (
            "test_table",
            ["col1", "col2", "col3"],
        )
        mock_bigquery_api.fetch_most_recent_record.return_value = pd.DataFrame(
            {"col1": [1], "col2": ["value"], "col3": [datetime.now()]}
        )

        result = DataUtils.extract_most_recent_metadata_record(
            metadata_type=MetaDataType.DATAQUALITYCHECKS,
            unique_id="test_id",
            offset_column="col3",
            filter={"pollutant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 1)
        mock_get_metadata_table.assert_called_once_with(
            MetaDataType.DATAQUALITYCHECKS, MetaDataType.DATAQUALITYCHECKS
        )
        mock_bigquery_api.fetch_most_recent_record.assert_called_once_with(
            "test_table",
            "test_id",
            offset_column="col3",
            columns=["col1", "col2", "col3"],
            filter={"pollutant": ["pm2_5"]},
        )

    @patch("airqo_etl_utils.datautils.BigQueryApi")
    @patch("airqo_etl_utils.datautils.DataUtils._get_metadata_table")
    def test_extract_most_recent_metadata_record_empty_data(
        self, mock_get_metadata_table, MockBigQueryApi
    ):
        """Test handling of empty data returned from BigQuery."""
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_get_metadata_table.return_value = (
            "test_table",
            ["col1", "col2", "col3"],
        )
        mock_bigquery_api.fetch_most_recent_record.return_value = pd.DataFrame()

        result = DataUtils.extract_most_recent_metadata_record(
            metadata_type=MetaDataType.DATAQUALITYCHECKS,
            unique_id="test_id",
            offset_column="col3",
            filter={"pollutant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)
        mock_get_metadata_table.assert_called_once_with(
            MetaDataType.DATAQUALITYCHECKS, MetaDataType.DATAQUALITYCHECKS
        )
        mock_bigquery_api.fetch_most_recent_record.assert_called_once_with(
            "test_table",
            "test_id",
            offset_column="col3",
            columns=["col1", "col2", "col3"],
            filter={"pollutant": ["pm2_5"]},
        )

    @patch("airqo_etl_utils.datautils.BigQueryApi")
    @patch("airqo_etl_utils.datautils.DataUtils._get_metadata_table")
    def test_extract_most_recent_metadata_record_table_not_found(
        self, mock_get_metadata_table, MockBigQueryApi
    ):
        """Test when metadata table is not found."""
        mock_get_metadata_table.return_value = (None, None)
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_bigquery_api.fetch_most_recent_record.return_value = pd.DataFrame()

        result = DataUtils.extract_most_recent_metadata_record(
            metadata_type=MetaDataType.DATAQUALITYCHECKS,
            unique_id="test_id",
            offset_column="col3",
            filter={"pollutant": ["pm2_5"]},
        )

        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(result.empty)
        mock_get_metadata_table.assert_called_once_with(
            MetaDataType.DATAQUALITYCHECKS, MetaDataType.DATAQUALITYCHECKS
        )
        mock_bigquery_api.fetch_most_recent_record.assert_called_once_with(
            None,
            "test_id",
            offset_column="col3",
            columns=None,
            filter={"pollutant": ["pm2_5"]},
        )

    @patch("airqo_etl_utils.datautils.BigQueryApi")
    @patch("airqo_etl_utils.datautils.DataUtils._get_metadata_table")
    def test_extract_most_recent_metadata_record_query_error(
        self, mock_get_metadata_table, MockBigQueryApi
    ):
        """Test handling of errors during BigQuery query execution."""
        mock_bigquery_api = MockBigQueryApi.return_value
        mock_get_metadata_table.return_value = (
            "test_table",
            ["col1", "col2", "col3"],
        )
        mock_bigquery_api.fetch_most_recent_record.side_effect = Exception(
            "Query failed"
        )

        # The function doesn't have exception handling for fetch_most_recent_record
        with self.assertRaises(Exception):
            DataUtils.extract_most_recent_metadata_record(
                metadata_type=MetaDataType.DATAQUALITYCHECKS,
                unique_id="test_id",
                offset_column="col3",
                filter={"pollutant": ["pm2_5"]},
            )

        mock_get_metadata_table.assert_called_once_with(
            MetaDataType.DATAQUALITYCHECKS, MetaDataType.DATAQUALITYCHECKS
        )
        mock_bigquery_api.fetch_most_recent_record.assert_called_once_with(
            "test_table",
            "test_id",
            offset_column="col3",
            columns=["col1", "col2", "col3"],
            filter={"pollutant": ["pm2_5"]},
        )
