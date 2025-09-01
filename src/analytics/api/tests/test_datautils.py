import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, MagicMock

from api.utils.datautils import DataUtils
from constants import DataType, DeviceCategory, Frequency


@pytest.fixture
def test_dataframe():
    """Return a test DataFrame with various data types for testing."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3, 0.0, np.nan],
            "pm10": [20.1, 25.7, 0.0, 30.2],
            "temperature": [22.5, 23.1, 24.0, 22.8],
            "humidity": [65.3, 70.2, 68.9, 67.5],
            "frequency": ["hourly", "hourly", "hourly", "hourly"],
            "device_id": ["device1", "device2", "device3", "device4"],
            "datetime": [
                "2025-01-01 00:00:00Z",
                "2025-01-01 01:00:00Z",
                "2025-01-02 00:00:00Z",
                "2025-01-02 01:00:00Z",
            ],
            "timestamp": pd.to_datetime(
                [
                    "2025-01-01 00:00:00Z",
                    "2025-01-01 01:00:00Z",
                    "2025-01-02 00:00:00Z",
                    "2025-01-02 01:00:00Z",
                ]
            ),
            "network": ["airqo", "airqo", "iqair", "airqo"],
        }
    )


@pytest.fixture
def test_dataframe_weekly():
    """Return a test DataFrame with various data types for testing."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3, 0.0, np.nan],
            "pm10": [20.1, 25.7, 0.0, 30.2],
            "temperature": [22.5, 23.1, 24.0, 22.8],
            "humidity": [65.3, 70.2, 68.9, 67.5],
            "frequency": ["weekly", "weekly", "weekly", "weekly"],
            "week": ["2025-01-01", "2025-01-01", "2025-01-02", "2025-01-02"],
            "device_id": ["device1", "device2", "device3", "device4"],
            "datetime": [
                "2025-01-01 00:00:00Z",
                "2025-01-01 01:00:00Z",
                "2025-01-02 00:00:00Z",
                "2025-01-02 01:00:00Z",
            ],
            "timestamp": pd.to_datetime(
                [
                    "2025-01-01 00:00:00Z",
                    "2025-01-01 01:00:00Z",
                    "2025-01-02 00:00:00Z",
                    "2025-01-02 01:00:00Z",
                ]
            ),
            "network": ["airqo", "airqo", "iqair", "airqo"],
        }
    )


@pytest.fixture
def zero_columns_df():
    """Return a DataFrame with some columns containing only zeros."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3, 12.1],
            "pm10": [20.1, 25.7, 22.3],
            "zero_col": [0.0, 0.0, 0.0],
            "network": ["airqo", "airqo", "airqo"],
        }
    )


@pytest.fixture
def raw_values_df():
    """Return a DataFrame with both regular and raw value columns."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3, 12.1],
            "pm10": [20.1, 25.7, 22.3],
            "pm2_5_raw_value": [11.2, 16.1, 13.0],
            "pm10_raw_value": [21.5, 26.8, 23.2],
            "network": ["airqo", "iqair", "airqo"],
        }
    )


@pytest.fixture
def missing_columns_df():
    """Return a DataFrame missing required pollutant columns."""
    return pd.DataFrame(
        {"other_col": [1, 2, 3], "network": ["airqo", "airqo", "airqo"]}
    )


