"""
Tests for BigQuery query-parameter binding.

`_build_filter_parameter` is a staticmethod, so these tests exercise it
directly without constructing a BigQuery client.
"""

from __future__ import annotations

from google.cloud import bigquery

from api.models.bigquery_api import BigQueryApi


class TestBuildFilterParameter:
    def test_list_filter_binds_array_parameter(self):
        """Site/device filters use IN UNNEST(@filter_value) → array param."""
        param = BigQueryApi._build_filter_parameter(["site1", "site2"])
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.name == "filter_value"
        assert param.array_type == "STRING"
        assert param.values == ["site1", "site2"]

    def test_tuple_filter_binds_array_parameter(self):
        param = BigQueryApi._build_filter_parameter(("d1", "d2"))
        assert isinstance(param, bigquery.ArrayQueryParameter)
        assert param.values == ["d1", "d2"]

    def test_scalar_filter_binds_scalar_parameter(self):
        """Country/city filters use = @filter_value → scalar param.

        Regression: a scalar string must NOT be wrapped in an
        ArrayQueryParameter (which would iterate it into characters).
        """
        param = BigQueryApi._build_filter_parameter("uganda")
        assert isinstance(param, bigquery.ScalarQueryParameter)
        assert param.name == "filter_value"
        assert param.value == "uganda"
        # Must not have been split into characters
        assert not isinstance(param, bigquery.ArrayQueryParameter)
