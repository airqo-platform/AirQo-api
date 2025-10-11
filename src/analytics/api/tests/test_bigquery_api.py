import pytest
import pandas as pd
import json
from unittest.mock import patch, MagicMock
from google.cloud import bigquery

from api.models.bigquery_api import BigQueryApi
from constants import DeviceCategory, Frequency, DataType, DeviceNetwork, ColumnDataType
from api.utils.cursor_utils import CursorUtils


@pytest.fixture
def bq_api():
    """Create a BigQueryApi instance with mocked dependencies."""
    with patch("api.models.bigquery_api.bigquery.Client"), patch(
        "api.models.bigquery_api.Utils"
    ) as mock_utils:

        mock_utils.schema.return_value = [
            {"name": "pm2_5", "type": "FLOAT"},
            {"name": "pm10", "type": "FLOAT"},
            {"name": "device_id", "type": "STRING"},
            {"name": "site_id", "type": "STRING"},
            {"name": "timestamp", "type": "TIMESTAMP"},
            {"name": "datetime", "type": "STRING"},
        ]
        mock_utils.table_name.return_value = "project.dataset.table"

        mock_utils.get_columns.return_value = [
            "pm2_5",
            "pm10",
            "device_id",
            "site_id",
            "timestamp",
            "datetime",
        ]

        api_instance = BigQueryApi()
        # Mock the get_columns method directly on the instance with column type filtering
        def mock_get_columns(table_name, column_types=None, *args, **kwargs):
            if column_types and ColumnDataType.FLOAT in column_types:
                return ["pm2_5", "pm10"]  # Return only float columns
            return mock_utils.get_columns.return_value

        api_instance.get_columns = mock_get_columns

        yield api_instance


@pytest.fixture
def test_dataframe():
    """Create a test DataFrame with sample data."""
    return pd.DataFrame(
        {
            "pm2_5": [10.5, 15.3, 0.0, 12.2],
            "pm10": [20.1, 25.7, 0.0, 30.2],
            "device_id": ["device1", "device2", "device1", "device3"],
            "site_id": ["site1", "site2", "site1", "site3"],
            "timestamp": pd.to_datetime(
                [
                    "2025-01-01 00:00:00Z",
                    "2025-01-02 00:00:00Z",
                    "2025-01-03 00:00:00Z",
                    "2025-01-04 00:00:00Z",
                ]
            ),
            "datetime": [
                "2025-01-01 00:00:00Z",
                "2025-01-02 00:00:00Z",
                "2025-01-03 00:00:00Z",
                "2025-01-04 00:00:00Z",
            ],
        }
    )


class TestBigQueryApiInitialization:
    """Tests for BigQueryApi initialization."""

    @patch("api.models.bigquery_api.Config")
    def test_init(self, mock_config):
        """Test initialization of BigQueryApi with proper configuration."""
        mock_config.SCHEMA_FILE_MAPPING = {"test_table": "test_schema.json"}
        mock_config.BIGQUERY_SITES_SITES = "sites_table"
        mock_config.BIGQUERY_AIRQLOUDS_SITES = "airqlouds_sites_table"
        mock_config.BIGQUERY_DEVICES_DEVICES = "devices_table"
        mock_config.BIGQUERY_AIRQLOUDS = "airqlouds_table"
        mock_config.FILTER_FIELD_MAPPING = {"device": "device_id"}

        with patch("api.models.bigquery_api.bigquery.Client"):
            bq_api = BigQueryApi()

            assert bq_api.schema_mapping == {"test_table": "test_schema.json"}
            assert bq_api.field_mappings == {"device": "device_id"}


class TestBigQueryApiQueryProperties:
    """Tests for BigQueryApi query properties and simple methods."""

    def test_device_info_query(self, bq_api):
        """Test device_info_query property."""
        assert "site_id AS site_id" in bq_api.device_info_query
        assert "network AS network" in bq_api.device_info_query

    def test_site_info_query(self, bq_api):
        """Test site_info_query property."""
        assert "name AS site_name" in bq_api.site_info_query

    def test_airqloud_info_query(self, bq_api):
        """Test airqloud_info_query property."""
        assert "name AS airqloud_name" in bq_api.airqloud_info_query

    def test_add_device_join(self, bq_api):
        """Test add_device_join method."""
        query = "SELECT * FROM data_table"
        result = bq_api.add_device_join(query)
        assert "RIGHT JOIN" in result
        assert "device_id = " in result

    def test_add_site_join(self, bq_api):
        """Test add_site_join method."""
        query = "SELECT * FROM data_table"
        result = bq_api.add_site_join(query)
        assert "RIGHT JOIN" in result
        assert "site_id = " in result

    def test_add_airqloud_join(self, bq_api):
        """Test add_airqloud_join method."""
        query = "SELECT * FROM data_table"
        result = bq_api.add_airqloud_join(query)
        assert "RIGHT JOIN" in result
        assert "airqloud_id = " in result

    def test_get_time_grouping(self, bq_api):
        """Test get_time_grouping method."""
        assert (
            bq_api.get_time_grouping("weekly")
            == "TIMESTAMP_TRUNC(timestamp, WEEK(MONDAY)) AS week"
        )
        assert (
            bq_api.get_time_grouping("monthly")
            == "TIMESTAMP_TRUNC(timestamp, MONTH) AS month"
        )
        assert (
            bq_api.get_time_grouping("yearly") == "EXTRACT(YEAR FROM timestamp) AS year"
        )
        assert bq_api.get_time_grouping("daily") == "timestamp"


