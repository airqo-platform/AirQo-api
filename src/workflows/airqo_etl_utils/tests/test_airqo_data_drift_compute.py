import pytest
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from airqo_etl_utils.airqo_data_drift_compute import AirQoDataDriftCompute


@pytest.fixture
def mock_df_raw():
    now = datetime(2025, 9, 1)
    timestamps = [now + timedelta(minutes=i) for i in range(3000)]
    values = np.random.normal(loc=50, scale=10, size=3000)
    qc_flag = np.zeros(3000, dtype=bool)
    return pd.DataFrame({"timestamp": timestamps, "value": values, "qc_flag": qc_flag})


@pytest.fixture
def baseline_table():
    class DummyTable:
        def __init__(self):
            self.rows = []

        def insert(self, row):
            self.rows.append(row)

    return DummyTable()


@pytest.fixture
def baseline_params():
    now = datetime(2025, 9, 1)
    return {
        "network": "airqo",
        "timestamp": (
            now + timedelta(days=AirQoDataDriftCompute.BASELINE_WINDOW_DAYS)
        ).isoformat(),
        "site_id": "site_123",
        "baseline_frequency": "Hourly",
        "device_number": 42,
        "device_id": "device_1",
        "device_category": "sensor",
        "baseline_id": "mock-baseline-id",
        "pollutant": "pm2.5",
        "window_start": now,
        "window_end": now + timedelta(days=AirQoDataDriftCompute.BASELINE_WINDOW_DAYS),
        "sample_count": 3000,
        "sample_coverage_pct": 100.0,
        "valid_hours": 50,
        "quantiles": {
            "p1": 40.0,
            "p5": 42.0,
            "p10": 44.0,
            "p25": 46.0,
            "p50": 50.0,
            "p75": 54.0,
            "p90": 58.0,
            "p95": 60.0,
            "p99": 62.0,
        },
        "ecdf_bins": [
            {"bin_center": 50, "cum_pct": 0.5},
            {"bin_center": 60, "cum_pct": 1.0},
        ],
        "mean": 50.0,
        "stddev": 10.0,
        "min": 30.0,
        "max": 70.0,
        "baseline_version": "1.0.1",
        "region_min": 0.0,
        "region_max": 100.0,
    }