@pytest.fixture
def optional_fields_df():
    """Return a DataFrame with optional fields."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3],
            "pm10": [20.1, 25.7],
            "latitude": [1, 2],
            "longitude": [3, 4],
            "timestamp": ["2025-01-01", "2025-01-02"],
        }
    )


class TestDataUtils:
    """Tests for the DataUtils class."""

    @patch("api.utils.datautils.BigQueryApi")
    @patch("api.utils.datautils.Config")
    def test_extract_data_from_bigquery_success(
        self, mock_config, mock_bq_api, test_dataframe
    ):
        """Test successful data extraction from BigQuery."""
        mock_bigquery_instance = MagicMock()
        mock_bq_api.return_value = mock_bigquery_instance
        mock_bigquery_instance.query_data.return_value = (
            test_dataframe.copy(),
            {"total_count": 4, "has_more": False, "next": None},
        )
        mock_config.data_sources.return_value = {
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: "project.dataset.hourly_table"
                }
            }
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude", "timestamp"}
        }

        result_df, metadata = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CALIBRATED,
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.LOWCOST,
            main_columns=["pm2_5", "pm10"],
            data_filter={"device_id": "device1"},
            extra_columns=["temperature", "humidity"],
            use_cache=True,
        )

        mock_bigquery_instance.query_data.assert_called_once()
        assert not result_df.empty
        assert metadata == {"total_count": 4, "has_more": False, "next": None}
        assert "pm2_5" in result_df.columns
        assert "temperature" in result_df.columns
        assert "humidity" in result_df.columns
        assert "frequency" in result_df.columns
        assert result_df["frequency"].iloc[0] == "hourly"

    @patch("api.utils.datautils.BigQueryApi")
    @patch("api.utils.datautils.Config")
    def test_extract_data_from_bigquery_with_cursor(
        self, mock_config, mock_bq_api, test_dataframe
    ):
        """Test data extraction with cursor token."""
        mock_bigquery_instance = MagicMock()
        mock_bq_api.return_value = mock_bigquery_instance
        mock_bigquery_instance.query_data.return_value = (
            test_dataframe.copy(),
            {"next": "next_cursor", "has_more": True, "total_count": 2},
        )
        mock_config.data_sources.return_value = {
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: "project.dataset.hourly_table"
                }
            }
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude", "timestamp"}
        }

        result_df, metadata = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CALIBRATED,
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.LOWCOST,
            main_columns=["pm2_5", "pm10"],
            data_filter={"device_id": "device1"},
            use_cache=True,
            cursor_token="some_cursor_token",
        )

        mock_bigquery_instance.query_data.assert_called_once_with(
            table="project.dataset.hourly_table",
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            device_category=DeviceCategory.LOWCOST,
            network=None,
            frequency=Frequency.HOURLY,
            data_type=DataType.CALIBRATED,
            columns=["pm2_5", "pm10"],
            where_fields={"device_id": "device1"},
            dynamic_query=False,
            use_cache=True,
            cursor_token="some_cursor_token",
        )
        assert not result_df.empty
        assert metadata["total_count"] == 2
        assert metadata["next"] == "next_cursor"
        assert metadata["has_more"] is True

    @patch("api.utils.datautils.Config")
    def test_extract_data_from_bigquery_table_not_found(self, mock_config):
        """Test extraction when no table is found."""
        mock_config.data_sources.return_value = {}

        with pytest.raises(ValueError) as excinfo:
            DataUtils.extract_data_from_bigquery(
                datatype=DataType.CALIBRATED,
                start_date_time="2025-01-01",
                end_date_time="2025-01-02",
                frequency=Frequency.HOURLY,
                device_category=DeviceCategory.LOWCOST,
            )

        assert "No table information provided" in str(excinfo.value)

    @patch("api.utils.datautils.BigQueryApi")
    @patch("api.utils.datautils.Config")
    def test_extract_data_with_empty_result(self, mock_config, mock_bq_api):
        """Test handling of empty query results."""
        mock_bigquery_instance = MagicMock()
        mock_bq_api.return_value = mock_bigquery_instance
        empty_df = pd.DataFrame()
        mock_bigquery_instance.query_data.return_value = (
            empty_df,
            {"next": None, "has_more": False, "total_count": 0},
        )
        mock_bigquery_instance.get_columns.return_value = ["pm2_5", "pm10", "device_id"]

        mock_config.data_sources.return_value = {
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: "project.dataset.hourly_table"
                }
            }
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        result_df, metadata = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CALIBRATED,
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.LOWCOST,
            main_columns=["pm2_5", "pm10"],
        )

        assert result_df.empty
        assert list(result_df.columns) == ["pm2_5", "pm10", "device_id"]
        assert metadata == {"next": None, "has_more": False, "total_count": 0}

    def test_drop_zero_rows_and_columns_data_cleaning(self, zero_columns_df):
        """Test removing columns with only zeros."""
        result = DataUtils.drop_zero_rows_and_columns_data_cleaning(
            zero_columns_df, DataType.CALIBRATED, ["pm2_5", "pm10"]
        )

        assert "zero_col" not in result.columns
        assert len(result) == 3

    def test_drop_zero_rows_and_columns_with_raw_data(self, raw_values_df):
        """Test handling of raw data values."""
        result = DataUtils.drop_zero_rows_and_columns_data_cleaning(
            raw_values_df, DataType.RAW, ["pm2_5", "pm10"]
        )

        assert len(result) == 3
        assert "pm2_5" in result.columns
        assert "pm2_5_raw_value" in result.columns

    @patch("api.utils.datautils.Config")
    def test_drop_unnecessary_columns_data_cleaning_keep_extra(
        self, mock_config, optional_fields_df
    ):
        """Test column dropping while keeping specified extra columns."""
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        result = DataUtils.drop_unnecessary_columns_data_cleaning(
            optional_fields_df, ["latitude"], DeviceCategory.LOWCOST
        )

        assert "latitude" in result.columns
        assert "longitude" not in result.columns

    @patch("api.utils.datautils.Config")
    def test_drop_unnecessary_columns_data_cleaning_drop_all(
        self, mock_config, optional_fields_df
    ):
        """Test dropping all optional fields."""
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        result = DataUtils.drop_unnecessary_columns_data_cleaning(
            optional_fields_df, [], DeviceCategory.LOWCOST
        )

        assert "latitude" not in result.columns
        assert "longitude" not in result.columns
        assert set(result.columns) == {"pm2_5", "pm10"}

    @patch("api.utils.datautils.BigQueryApi")
    @patch("api.utils.datautils.Config")
    def test_extract_data_with_weekly_frequency(
        self, mock_config, mock_bq_api, test_dataframe_weekly
    ):
        """Test data extraction with weekly frequency."""
        mock_bigquery_instance = MagicMock()
        mock_bq_api.return_value = mock_bigquery_instance
        mock_bigquery_instance.query_data.return_value = (
            test_dataframe_weekly.copy(),
            {"next": None, "has_more": False, "total_count": 4},
        )

        mock_config.data_sources.return_value = {
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.DAILY: "project.dataset.daily_table",
                    Frequency.WEEKLY: "project.dataset.weekly_table",
                }
            }
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        result_df, metadata = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CALIBRATED,
            start_date_time="2025-01-01",
            end_date_time="2025-01-15",
            frequency=Frequency.WEEKLY,
            device_category=DeviceCategory.LOWCOST,
            main_columns=["pm2_5", "pm10"],
            dynamic_query=True,
        )
        mock_bigquery_instance.query_data.assert_called_once()
        assert metadata == {"next": None, "has_more": False, "total_count": 4}
        assert result_df["frequency"].iloc[0] == "weekly"

    @patch("api.utils.datautils.BigQueryApi")
    @patch("api.utils.datautils.Config")
    @patch("api.utils.cursor_utils.cache")
    def test_extract_data_from_bigquery_with_redis_failure(
        self, mock_cache, mock_config, mock_bq_api, test_dataframe
    ):
        """Test data extraction works even if Redis fails."""
        mock_bigquery_instance = MagicMock()
        mock_bq_api.return_value = mock_bigquery_instance
        mock_bigquery_instance.query_data.return_value = (
            test_dataframe.copy(),
            {"next": None, "has_more": False, "total_count": 4},
        )

        mock_config.data_sources.return_value = {
            DataType.CALIBRATED: {
                DeviceCategory.LOWCOST: {
                    Frequency.HOURLY: "project.dataset.hourly_table"
                }
            }
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        mock_cache.get.side_effect = Exception("Redis connection error")

        result_df, metadata = DataUtils.extract_data_from_bigquery(
            datatype=DataType.CALIBRATED,
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.LOWCOST,
            cursor_token="some_cursor_token",
        )

        assert not result_df.empty
        assert "frequency" in result_df.columns