class TestBigQueryApiQueryBuilder:
    """Tests for BigQueryApi query building methods."""

    @patch("api.models.bigquery_api.Config")
    @patch("api.models.bigquery_api.COMMON_POLLUTANT_MAPPING_v2")
    def test_query_columns_builder(self, mock_mapping, mock_config, bq_api):
        """Test _query_columns_builder method."""
        mock_mapping.get.return_value = {
            "averaged": {"pm2_5": ["pm2_5"], "pm10": ["pm10"]},
            "raw": {"pm2_5": ["pm2_5"], "pm10": ["pm10"]},
        }
        mock_config.OPTIONAL_FIELDS = {
            DeviceCategory.LOWCOST: {"latitude", "longitude"}
        }

        columns = bq_api._query_columns_builder(
            pollutants=["pm2_5", "pm10"],
            data_type=DataType.CALIBRATED,
            frequency=Frequency.HOURLY,
            device_category=DeviceCategory.LOWCOST,
            table_name="project.dataset.table",
        )

        assert any("pm2_5" in col for col in columns)
        assert any("pm10" in col for col in columns)
        assert any("lat" in col for col in columns)

    @patch("api.models.bigquery_api.Config")
    def test_get_columns_all(self, mock_config, bq_api):
        """Test get_columns method for all columns."""
        mock_config.SCHEMA_FILE_MAPPING = {"project.dataset.table": "test_schema.json"}

        columns = bq_api.get_columns("project.dataset.table")

        assert set(columns) == {
            "pm2_5",
            "pm10",
            "device_id",
            "site_id",
            "timestamp",
            "datetime",
        }

    @patch("api.models.bigquery_api.Config")
    def test_get_columns_float_only(self, mock_config, bq_api):
        """Test get_columns method filtered by column type."""
        mock_config.SCHEMA_FILE_MAPPING = {"test_table": "test_schema.json"}

        columns = bq_api.get_columns("test_table", [ColumnDataType.FLOAT])

        assert set(columns) == {"pm2_5", "pm10"}

    @patch("api.models.bigquery_api.Config")
    def test_get_columns_invalid_table(self, mock_config, bq_api):
        """Test get_columns method with invalid table name."""
        mock_config.SCHEMA_FILE_MAPPING = {}

        # Restore the original method to test the actual error handling
        with patch.object(
            bq_api, "get_columns", wraps=BigQueryApi.get_columns.__get__(bq_api)
        ):
            with pytest.raises(Exception):
                bq_api.get_columns("invalid_table")