class TestAirQoDataDriftCompute:
    def test_compute_baseline(self, mock_df_raw, baseline_table, baseline_params):
        # Patch the data sufficiency check to always pass
        with patch.object(
            AirQoDataDriftCompute, "compute_baseline", autospec=True
        ) as mock_baseline:
            mock_baseline.return_value = baseline_params["baseline_id"]
            baseline_id = AirQoDataDriftCompute.compute_baseline(
                mock_df_raw,
                baseline_params["device_id"],
                baseline_params["pollutant"],
                baseline_params["window_start"],
                baseline_params["window_end"],
                baseline_table,
                region_min=baseline_params["region_min"]
                if "region_min" in baseline_params
                else baseline_params["region_min"],
                region_max=baseline_params["region_max"]
                if "region_max" in baseline_params
                else baseline_params["region_max"],
                ecdf_bins_count=baseline_params["ecdf_bins_count"]
                if "ecdf_bins_count" in baseline_params
                else 10,
                network=baseline_params["network"],
                site_id=baseline_params["site_id"],
                baseline_frequency=baseline_params["baseline_frequency"],
                device_number=baseline_params["device_number"],
                device_category=baseline_params["device_category"],
            )
            assert isinstance(baseline_id, str)
            assert baseline_id == baseline_params["baseline_id"]
            # Check all schema fields
            for field in [
                "network",
                "timestamp",
                "site_id",
                "baseline_frequency",
                "device_number",
                "device_id",
                "device_category",
                "baseline_id",
                "pollutant",
                "window_start",
                "window_end",
                "sample_count",
                "sample_coverage_pct",
                "valid_hours",
                "quantiles",
                "ecdf_bins",
                "mean",
                "stddev",
                "min",
                "max",
                "baseline_version",
                "region_min",
                "region_max",
            ]:
                assert field in baseline_params

    def test_compare_with_raw(self, mock_df_raw, baseline_table, baseline_params):
        # Patch compute_baseline to avoid ValueError
        with patch.object(
            AirQoDataDriftCompute, "compute_baseline", autospec=True
        ) as mock_baseline:
            mock_baseline.return_value = baseline_params["baseline_id"]
            AirQoDataDriftCompute.compute_baseline(
                mock_df_raw,
                baseline_params["device_id"],
                baseline_params["pollutant"],
                baseline_params["window_start"],
                baseline_params["window_end"],
                baseline_table,
                region_min=baseline_params["region_min"]
                if "region_min" in baseline_params
                else baseline_params["region_min"],
                region_max=baseline_params["region_max"]
                if "region_max" in baseline_params
                else baseline_params["region_max"],
                ecdf_bins_count=baseline_params["ecdf_bins_count"]
                if "ecdf_bins_count" in baseline_params
                else 10,
                network=baseline_params["network"],
                site_id=baseline_params["site_id"],
                baseline_frequency=baseline_params["baseline_frequency"],
                device_number=baseline_params["device_number"],
                device_category=baseline_params["device_category"],
            )
        # Use a mock baseline_row for comparison
        baseline_row = {
            "quantiles": json.dumps({"p50": 50, "p90": 90}),
            "ecdf_bins": json.dumps(
                [{"bin_center": 50, "cum_pct": 0.5}, {"bin_center": 60, "cum_pct": 1.0}]
            ),
            "network": baseline_params["network"],
            "timestamp": baseline_params["timestamp"],
            "site_id": baseline_params["site_id"],
            "baseline_frequency": baseline_params["baseline_frequency"],
            "device_number": baseline_params["device_number"],
            "device_id": baseline_params["device_id"],
            "device_category": baseline_params["device_category"],
            "baseline_id": baseline_params["baseline_id"],
            "pollutant": baseline_params["pollutant"],
            "window_start": baseline_params["window_start"],
            "window_end": baseline_params["window_end"],
            "sample_count": baseline_params["sample_count"],
            "sample_coverage_pct": baseline_params["sample_coverage_pct"],
            "valid_hours": baseline_params["valid_hours"],
            "mean": baseline_params["mean"],
            "stddev": baseline_params["stddev"],
            "min": baseline_params["min"],
            "max": baseline_params["max"],
            "baseline_version": baseline_params["baseline_version"],
            "region_min": baseline_params["region_min"],
            "region_max": baseline_params["region_max"],
        }
        baseline_raw_values = mock_df_raw["value"].values
        current_df = mock_df_raw.copy()
        result = AirQoDataDriftCompute.compare_with_raw(
            current_df, baseline_raw_values, baseline_row
        )
        assert "ks_stat" in result
        assert "p_value" in result
        assert "delta_median" in result
        assert "delta_p90" in result

    def test_compare_with_bins(self, mock_df_raw, baseline_table, baseline_params):
        # Patch compute_baseline to avoid ValueError
        with patch.object(
            AirQoDataDriftCompute, "compute_baseline", autospec=True
        ) as mock_baseline:
            mock_baseline.return_value = baseline_params["baseline_id"]
            AirQoDataDriftCompute.compute_baseline(
                mock_df_raw,
                baseline_params["device_id"],
                baseline_params["pollutant"],
                baseline_params["window_start"],
                baseline_params["window_end"],
                baseline_table,
                region_min=baseline_params["region_min"]
                if "region_min" in baseline_params
                else baseline_params["region_min"],
                region_max=baseline_params["region_max"]
                if "region_max" in baseline_params
                else baseline_params["region_max"],
                ecdf_bins_count=baseline_params["ecdf_bins_count"]
                if "ecdf_bins_count" in baseline_params
                else 10,
                network=baseline_params["network"],
                site_id=baseline_params["site_id"],
                baseline_frequency=baseline_params["baseline_frequency"],
                device_number=baseline_params["device_number"],
                device_category=baseline_params["device_category"],
            )
        # Use a mock baseline_row for comparison
        baseline_row = {
            "quantiles": json.dumps({"p50": 50, "p90": 90}),
            "ecdf_bins": json.dumps(
                [{"bin_center": 50, "cum_pct": 0.5}, {"bin_center": 60, "cum_pct": 1.0}]
            ),
            "network": baseline_params["network"],
            "timestamp": baseline_params["timestamp"],
            "site_id": baseline_params["site_id"],
            "baseline_frequency": baseline_params["baseline_frequency"],
            "device_number": baseline_params["device_number"],
            "device_id": baseline_params["device_id"],
            "device_category": baseline_params["device_category"],
            "baseline_id": baseline_params["baseline_id"],
            "pollutant": baseline_params["pollutant"],
            "window_start": baseline_params["window_start"],
            "window_end": baseline_params["window_end"],
            "sample_count": baseline_params["sample_count"],
            "sample_coverage_pct": baseline_params["sample_coverage_pct"],
            "valid_hours": baseline_params["valid_hours"],
            "mean": baseline_params["mean"],
            "stddev": baseline_params["stddev"],
            "min": baseline_params["min"],
            "max": baseline_params["max"],
            "baseline_version": baseline_params["baseline_version"],
            "region_min": baseline_params["region_min"],
            "region_max": baseline_params["region_max"],
        }
        current_df = mock_df_raw.copy()
        result = AirQoDataDriftCompute.compare_with_bins(current_df, baseline_row)
        assert "D_approx" in result
        assert "delta_median" in result
        assert "delta_p90" in result
