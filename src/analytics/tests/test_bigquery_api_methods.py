"""
Tests for api/models/bigquery_api.py query-building and pagination methods.

These exercise BigQueryApi against the real test settings (config via
tests/test_config.py) and the real schema JSON files under schemas/files/ —
no mocking of Config or the schema loader, since both are genuinely
lightweight and deterministic. Only the BigQuery client itself is mocked
(via the autouse `mock_bigquery_client` fixture in conftest.py), since that's
the actual network/credentials boundary.

Complements tests/test_bigquery_params.py, which covers query-parameter type
selection (`_build_filter_parameter`).
"""

from __future__ import annotations

import math
import re

import pandas as pd
import pytest

from api.models.bigquery_api import BigQueryApi
from api.utils.exceptions import CursorRejected
from constants import DataType, DeviceCategory, Frequency
from tests.paging_support import LOCATION, device_frame, payload_of
from tests.test_config import test_settings


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


class TestQueryText:
    def test_one_request_builds_one_query_text_in_every_process(self):
        """Two worker processes with different hash seeds build the same SQL
        for one request, so BigQuery serves the repeat from its cache and the
        columns of a CSV export keep one order."""
        import os
        import subprocess
        import sys
        import textwrap
        from pathlib import Path

        script = textwrap.dedent(
            """
            import os, sys
            from unittest.mock import MagicMock
            sys.path.insert(0, os.getcwd())
            import google.cloud.bigquery
            google.cloud.bigquery.Client = MagicMock
            from tests.test_config import test_settings
            import config
            config.settings = test_settings
            from api.models.bigquery_api import BigQueryApi
            from constants import DataType, DeviceCategory, Frequency
            api = BigQueryApi()
            start, end = "2026-03-01T00:00:00+00:00", "2026-03-02T00:00:00+00:00"
            devices = {"device_ids": ["dev_a"]}
            print(api.compose_query(
                test_settings.bigquery_raw_data, start, end, ["pm2_5", "pm10"],
                DataType.RAW, devices, DeviceCategory.LOWCOST,
            ))
            print(api.compose_dynamic_query(
                test_settings.bigquery_hourly_data, start, end, ["pm2_5", "pm10"],
                devices, DataType.CALIBRATED, Frequency.HOURLY,
                DeviceCategory.LOWCOST,
            ))
            """
        )
        queries = set()
        for seed in ("1", "2"):
            env = {
                **os.environ,
                "APP_ENV": "development",
                "PYTHONHASHSEED": seed,
                "PYTHONDONTWRITEBYTECODE": "1",
            }
            run = subprocess.run(
                [sys.executable, "-c", script],
                capture_output=True,
                text=True,
                env=env,
                cwd=Path(__file__).resolve().parents[1],
            )
            assert run.returncode == 0, run.stderr
            assert "pm2_5" in run.stdout and "temperature" in run.stdout
            queries.add(run.stdout)
        assert len(queries) == 1


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

    def test_get_device_query_cohort_filter_uses_devices_id_subquery(self, bq_api):
        """filter_type="cohort_ids" must extract measurements for the devices
        belonging to the given cohorts — resolved via a cohorts_devices
        subquery, not a literal device_id list.

        The join column differs from every other devices_devices join in the
        codebase: cohorts_devices.device_id holds the device's `id`, so the
        outer condition is devices_devices.id (not .device_id).  Grids join
        the other way round — grids_sites.site_id matches devices.site_id."""
        query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["cohort1", "cohort2"],
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
            filter_type="cohort_ids",
        )
        assert f"{bq_api.devices_table}.id IN (" in query
        assert "cohorts_devices" in query
        assert "cohort_id IN UNNEST(@filter_value)" in query
        # Must not fall back to the literal device_id filter
        assert "device_id IN UNNEST(@filter_value)" not in query

    def test_get_device_query_cohort_filter_reuses_device_measurement_shape(
        self, bq_api
    ):
        """The cohort path must extract full device measurements — same
        pollutants/device-info/site-join shape as the default device_ids and
        the grid paths — not just a bare device-id lookup."""
        cohort_query = bq_api.get_device_query(
            table="project.dataset.table",
            filter_value=["cohort1"],
            pollutants_query="SELECT pm2_5",
            time_grouping="timestamp",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
            filter_type="cohort_ids",
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
        assert "SELECT pm2_5, timestamp" in cohort_query
        assert cohort_query.startswith("SELECT ") and "site_name" in cohort_query
        # Only the filter condition may differ from the device_ids shape.
        assert (
            cohort_query.replace(
                f"{bq_api.devices_table}.id IN ("
                f"SELECT device_id FROM {bq_api.cohorts_devices_table} "
                f"WHERE cohort_id IN UNNEST(@filter_value)) ",
                f"{bq_api.devices_table}.device_id IN UNNEST(@filter_value) ",
            )
            == device_query
        )

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

        cohort_q = bq_api.build_filter_query(
            table="project.dataset.table",
            filter_type="cohort_ids",
            filter_value=["c1"],
            pollutants_query="SELECT pm2_5",
            start_date="2025-01-01",
            end_date="2025-01-04",
            frequency=Frequency.HOURLY,
        )
        assert "cohorts_devices" in cohort_q
        assert f"{bq_api.devices_table}.id IN (" in cohort_q


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


# ---------------------------------------------------------------------------
# Stored-result paging
#
# query_data runs one query for the first page and reads every later page
# from the stored result of that job by row offset.  The fake client in
# tests/paging_support.py stores each result and records every query, job
# lookup and read, so these tests prove the walk against that client.
# ---------------------------------------------------------------------------

REQUEST_HASH = "a" * 64
OTHER_HASH = "b" * 64


def _request(**overrides) -> dict:
    """Build the keyword arguments of one data-download request at hourly frequency."""
    request = dict(
        table=test_settings.bigquery_hourly_data,
        start_date_time="2026-03-01T00:00:00+00:00",
        end_date_time="2026-03-02T00:00:00+00:00",
        device_category=DeviceCategory.LOWCOST,
        frequency=Frequency.HOURLY,
        data_type=DataType.CALIBRATED,
        columns=["pm2_5"],
        where_fields={"device_ids": ["dev_a", "dev_b"]},
        dynamic_query=True,
        cursor_binding=REQUEST_HASH,
    )
    request.update(overrides)
    return request


def _walk(api: BigQueryApi, request: dict, max_pages: int = 20):
    """Follow metadata.next from the first page and return the pages with their metadata."""
    pages, metas = [], []
    cursor = None
    for _ in range(max_pages):
        page, meta = api.query_data(cursor_token=cursor, **request)
        pages.append(page)
        metas.append(meta)
        if not meta["has_more"]:
            return pages, metas
        cursor = meta["next"]
    raise AssertionError("the walk did not end within the page cap")


def _follow(api: BigQueryApi, request: dict, meta: dict, max_pages: int = 20):
    """Follow metadata.next from ``meta`` and return the later pages."""
    pages = []
    for _ in range(max_pages):
        if not meta["has_more"]:
            return pages
        page, meta = api.query_data(cursor_token=meta["next"], **request)
        pages.append(page)
    raise AssertionError("the walk did not end within the page cap")


@pytest.fixture
def paging_api(fake_bigquery) -> BigQueryApi:
    """Build a BigQueryApi after the fixture installs the fake client."""
    return BigQueryApi()


class TestStoredResultPaging:
    @pytest.mark.parametrize("rows", [7, 4])
    def test_walk_returns_every_row_once_in_order(
        self, fake_bigquery, small_pages, cursor_clock, paging_api, rows
    ):
        fake_bigquery.result_frame = device_frame(rows)
        pages, _ = _walk(paging_api, _request())
        pd.testing.assert_frame_equal(
            pd.concat(pages, ignore_index=True), device_frame(rows)
        )
        assert len(pages) == math.ceil(rows / small_pages)
        assert all(len(page) <= small_pages for page in pages)

    def test_later_pages_read_the_stored_result_of_the_first_query(
        self, fake_bigquery, small_pages, cursor_clock, paging_api
    ):
        fake_bigquery.result_frame = device_frame(7)
        first_page, meta = paging_api.query_data(**_request())
        job_id = payload_of(meta["next"])["job_id"]
        # The rows of any new query differ from the stored rows.
        fake_bigquery.result_frame = device_frame(2)
        pages = [first_page] + _follow(paging_api, _request(), meta)
        pd.testing.assert_frame_equal(
            pd.concat(pages, ignore_index=True), device_frame(7)
        )
        assert [lookup.job_id for lookup in fake_bigquery.job_lookups] == [job_id] * 2
        assert all(lookup.location == LOCATION for lookup in fake_bigquery.job_lookups)

    def test_cursor_offsets_advance_by_the_page_size(
        self, fake_bigquery, small_pages, cursor_clock, paging_api
    ):
        fake_bigquery.result_frame = device_frame(7)
        _, metas = _walk(paging_api, _request())
        assert [payload_of(meta["next"])["offset"] for meta in metas[:-1]] == [3, 6]
        assert [read.start_index for read in fake_bigquery.reads] == [0, 3, 6]

    @pytest.mark.parametrize("rows, pages", [(3, 1), (6, 2)])
    def test_result_of_whole_pages_ends_without_an_empty_page(
        self, fake_bigquery, small_pages, cursor_clock, paging_api, rows, pages
    ):
        fake_bigquery.result_frame = device_frame(rows)
        walked, metas = _walk(paging_api, _request())
        assert len(walked) == pages
        assert metas[-1]["next"] is None
        assert all(len(page) == small_pages for page in walked)

    def test_first_query_keeps_its_order_and_has_no_limit(
        self, fake_bigquery, cursor_clock, paging_api
    ):
        from google.cloud import bigquery

        fake_bigquery.result_frame = device_frame(2)
        paging_api.query_data(**_request())
        sent = fake_bigquery.queries[0]
        assert re.search(r"\border by\b", sent.sql, re.IGNORECASE)
        assert re.search(r"\blimit\s+\d+", sent.sql, re.IGNORECASE) is None
        (param,) = sent.job_config.query_parameters
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.values == ["dev_a", "dev_b"]

    def test_the_same_cursor_returns_the_same_page(
        self, fake_bigquery, small_pages, cursor_clock, paging_api
    ):
        fake_bigquery.result_frame = device_frame(7)
        _, meta = paging_api.query_data(**_request())
        first, _ = paging_api.query_data(cursor_token=meta["next"], **_request())
        again, _ = paging_api.query_data(cursor_token=meta["next"], **_request())
        pd.testing.assert_frame_equal(first, again)

    def test_a_page_size_change_between_pages_keeps_every_row_once(
        self, fake_bigquery, small_pages, cursor_clock, paging_api, monkeypatch
    ):
        fake_bigquery.result_frame = device_frame(7)
        first_page, meta = paging_api.query_data(**_request())
        monkeypatch.setattr(test_settings, "data_export_limit", 2)
        pages = [first_page] + _follow(paging_api, _request(), meta)
        pd.testing.assert_frame_equal(
            pd.concat(pages, ignore_index=True), device_frame(7)
        )
        assert [len(page) for page in pages] == [3, 2, 2]

    def test_a_cursor_of_another_request_is_rejected_without_a_bigquery_call(
        self, fake_bigquery, small_pages, cursor_clock, paging_api
    ):
        fake_bigquery.result_frame = device_frame(7)
        _, meta = paging_api.query_data(**_request())
        with pytest.raises(CursorRejected):
            paging_api.query_data(
                cursor_token=meta["next"], **_request(cursor_binding=OTHER_HASH)
            )
        assert fake_bigquery.job_lookups == []
        assert len(fake_bigquery.reads) == 1

    def test_whole_result_returns_every_row_in_one_frame(
        self, fake_bigquery, small_pages, cursor_clock, paging_api
    ):
        fake_bigquery.result_frame = device_frame(7)
        frame, meta = paging_api.query_data(whole_result=True, **_request())
        pd.testing.assert_frame_equal(frame, device_frame(7))
        assert meta == {"total_count": 7, "has_more": False, "next": None}
        assert len(fake_bigquery.queries) == 1
        assert fake_bigquery.reads[0].bqstorage is False


# ---------------------------------------------------------------------------
# Async delegation contract — AsyncBigQueryApi must inherit ALL filter types
# from BigQueryApi automatically (no query logic of its own to keep in sync)
# ---------------------------------------------------------------------------


class TestAsyncDelegationContract:
    @pytest.mark.asyncio
    async def test_query_data_async_supports_grid_filter(self, fake_bigquery):
        """Regression: grid filtering was added only in BigQueryApi; the async
        path must pick it up through _query_data_sync's 1:1 delegation. If
        query logic is ever forked into AsyncBigQueryApi, this test's premise
        (sync-side changes are automatically async-visible) breaks loudly."""
        from google.cloud import bigquery
        from api.models.async_bigquery_api import AsyncBigQueryApi

        api = AsyncBigQueryApi()
        df, meta = await api.query_data_async(
            table="proj.ds.hourly",
            start_date_time="2026-01-01",
            end_date_time="2026-01-02",
            device_category=DeviceCategory.LOWCOST,
            frequency=Frequency.HOURLY,
            data_type=DataType.CALIBRATED,
            columns=["pm2_5"],
            where_fields={"grid_ids": ["grid1", "grid2"]},
            dynamic_query=True,
            cursor_binding=REQUEST_HASH,
        )

        sent = fake_bigquery.queries[0]
        assert "grids_sites" in sent.sql
        assert "grid_id IN UNNEST(@filter_value)" in sent.sql
        param = sent.job_config.query_parameters[0]
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.values == ["grid1", "grid2"]
        assert df.empty
        assert meta["total_count"] == 0

    @pytest.mark.asyncio
    async def test_query_data_async_supports_cohort_filter(self, fake_bigquery):
        """Same contract as the grid test above, for the cohort filter: it is
        defined only in BigQueryApi.get_device_query and must reach the async
        path — every request the API serves goes through query_data_async."""
        from google.cloud import bigquery
        from api.models.async_bigquery_api import AsyncBigQueryApi

        api = AsyncBigQueryApi()
        df, meta = await api.query_data_async(
            table="proj.ds.hourly",
            start_date_time="2026-01-01",
            end_date_time="2026-01-02",
            device_category=DeviceCategory.LOWCOST,
            frequency=Frequency.HOURLY,
            data_type=DataType.CALIBRATED,
            columns=["pm2_5"],
            where_fields={"cohort_ids": ["cohort1"]},
            dynamic_query=True,
            cursor_binding=REQUEST_HASH,
        )

        sent = fake_bigquery.queries[0]
        assert "cohorts_devices" in sent.sql
        assert "cohort_id IN UNNEST(@filter_value)" in sent.sql
        param = sent.job_config.query_parameters[0]
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.values == ["cohort1"]
        assert df.empty
        assert meta["total_count"] == 0

    @pytest.mark.asyncio
    async def test_pagination_orders_grid_and_cohort_by_device_id(self, fake_bigquery):
        """Grids and cohorts resolve to devices, so both order the stored
        result by device_id.  A filter type missing from FILTER_FIELD_MAPPING
        would interpolate the literal "None" into the ORDER BY, and BigQuery
        would reject the query."""
        from api.models.async_bigquery_api import AsyncBigQueryApi

        for filter_type, filter_value in (
            ("grid_ids", ["g1"]),
            ("cohort_ids", ["c1"]),
        ):
            api = AsyncBigQueryApi()
            await api.query_data_async(
                table="proj.ds.hourly",
                start_date_time="2026-01-01",
                end_date_time="2026-01-02",
                device_category=DeviceCategory.LOWCOST,
                frequency=Frequency.HOURLY,
                data_type=DataType.CALIBRATED,
                columns=["pm2_5"],
                where_fields={filter_type: filter_value},
                dynamic_query=True,
                cursor_binding=REQUEST_HASH,
            )
            sql = fake_bigquery.queries[-1].sql
            assert "order by timestamp, device_id" in sql, filter_type
            assert "None" not in sql, filter_type
            assert re.search(r"\blimit\s+\d+", sql, re.IGNORECASE) is None, filter_type


# ---------------------------------------------------------------------------
# raw-data / data-download / chart filter parity
#
#   export_raw_data -> _run_export(dynamic_query=False) -> compose_query
#   export_data     -> _run_export(dynamic_query=True)  -> compose_dynamic_query
#   get_chart_data  -> query_data_async(dynamic_query=True)
#                                       -> compose_dynamic_query
#
# The two compose_* entry points differ only in how pollutant columns are
# projected (raw columns vs rounded/averaged ones); both delegate filtering to
# build_filter_query.  grid_ids and cohort_ids were added after the original
# device/site filters, so these tests pin the parity: a filter type cannot be
# wired into one request path and silently missed on the others.
# ---------------------------------------------------------------------------


class TestFilterParityAcrossRequestPaths:
    def _raw_sql(self, bq_api, filter_type, filter_value):
        """The raw-data path: _run_export(dynamic_query=False)."""
        return bq_api.compose_query(
            table="proj.ds.raw_measurements",
            start_date_time="2025-01-01",
            end_date_time="2025-01-02",
            pollutants=["pm2_5"],
            data_type=DataType.RAW,
            data_filter={filter_type: filter_value},
            device_category=DeviceCategory.LOWCOST,
        )

    def _dynamic_sql(self, bq_api, filter_type, filter_value, frequency):
        """The data-download and chart paths: dynamic_query=True."""
        return bq_api.compose_dynamic_query(
            "proj.ds.hourly_measurements",
            "2025-01-01",
            "2025-01-02",
            pollutants=["pm2_5"],
            data_filter={filter_type: filter_value},
            data_type=DataType.CALIBRATED,
            frequency=frequency,
            device_category=DeviceCategory.LOWCOST,
        )

    def _filter_condition(self, bq_api, sql):
        """The `AND <condition>` the filter type contributes to the WHERE."""
        marker = "AND "
        assert marker in sql
        return sql.split(marker, 1)[1]

    @pytest.mark.parametrize(
        "filter_type,filter_value",
        [
            ("device_ids", ["d1", "d2"]),
            ("sites", ["s1"]),
            ("grid_ids", ["g1"]),
            ("cohort_ids", ["c1"]),
        ],
    )
    def test_raw_and_download_apply_the_same_filter(
        self, bq_api, filter_type, filter_value
    ):
        """Every filter type must narrow raw-data and data-download to the
        same devices — the only intended difference between the paths is the
        pollutant projection, never who the data is about."""
        raw = self._filter_condition(
            bq_api, self._raw_sql(bq_api, filter_type, filter_value)
        )
        download = self._filter_condition(
            bq_api,
            self._dynamic_sql(bq_api, filter_type, filter_value, Frequency.HOURLY),
        )
        assert raw == download

    def test_every_schema_filter_key_is_queryable(self, bq_api):
        """The request schema and the query builder must agree on the filter
        vocabulary: a key accepted by BaseFilterRequest but unknown to
        build_filter_query passes validation and then 500s at query time."""
        from api.schemas.requests import _FILTER_KEYS

        for filter_type in _FILTER_KEYS:
            sql = self._dynamic_sql(bq_api, filter_type, ["x1"], Frequency.HOURLY)
            assert "@filter_value" in sql, filter_type
