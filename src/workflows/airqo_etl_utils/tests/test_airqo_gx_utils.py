from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

import airqo_etl_utils.airqo_gx_utils as gx_utils
from airqo_etl_utils.airqo_gx_expectations import AirQoGxExpectations

pytest.importorskip("great_expectations.checkpoint")

RESULT_COLUMNS = {
    "run_name",
    "run_time",
    "run_result",
    "data_source",
    "data_asset",
    "column_name",
    "checkpoint_name",
    "expectation_suite",
    "expectation_type",
    "expectation_result",
    "raised_exception",
    "sample_space",
    "unexpected_count",
    "unexpected_percentage",
    "partial_unexpected_list",
    "missing_count",
    "missing_percent",
    "unexpected_percent_total",
    "unexpected_percent_nonmissing",
    "partial_unexpected_counts",
}


@pytest.fixture
def raw_low_cost_data():
    """Raw low cost readings with one empty sensor value and one PM2.5 value above the range."""
    return pd.DataFrame(
        {
            "timestamp": pd.to_datetime(
                [
                    "2026-03-02T10:00:00Z",
                    "2026-03-02T10:10:00Z",
                    "2026-03-02T10:20:00Z",
                ]
            ),
            "device_id": ["aq_1", "aq_1", "aq_2"],
            "s1_pm2_5": [10.0, None, 30.0],
            "s2_pm2_5": [11.0, 21.0, 31.0],
            "s1_pm10": [15.0, 25.0, 35.0],
            "s2_pm10": [16.0, 26.0, 36.0],
            "pm2_5": [10.5, 21.0, 1500.0],
            "pm10": [15.5, 25.5, 35.5],
        }
    )


def project_files():
    """Files of the Great Expectations project folder that sits beside the package."""
    project = Path(gx_utils.__file__).resolve().parents[1] / "include" / "gx"
    return sorted(path for path in project.rglob("*") if path.is_file())


@pytest.fixture
def production_run(raw_low_cost_data, monkeypatch):
    """Runs the raw low cost check in the production environment with BigQuery mocked."""
    monkeypatch.setattr(gx_utils.configuration, "ENVIRONMENT", "production")
    client = MagicMock()
    client.insert_rows_json.return_value = []
    files_before = project_files()
    with patch.object(gx_utils.bigquery, "Client", return_value=client):
        AirQoGxExpectations.from_pandas().pm2_5_low_cost_sensor_raw_data(
            raw_low_cost_data
        )
    return {
        "rows": client.insert_rows_json.call_args[0][1],
        "files_before": files_before,
        "files_after": project_files(),
    }


@pytest.fixture
def stored_rows(production_run):
    """Rows the raw low cost check sends to BigQuery."""
    return production_run["rows"]


def row_for(rows, column, expectation_type):
    return next(
        row
        for row in rows
        if row["column_name"] == column and row["expectation_type"] == expectation_type
    )


class TestAirQoGxRawLowCostCheck:
    def test_each_expectation_yields_one_row_with_the_result_columns(self, stored_rows):
        assert len(stored_rows) == 8
        assert all(set(row) == RESULT_COLUMNS for row in stored_rows)

    def test_value_outside_the_range_fails_the_expectation(self, stored_rows):
        row = row_for(stored_rows, "pm2_5", "expect_column_values_to_be_between")
        assert row["expectation_result"] is False
        assert row["sample_space"] == 3
        assert row["unexpected_count"] == 1

    def test_empty_value_fails_the_not_null_expectation(self, stored_rows):
        row = row_for(stored_rows, "s1_pm2_5", "expect_column_values_to_not_be_null")
        assert row["expectation_result"] is False
        assert row["unexpected_count"] == 1

    def test_complete_column_passes_the_not_null_expectation(self, stored_rows):
        row = row_for(stored_rows, "s2_pm2_5", "expect_column_values_to_not_be_null")
        assert row["expectation_result"] is True
        assert row["unexpected_count"] == 0

    def test_production_environment_writes_no_project_files(self, production_run):
        assert production_run["rows"]
        assert production_run["files_after"] == production_run["files_before"]
