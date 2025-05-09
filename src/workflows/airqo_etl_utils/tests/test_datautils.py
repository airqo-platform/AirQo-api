from unittest.mock import MagicMock, patch
import pandas as pd
import pytest
from airqo_etl_utils.datautils import DataUtils
from .conftest import (
    DevicesFixtures,
    LC_RAW_DATA,
    LC_AVERAGED_DATA,
    BAM_RAW_DATA,
    BAM_AVERAGED_DATA,
    CONSOLIDATE_DATA,
    WEATHER_DATA,
    mock_bigquery_api,
    mock_data_validation_utils,
    mock_data_utils,
)
from airqo_etl_utils.constants import (
    DataType,
    Frequency,
    DeviceCategory,
    DeviceNetwork,
)
from airqo_etl_utils.config import configuration as Config


class TestsDevices(DevicesFixtures):
    def test_successful_load_from_cache(self, cached_device_df):
        with patch(
            "airqo_etl_utils.datautils.DataUtils.load_cached_data",
            return_value=cached_device_df,
        ), patch(
            "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api"
        ) as mock_fetch_api:
            devices, _ = DataUtils.get_devices()
            expected_df = cached_device_df.copy()
            expected_df["device_number"] = (
                expected_df["device_number"].fillna(-1).astype(int)
            )
            pd.testing.assert_frame_equal(devices, expected_df)
            mock_fetch_api.assert_not_called()

    def test_successful_fetch_from_api(self, api_device_df, airqo_device_keys):
        with patch(
            "airqo_etl_utils.datautils.DataUtils.load_cached_data",
            return_value=pd.DataFrame(),
        ), patch(
            "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api",
            return_value=(api_device_df.copy(), airqo_device_keys),
        ):
            devices, keys = DataUtils.get_devices()
            expected_df = api_device_df.copy()
            expected_df["device_number"] = (
                expected_df["device_number"].fillna(-1).astype(int)
            )
            pd.testing.assert_frame_equal(devices, expected_df)
            assert keys == airqo_device_keys

    def test_failure_to_retrieve_from_api(self):
        with patch(
            "airqo_etl_utils.datautils.DataUtils.load_cached_data",
            return_value=pd.DataFrame(),
        ), patch(
            "airqo_etl_utils.datautils.DataUtils.fetch_devices_from_api",
            return_value=(pd.DataFrame(), {}),
        ):
            with pytest.raises(
                RuntimeError,
                match="Failed to retrieve devices data from both cache and API.",
            ):
                DataUtils.get_devices()


class Test_BigQuery:
    def test_extract_data_from_bigquery_success(
        self,
        mock_bigquery_api,
        mock_data_utils,
        mock_data_validation_utils,
    ):
        """Test successful data extraction from BigQuery."""

        mock_bigquery_api.query_data.return_value = LC_RAW_DATA
        mock_data_validation_utils.remove_outliers_fix_types.return_value = LC_RAW_DATA
        mock_data_utils._get_table.return_value = ("test_table", None)

        result = DataUtils.extract_data_from_bigquery(
            datatype=DataType.RAW,
            start_date_time="2025-05-01T00:00:00Z",
            end_date_time="2025-05-02T00:00:00Z",
            frequency=Frequency.RAW,
            device_category=DeviceCategory.GENERAL,
        )
        assert result.equals(LC_RAW_DATA)
        mock_bigquery_api.query_data.assert_called_once()
        mock_data_validation_utils.remove_outliers_fix_types.assert_called_once_with(
            LC_RAW_DATA
        )
