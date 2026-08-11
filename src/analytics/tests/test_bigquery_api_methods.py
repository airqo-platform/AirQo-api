"""
Tests for api/models/bigquery_api.py query-building and pagination methods.

These exercise BigQueryApi against the real test settings (config via
tests/test_config.py) and the real schema JSON files under schemas/files/ —
no mocking of Config or the schema loader, since both are genuinely
lightweight and deterministic. Only the BigQuery client itself is mocked
(via the autouse `mock_bigquery_client` fixture in conftest.py), since that's
the actual network/credentials boundary.

Complements tests/test_bigquery_params.py, which covers query-parameter type
selection (`_build_filter_parameter`) and the pagination dry-run parameter
forwarding fix in `estimate_query_rows`.
"""

from __future__ import annotations

import time

import pandas as pd
import pytest
from unittest.mock import MagicMock

from api.models.bigquery_api import BigQueryApi
from api.utils.cursor_utils import CursorUtils
from constants import ColumnDataType, DataType, DeviceCategory, Frequency


@pytest.fixture
def bq_api() -> BigQueryApi:
    """A real BigQueryApi instance; only the network-facing client is mocked
    (globally, via conftest.py's autouse fixture)."""
    return BigQueryApi()


# ---------------------------------------------------------------------------
# Query fragment properties
# ---------------------------------------------------------------------------


class TestQueryProperties:
    def test_device_info_query(self, bq_api):
        assert "site_id AS site_id" in bq_api.device_info_query
        assert "network AS network" in bq_api.device_info_query

    def test_site_info_query(self, bq_api):
        assert "name AS site_name" in bq_api.site_info_query

    def test_location_info_query(self, bq_api):
        """Added for the /forecast-data endpoint (satellite country/city query)."""
        query = bq_api.location_info_query
        assert "country AS country" in query
        assert "city AS city" in query
        assert "network AS network" in query


class TestJoins:
    def test_add_device_join(self, bq_api):
        result = bq_api.add_device_join("SELECT * FROM data_table")
        assert "RIGHT JOIN" in result
        assert "data.device_id = " in result

    def test_add_site_join(self, bq_api):
        result = bq_api.add_site_join("SELECT * FROM data_table")
        assert "RIGHT JOIN" in result
        assert "data.site_id = " in result

    def test_airqloud_join_helpers_are_gone(self, bq_api):
        """airqlouds is deprecated — its query builders were removed so a
        stale caller fails loudly instead of silently building dead SQL."""
        for removed in (
            "airqloud_info_query",
            "add_airqloud_join",
            "add_device_join_to_airqlouds",
            "get_airqloud_query",
        ):
            assert not hasattr(bq_api, removed), f"{removed} should be removed"


class TestTimeGrouping:
    @pytest.mark.parametrize(
        "frequency,expected",
        [
            ("weekly", "TIMESTAMP_TRUNC(timestamp, WEEK(MONDAY)) AS week"),
            ("monthly", "TIMESTAMP_TRUNC(timestamp, MONTH) AS month"),
            ("yearly", "EXTRACT(YEAR FROM timestamp) AS year"),
            ("daily", "timestamp"),
            ("hourly", "timestamp"),
        ],
    )
    def test_get_time_grouping(self, bq_api, frequency, expected):
        assert bq_api.get_time_grouping(frequency) == expected


# ---------------------------------------------------------------------------
# Filter query builders
# ---------------------------------------------------------------------------