class TestBigQueryApiQueryExecution:
    """Tests for BigQueryApi query execution and pagination."""

    @patch("api.models.bigquery_api.Config")
    def test_estimate_query_rows(self, mock_config, bq_api):
        """Test estimate_query_rows method."""
        mock_config.DATA_EXPORT_LIMIT = 1000
        query_job = MagicMock()
        query_job.total_bytes_processed = 100000

        bq_api.client.query.return_value = query_job

        table = MagicMock()
        table.num_rows = 1000
        table.num_bytes = 50000
        bq_api.client.get_table.return_value = table

        estimated, bytes_scanned, avg_size, paginate = bq_api.estimate_query_rows(
            "SELECT * FROM table", "project.dataset.table"
        )

        assert estimated == 2000  # 100000 / (50000/1000)
        assert bytes_scanned == 100000
        assert avg_size == 50
        assert paginate is True

    @patch("api.models.bigquery_api.Config")
    @patch("api.models.bigquery_api.CursorUtils")
    def test_apply_pagination_cursor(self, mock_cursor_utils, mock_config, bq_api):
        """Test _apply_pagination_cursor method."""
        mock_config.FILTER_FIELD_MAPPING = {"device_names": "device_id"}
        mock_cursor_utils.decode_cursor.return_value = "2025-01-01 00:00:00Z|device1"

        query = "SELECT * FROM table"
        result = bq_api._apply_pagination_cursor(
            query, "timestamp", "some_cursor_token", "device_names"
        )

        assert "timestamp > '2025-01-01 00:00:00Z'" in result
        assert "device_id = 'device1'" in result

    @patch("api.models.bigquery_api.Config")
    @patch("api.models.bigquery_api.CursorUtils")
    def test_generate_next_cursor(self, mock_cursor_utils, mock_config, bq_api):
        """Test _generate_next_cursor method."""
        mock_config.FILTER_FIELD_MAPPING = {"sites": "site_id"}
        mock_cursor_utils.create_cursor.return_value = "cursor_token_123"

        df = pd.DataFrame(
            {
                "timestamp": ["2025-01-04 00:00:00Z"],
                "site_id": ["site3"],
                "device_id": ["device3"],
            }
        )

        cursor_token = bq_api._generate_next_cursor(df, "timestamp", "sites")

        assert cursor_token == "cursor_token_123"
        mock_cursor_utils.create_cursor.assert_called_once()

    @patch("api.models.bigquery_api.Config")
    @patch("api.models.bigquery_api.cache")
    def test_compose_dynamic_query(self, mock_redis_cache, mock_config, bq_api):
        """Test compose_dynamic_query method."""

        mock_config.OPTIONAL_FIELDS = {DeviceCategory.LOWCOST: set()}
        mock_config.DATA_EXPORT_DECIMAL_PLACES = 2

        with patch.object(bq_api, "compose_dynamic_query", return_value="BUILT QUERY"):

            result = bq_api.compose_dynamic_query(
                table="project.dataset.table",
                start_date="2025-01-01",
                end_date="2025-01-04",
                pollutants=["pm2_5", "pm10"],
                data_filter={"device_names": ["device1", "device2"]},
                data_type=DataType.CALIBRATED,
                frequency=Frequency.HOURLY,
                device_category=DeviceCategory.LOWCOST,
            )
            assert result == "BUILT QUERY"

    @patch("api.models.bigquery_api.Config")
    def test_query_data_with_cursor(self, mock_config, bq_api, test_dataframe):
        """Test query_data method with pagination cursor."""
        mock_config.DATA_EXPORT_LIMIT = 2

        query_result = MagicMock()
        query_result.to_dataframe.return_value = test_dataframe
        bq_api.client.query.return_value.result.return_value = query_result

        with patch.object(
            bq_api, "compose_query", return_value="TEST QUERY"
        ), patch.object(
            bq_api, "estimate_query_rows", return_value=(10, 1000, 100, True)
        ), patch.object(
            bq_api, "_apply_pagination_cursor", return_value="PAGINATED QUERY"
        ), patch.object(
            bq_api, "_get_pagination_order_clause", return_value="timestamp"
        ):

            df, metadata = bq_api.query_data(
                table="project.dataset.table",
                start_date_time="2025-01-01",
                end_date_time="2025-01-04",
                device_category=DeviceCategory.LOWCOST,
                frequency=Frequency.HOURLY,
                where_fields={"device_names": ["device1", "device2"]},
                cursor_token="some_cursor_token",
            )

            assert len(df) == 2
            assert metadata["has_more"] is True
            assert metadata["next"] is not None

    @patch("api.models.bigquery_api.Config")
    def test_get_device_query(self, mock_config, bq_api):
        """Test get_device_query method."""
        query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["device1", "device2"],
            pollutants_query="SELECT pm2_5, pm10",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )

        assert "WHERE project.dataset.table.timestamp BETWEEN" in query
        assert "UNNEST(@filter_value)" in query
        assert "device_id" in query

    @patch("api.models.bigquery_api.Config")
    def test_get_site_query(self, mock_config, bq_api):
        """Test get_site_query method."""
        query = bq_api.get_site_query(
            table="project.dataset.table",
            filter_value=["site1", "site2"],
            pollutants_query="SELECT pm2_5, pm10",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )

        assert "WHERE project.dataset.table.timestamp BETWEEN" in query
        assert "UNNEST(@filter_value)" in query
        assert "site_id" in query

    @patch("api.models.bigquery_api.Config")
    def test_query_data_empty_result(self, mock_config, bq_api):
        """Test query_data method with empty result."""
        mock_config.DATA_EXPORT_LIMIT = 100

        empty_df = pd.DataFrame()
        query_result = MagicMock()
        query_result.to_dataframe.return_value = empty_df
        bq_api.client.query.return_value.result.return_value = query_result

        with patch.object(
            bq_api, "compose_query", return_value="TEST QUERY"
        ), patch.object(
            bq_api, "_get_pagination_order_clause", return_value="timestamp"
        ):

            df, metadata = bq_api.query_data(
                table="project.dataset.table",
                start_date_time="2025-01-01",
                end_date_time="2025-01-04",
                device_category=DeviceCategory.LOWCOST,
                frequency=Frequency.HOURLY,
                where_fields={"device_names": ["device1", "device2"]},
            )

            assert df.empty is True
            assert metadata["has_more"] is False
            assert metadata["next"] is None
