from unittest.mock import MagicMock

import pandas as pd

from airqo_etl_utils.sources.bigquery_source_adapter import BigQuerySourceAdapter
from airqo_etl_utils.sources.registry import (
    get_adapter,
    list_adapters,
    register_adapter,
)
from airqo_etl_utils.sources.adapter import DataSourceAdapter
from airqo_etl_utils.utils import Result
from airqo_etl_utils.constants import DeviceNetwork


# ---------------------------------------------------------------------------
# Registry tests
# ---------------------------------------------------------------------------


class TestAdapterRegistry:
    """Verify the self-registration pattern works end-to-end."""

    def test_builtin_adapters_are_registered(self):
        """All shipped adapters should be present after package import."""
        adapters = list_adapters()
        assert "airqo" in adapters
        assert "iqair" in adapters
        assert "airgradient" in adapters
        assert "tahmo" in adapters
        assert "openweather" in adapters
        assert "nomads" in adapters
        assert "bigquery" in adapters

    def test_get_adapter_returns_correct_types(self):
        from airqo_etl_utils.sources.thingspeak_adapter import ThingSpeakAdapter
        from airqo_etl_utils.sources.iqair_adapter import IQAirAdapter

        assert isinstance(get_adapter(DeviceNetwork.AIRQO), ThingSpeakAdapter)
        assert isinstance(get_adapter(DeviceNetwork.IQAIR), IQAirAdapter)

    def test_get_adapter_returns_none_for_unknown(self):
        assert get_adapter("no_such_network") is None

    def test_get_adapter_fresh_instances(self):
        """Each call should return a new instance."""
        a = get_adapter(DeviceNetwork.AIRQO)
        b = get_adapter(DeviceNetwork.AIRQO)
        assert a is not b

    def test_custom_adapter_registration(self):
        """A third-party adapter can register itself at runtime."""

        class CustomAdapter(DataSourceAdapter):
            def fetch(self, device, dates=None, resolution=None):
                return Result(data={"records": [], "meta": {}})

        register_adapter("custom_test", CustomAdapter)
        adapter = get_adapter("custom_test")
        assert isinstance(adapter, CustomAdapter)
        result = adapter.fetch({})
        assert result.data == {"records": [], "meta": {}}


# ---------------------------------------------------------------------------
# BigQuerySourceAdapter tests
# ---------------------------------------------------------------------------


class TestBigQuerySourceAdapter:
    """Tests for the BigQuery DataSourceAdapter wrapper."""

    def test_is_data_source_adapter(self):
        adapter = BigQuerySourceAdapter()
        assert isinstance(adapter, DataSourceAdapter)

    def test_fetch_missing_query_and_table(self):
        adapter = BigQuerySourceAdapter()
        result = adapter.fetch({})
        assert result.error is not None
        assert "query" in result.error.lower() or "table" in result.error.lower()
        assert result.data["records"] == []

    def test_fetch_with_raw_query(self):
        adapter = BigQuerySourceAdapter()
        fake_df = pd.DataFrame({"col": [1, 2, 3]})
        mock_storage = MagicMock()
        mock_storage.execute_query.return_value = Result(data=fake_df)
        adapter._storage_adapter = mock_storage

        result = adapter.fetch(device={"query": "SELECT * FROM t"})

        mock_storage.execute_query.assert_called_once_with("SELECT * FROM t")
        assert result.error is None
        assert result.data["records"].equals(fake_df)

    def test_fetch_with_table_and_dates(self):
        adapter = BigQuerySourceAdapter()
        fake_df = pd.DataFrame({"val": [42]})
        mock_storage = MagicMock()
        mock_storage.execute_query.return_value = Result(data=fake_df)
        adapter._storage_adapter = mock_storage

        result = adapter.fetch(
            device={"table": "project.ds.tbl", "date_column": "ts"},
            dates=[("2024-01-01", "2024-01-02")],
        )

        called_query = mock_storage.execute_query.call_args[0][0]
        assert "project.ds.tbl" in called_query
        assert "`ts`" in called_query
        assert "2024-01-01" in called_query
        assert result.error is None

    def test_fetch_with_table_no_dates(self):
        adapter = BigQuerySourceAdapter()
        fake_df = pd.DataFrame({"a": [1]})
        mock_storage = MagicMock()
        mock_storage.execute_query.return_value = Result(data=fake_df)
        adapter._storage_adapter = mock_storage

        result = adapter.fetch(device={"table": "p.d.t"})

        called_query = mock_storage.execute_query.call_args[0][0]
        assert "SELECT * FROM `p.d.t`" == called_query
        assert result.error is None

    def test_fetch_propagates_query_error(self):
        adapter = BigQuerySourceAdapter()
        mock_storage = MagicMock()
        mock_storage.execute_query.return_value = Result(error="BQ error")
        adapter._storage_adapter = mock_storage

        result = adapter.fetch(device={"query": "BAD SQL"})

        assert result.error == "BQ error"
        assert result.data["records"] == []

    def test_fetch_handles_exception(self):
        adapter = BigQuerySourceAdapter()
        mock_storage = MagicMock()
        mock_storage.execute_query.side_effect = RuntimeError("boom")
        adapter._storage_adapter = mock_storage

        result = adapter.fetch(device={"query": "SELECT 1"})

        assert "boom" in result.error
        assert result.data["records"] == []

    def test_build_query_multiple_date_ranges(self):
        query = BigQuerySourceAdapter._build_query(
            "p.d.t",
            [("2024-01-01", "2024-01-02"), ("2024-03-01", "2024-03-02")],
            "created_at",
        )
        assert "2024-01-01" in query
        assert "2024-03-01" in query
        assert "`created_at`" in query
        assert " OR " in query

    def test_accessible_via_get_adapter(self):
        adapter = get_adapter("bigquery")
        assert isinstance(adapter, BigQuerySourceAdapter)