class TestFilterQueryBuilders:
    def test_get_device_query_uses_unnest_parameter(self, bq_api):
        query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["device1", "device2"],
            pollutants_query="SELECT pm2_5, pm10",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "BETWEEN '2025-01-01' AND '2025-01-04'" in query
        assert "IN UNNEST(@filter_value)" in query
        assert "device_id" in query

    def test_get_device_query_groups_for_aggregated_frequency(self, bq_api):
        query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["device1"],
            pollutants_query="SELECT pm2_5",
            time_grouping="week",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.WEEKLY,
        )
        assert "GROUP BY ALL" in query

    def test_get_device_query_grid_filter_uses_site_id_subquery(self, bq_api):
        """filter_type="grid_ids" must extract measurements for devices whose
        site falls within the given grids — resolved via a grids_sites
        subquery on devices_table.site_id, not a literal device_id list."""
        query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["grid1", "grid2"],
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
            filter_type="grid_ids",
        )
        assert "site_id IN (" in query
        assert "grids_sites" in query
        assert "grid_id IN UNNEST(@filter_value)" in query
        # Must not fall back to the literal device_id filter
        assert "device_id IN UNNEST(@filter_value)" not in query

    def test_get_device_query_grid_filter_reuses_device_measurement_shape(self, bq_api):
        """The grid path must extract full device measurements — same
        pollutants/device-info/site-join shape as the default device_ids
        path — not just a bare device-id lookup."""
        grid_query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["grid1"],
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
            filter_type="grid_ids",
        )
        device_query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["d1"],
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        # Same pollutant/device-info projection and site-join wrapper — only
        # the filter condition should differ between the two call shapes.
        assert "SELECT pm2_5, timestamp" in grid_query
        assert "SELECT pm2_5, timestamp" in device_query
        assert grid_query.startswith("SELECT ") and "site_name" in grid_query
        assert device_query.startswith("SELECT ") and "site_name" in device_query

    def test_get_site_query_uses_unnest_parameter(self, bq_api):
        query = bq_api.get_site_query(
            table="project.dataset.table",
            filter_value=["site1", "site2"],
            pollutants_query="SELECT pm2_5, pm10",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "BETWEEN '2025-01-01' AND '2025-01-04'" in query
        assert "IN UNNEST(@filter_value)" in query
        assert "site_id" in query

    def test_get_location_query_uses_scalar_equality(self, bq_api):
        """Country/city filters compare with = @filter_value (scalar), not
        IN UNNEST (array) — the parameter type must match at execution too
        (see tests/test_bigquery_params.py::TestBuildFilterParameter)."""
        query = bq_api.get_location_query(
            table="project.dataset.satellite",
            filter_type="country",
            filter_value="uganda",
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "country = @filter_value" in query
        assert "UNNEST" not in query

    def test_get_location_query_rejects_invalid_filter_type(self, bq_api):
        with pytest.raises(ValueError, match="Invalid location filter"):
            bq_api.get_location_query(
                table="project.dataset.satellite",
                filter_type="device_id",
                filter_value="d1",
                pollutants_query="SELECT pm2_5",
                time_grouping="timestamp",
                start_date="2025-01-01",
                end_date="2025-01-04",
                frequency=Frequency.HOURLY,
            )

    def test_build_filter_query_routes_by_filter_type(self, bq_api):
        """build_filter_query must dispatch to the matching query builder for
        each supported filter_type."""
        device_q = bq_api.build_filter_query(
            table="project.dataset.table",
            filter_type="device_ids",
            filter_value=["d1"],
            pollutants_query="SELECT pm2_5",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "device_id" in device_q

        site_q = bq_api.build_filter_query(
            table="project.dataset.table",
            filter_type="sites",
            filter_value=["s1"],
            pollutants_query="SELECT pm2_5",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "site_id" in site_q

        location_q = bq_api.build_filter_query(
            table="project.dataset.table",
            filter_type="country",
            filter_value="uganda",
            pollutants_query="SELECT pm2_5",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "country = @filter_value" in location_q

        grid_q = bq_api.build_filter_query(
            table="project.dataset.table",
            filter_type="grid_ids",
            filter_value=["g1"],
            pollutants_query="SELECT pm2_5",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "grids_sites" in grid_q
        assert "site_id IN (" in grid_q

    def test_build_filter_query_rejects_unknown_filter_type(self, bq_api):
        with pytest.raises(ValueError, match="Invalid filter type"):
            bq_api.build_filter_query(
                table="project.dataset.table",
                filter_type="not_a_real_filter",
                filter_value="x",
                pollutants_query="SELECT pm2_5",
                start_date="2025-01-01",
                end_date="2025-01-04",
                frequency=Frequency.HOURLY,
            )


# ---------------------------------------------------------------------------
# Schema-driven column resolution (real schema JSON files)
# ---------------------------------------------------------------------------


class TestGetColumns:
    @pytest.fixture
    def measurements_table(self, bq_api) -> str:
        """A table key that resolves to schemas/files/measurements.json."""
        return next(
            k for k, v in bq_api.schema_mapping.items() if v == "measurements.json"
        )

    def test_get_columns_all_returns_full_schema(self, bq_api, measurements_table):
        columns = bq_api.get_columns(measurements_table)
        assert "pm2_5" in columns
        assert "site_id" in columns
        assert "timestamp" in columns

    def test_get_columns_filtered_by_float_type(self, bq_api, measurements_table):
        columns = bq_api.get_columns(measurements_table, [ColumnDataType.FLOAT])
        assert "pm2_5" in columns
        assert "site_id" not in columns  # STRING, filtered out
        assert "timestamp" not in columns  # TIMESTAMP, filtered out

    def test_get_columns_invalid_table_raises(self, bq_api):
        with pytest.raises(Exception, match="Invalid table"):
            bq_api.get_columns("not_a_configured_table")


# ---------------------------------------------------------------------------
# Pagination cursor helpers
# ---------------------------------------------------------------------------


class TestPaginationCursor:
    @staticmethod
    def _params(parameters):
        return {p.name: p.value for p in parameters}

    def test_apply_pagination_cursor_device_filter(self, bq_api):
        token = CursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        query, parameters = bq_api._apply_pagination_cursor(
            "SELECT * FROM table", "timestamp", token, "device_ids"
        )
        assert "timestamp > @cursor_timestamp" in query
        assert "device_id = @cursor_filter_value" in query
        assert self._params(parameters) == {
            "cursor_timestamp": "2025-01-01 00:00:00Z",
            "cursor_filter_value": "device1",
        }

    def test_apply_pagination_cursor_site_filter_includes_device_id(self, bq_api):
        """Site-filtered pagination must also pin device_id for multi-device
        sites, otherwise the cursor could skip/repeat rows within a site."""
        token = CursorUtils.create_cursor("2025-01-01 00:00:00Z", "site1", "device1")
        query, parameters = bq_api._apply_pagination_cursor(
            "SELECT * FROM table", "timestamp", token, "sites"
        )
        assert "site_id = @cursor_filter_value" in query
        assert "device_id = @cursor_device_id" in query
        assert self._params(parameters) == {
            "cursor_timestamp": "2025-01-01 00:00:00Z",
            "cursor_filter_value": "site1",
            "cursor_device_id": "device1",
        }

    def test_apply_pagination_cursor_invalid_token_raises(self, bq_api):
        with pytest.raises(ValueError, match="Invalid pagination cursor"):
            bq_api._apply_pagination_cursor(
                "SELECT * FROM table", "timestamp", "not-a-real-token!!", "device_ids"
            )

    def test_cursor_payload_never_reaches_sql_text(self, bq_api):
        """A cursor is client-supplied. Even a correctly signed one carrying
        SQL metacharacters must land in a bound parameter, never in the query
        text — this is the second layer behind the HMAC check."""
        payload = "2024-01-01' OR 1=1 OR '1'='1"
        token = CursorUtils.create_cursor(payload, "device1")

        query, parameters = bq_api._apply_pagination_cursor(
            "SELECT * FROM table", "timestamp", token, "device_ids"
        )

        assert "OR 1=1" not in query
        assert payload not in query
        assert self._params(parameters)["cursor_timestamp"] == payload

    def test_tampered_cursor_is_rejected(self, bq_api):
        """Flipping a byte of the payload must invalidate the signature."""
        token = CursorUtils.create_cursor("2025-01-01 00:00:00Z", "device1")
        payload_b64, _, signature = token.rpartition(".")
        forged = f"{payload_b64[:-4]}AAAA.{signature}"

        with pytest.raises(ValueError, match="Invalid pagination cursor"):
            bq_api._apply_pagination_cursor(
                "SELECT * FROM table", "timestamp", forged, "device_ids"
            )

    def test_unsigned_cursor_is_rejected(self, bq_api):
        """A hand-rolled base64 token (the pre-HMAC format) must not verify."""
        import base64

        payload = f"2025-01-01 00:00:00Z|device1|{int(time.time()) + 300}"
        unsigned = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")

        with pytest.raises(ValueError, match="Invalid pagination cursor"):
            bq_api._apply_pagination_cursor(
                "SELECT * FROM table", "timestamp", unsigned, "device_ids"
            )

    def test_generate_next_cursor_from_dataframe(self, bq_api):
        df = pd.DataFrame(
            {
                "timestamp": ["2025-01-04 00:00:00Z"],
                "site_id": ["site3"],
                "device_id": ["device3"],
            }
        )
        token = bq_api._generate_next_cursor(df, "timestamp", "sites")

        assert token is not None
        parsed = CursorUtils.parse_cursor(token)
        assert parsed["timestamp"] == "2025-01-04 00:00:00Z"
        assert parsed["filter_value"] == "site3"
        assert parsed["device_id"] == "device3"

    def test_generate_next_cursor_empty_dataframe_returns_none(self, bq_api):
        assert (
            bq_api._generate_next_cursor(pd.DataFrame(), "timestamp", "sites") is None
        )


# ---------------------------------------------------------------------------
# estimate_query_rows — table metadata + dry-run based pagination decision
# ---------------------------------------------------------------------------


class TestEstimateQueryRows:
    def test_paginate_true_when_estimate_exceeds_threshold(self, bq_api):
        bq_api.client = MagicMock()
        bq_api.client.query.return_value.total_bytes_processed = 100_000
        table_meta = MagicMock(num_rows=1000, num_bytes=50_000)
        bq_api.client.get_table.return_value = table_meta

        estimated, bytes_scanned, avg_size, paginate = bq_api.estimate_query_rows(
            "SELECT * FROM table", "project.dataset.table", row_threshold=1000
        )

        assert bytes_scanned == 100_000
        assert avg_size == 50
        assert estimated == 2000  # 100_000 / (50_000/1000)
        assert paginate is True

    def test_paginate_false_when_under_threshold(self, bq_api):
        bq_api.client = MagicMock()
        bq_api.client.query.return_value.total_bytes_processed = 100
        table_meta = MagicMock(num_rows=1000, num_bytes=50_000)
        bq_api.client.get_table.return_value = table_meta

        _, _, _, paginate = bq_api.estimate_query_rows(
            "SELECT * FROM table", "project.dataset.table", row_threshold=1000
        )
        assert paginate is False

    def test_zero_row_table_does_not_divide_by_zero(self, bq_api):
        bq_api.client = MagicMock()
        bq_api.client.query.return_value.total_bytes_processed = 100_000
        table_meta = MagicMock(num_rows=0, num_bytes=0)
        bq_api.client.get_table.return_value = table_meta

        estimated, _, avg_size, _ = bq_api.estimate_query_rows(
            "SELECT * FROM table", "project.dataset.table"
        )
        assert avg_size == 0
        assert estimated == 0


# ---------------------------------------------------------------------------
# Async delegation contract — AsyncBigQueryApi must inherit ALL filter types
# from BigQueryApi automatically (no query logic of its own to keep in sync)
# ---------------------------------------------------------------------------


class TestAsyncDelegationContract:
    @pytest.mark.asyncio
    async def test_query_data_async_supports_grid_filter(self, monkeypatch):
        """Regression: grid filtering was added only in BigQueryApi; the async
        path must pick it up through _query_data_sync's 1:1 delegation. If
        query logic is ever forked into AsyncBigQueryApi, this test's premise
        (sync-side changes are automatically async-visible) breaks loudly."""
        import pandas as pd
        from google.cloud import bigquery
        from api.models import bigquery_api as bq_mod
        from api.models.async_bigquery_api import AsyncBigQueryApi
        from constants import DataType

        captured = {}
        orig_init = bq_mod.BigQueryApi.__init__

        def patched_init(inner_self):
            orig_init(inner_self)
            client = MagicMock()

            def fake_query(query=None, job_config=None, **kw):
                captured["sql"] = query
                captured["params"] = job_config.query_parameters if job_config else None
                res = MagicMock()
                res.result.return_value.to_dataframe.return_value = pd.DataFrame()
                return res

            client.query.side_effect = fake_query
            inner_self.client = client

        monkeypatch.setattr(bq_mod.BigQueryApi, "__init__", patched_init)

        api = AsyncBigQueryApi()
        df, meta = await api.query_data_async(
            table="proj.ds.hourly",
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            device_category=DeviceCategory.LOWCOST,
            frequency=Frequency.HOURLY,
            data_type=DataType.CALIBRATED,
            columns=["pm2_5"],
            where_fields={"grid_ids": ["grid1", "grid2"]},
            dynamic_query=True,
        )

        assert "grids_sites" in captured["sql"]
        assert "grid_id IN UNNEST(@filter_value)" in captured["sql"]
        param = captured["params"][0]
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.values == ["grid1", "grid2"]
        assert df.empty
        assert meta["total_count"] == 0
