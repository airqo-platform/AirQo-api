import pytest
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
from airqo_etl_utils.airqo_data_drift_compute import AirQoDataDriftCompute
from airqo_etl_utils.constants import DataType, Frequency


@pytest.fixture
def mock_df_raw():
    now = datetime(2025, 9, 1)
    timestamps = [now + timedelta(minutes=i) for i in range(3000)]
    pm2_values = np.random.normal(loc=30, scale=5, size=3000)
    network = ["airqo"] * 3000
    device_number = [42] * 3000
    site_id = ["site_123"] * 3000
    device_id = ["device_1"] * 3000
    device_category = ["sensor"] * 3000
    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "device_id": device_id,
            "pm2_5": pm2_values,
            "network": network,
            "device_number": device_number,
            "device_category": device_category,
            "site_id": site_id,
        }
    )


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
        "baseline_resolution": "Hourly",
        "device_number": 42,
        "device_id": "device_1",
        "device_category": "lowcost",
        "baseline_id": "mock-baseline-id",
        "pollutant": "pm2_5",
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
        "minimum": 30.0,
        "maximum": 70.0,
        "baseline_version": "1.0.1",
        "site_minimum": 0.0,
        "site_maximum": 100.0,
        "ecdf_bins_count": 100,
    }


class TestAirQoDataDriftCompute:
    def test_compute_baseline_success(self, mock_df_raw, baseline_params):
        """Test successful computation of baseline with valid data."""
        device = {
            "device_id": baseline_params["device_id"],
            "site_id": baseline_params["site_id"],
            "recent_maintenance_date": baseline_params["window_start"]
            + timedelta(hours=60),
            "minimum": baseline_params["site_minimum"],
            "maximum": baseline_params["site_maximum"],
            "average": baseline_params["mean"],
        }
        pollutants = [baseline_params["pollutant"]]

        result = AirQoDataDriftCompute.compute_baseline(
            data_type=DataType.AVERAGED,
            data=mock_df_raw,
            device=device,
            pollutants=pollutants,
            resolution=Frequency.WEEKLY,
            window_start=baseline_params["window_start"],
            window_end=baseline_params["window_end"],
            region_min=baseline_params.get("site_minimum", 0),
            region_max=baseline_params.get("site_maximum", 1000),
            ecdf_bins_count=baseline_params.get("ecdf_bins_count", 100),
        )

        # Assertions for the returned list of dicts
        assert isinstance(result, list)
        assert len(result) == len(pollutants)
        for baseline_row in result:
            assert isinstance(baseline_row, dict)
            # Check required fields
            required_fields = [
                "network",
                "timestamp",
                "device_id",
                "site_id",
                "data_type",
                "baseline_resolution",
                "device_number",
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
                "minimum",
                "maximum",
                "baseline_version",
                "site_minimum",
                "site_maximum",
            ]
            for field in required_fields:
                assert field in baseline_row
            assert isinstance(baseline_row["quantiles"], list)
            assert len(baseline_row["quantiles"]) == 9  # p1 to p99
            assert isinstance(baseline_row["ecdf_bins"], list)
            assert all(
                isinstance(bin_data, dict) for bin_data in baseline_row["ecdf_bins"]
            )

    def test_compute_baseline_insufficient_data(self, mock_df_raw, baseline_params):
        """Test failure due to insufficient data."""
        device = {
            "device_id": baseline_params["device_id"],
            "site_id": baseline_params["site_id"],
            "recent_maintenance_date": baseline_params["window_start"]
            + timedelta(hours=60),
        }
        pollutants = [baseline_params["pollutant"]]

        # Create small data to trigger insufficient data error
        small_data = mock_df_raw.head(10)

        with pytest.raises(ValueError, match="Insufficient data for baseline"):
            AirQoDataDriftCompute.compute_baseline(
                data_type=DataType.AVERAGED,
                data=small_data,
                device=device,
                pollutants=pollutants,
                resolution=Frequency.WEEKLY,
                window_start=baseline_params["window_start"],
                window_end=baseline_params["window_end"],
            )

    def test_compute_baseline_maintenance_cooldown_violation(
        self, mock_df_raw, baseline_params
    ):
        """Test failure due to maintenance cooldown violation."""
        device = {
            "device_id": baseline_params["device_id"],
            "site_id": baseline_params["site_id"],
            "recent_maintenance_date": baseline_params["window_start"]
            + timedelta(hours=10),
        }
        pollutants = [baseline_params["pollutant"]]

        with pytest.raises(
            ValueError,
            match="All data should be before or after maintenance cooldown period",
        ):
            AirQoDataDriftCompute.compute_baseline(
                data_type=DataType.AVERAGED,
                data=mock_df_raw,
                device=device,
                pollutants=pollutants,
                resolution=Frequency.WEEKLY,
                window_start=baseline_params["window_start"],
                window_end=baseline_params["window_end"],
            )

    def test_compute_baseline_maintenance_cooldown_boundary(
        self, mock_df_raw, baseline_params
    ):
        """Test boundary case for maintenance cooldown (dates very close to the threshold)."""
        pollutants = [baseline_params["pollutant"]]

        # Test case 1: Maintenance date just outside cooldown (should pass)
        device_pass = {
            "device_id": baseline_params["device_id"],
            "site_id": baseline_params["site_id"],
            "recent_maintenance_date": baseline_params["window_start"]
            + timedelta(hours=49),
        }
        result = AirQoDataDriftCompute.compute_baseline(
            data_type=DataType.AVERAGED,
            data=mock_df_raw,
            device=device_pass,
            pollutants=pollutants,
            resolution=Frequency.WEEKLY,
            window_start=baseline_params["window_start"],
            window_end=baseline_params["window_end"],
        )
        assert isinstance(result, list)  # Should succeed

        # Test case 2: Maintenance date just inside cooldown (should fail)
        device_fail = {
            "device_id": baseline_params["device_id"],
            "site_id": baseline_params["site_id"],
            "recent_maintenance_date": baseline_params["window_start"]
            + timedelta(hours=47),
        }
        with pytest.raises(
            ValueError,
            match="All data should be before or after maintenance cooldown period",
        ):
            AirQoDataDriftCompute.compute_baseline(
                data_type=DataType.AVERAGED,
                data=mock_df_raw,
                device=device_fail,
                pollutants=pollutants,
                resolution=Frequency.WEEKLY,
                window_start=baseline_params["window_start"],
                window_end=baseline_params["window_end"],
            )

    def test_compute_baseline_empty_data(self):
        """Test handling of empty data."""
        device = {
            "device_id": "test_device",
            "site_id": "test_site",
            "recent_maintenance_date": datetime(2025, 1, 1),
        }
        pollutants = ["pm2_5"]

        result = AirQoDataDriftCompute.compute_baseline(
            data_type=DataType.AVERAGED,
            data=pd.DataFrame(),  # Empty data
            device=device,
            pollutants=pollutants,
            resolution=Frequency.WEEKLY,
            window_start=datetime(2025, 1, 1),
            window_end=datetime(2025, 1, 8),
        )

        assert result is None

    def test_compare_with_raw(self, mock_df_raw, baseline_table, baseline_params):
        baseline_row = {
            "quantiles": [("p50", 50.0), ("p90", 90.0)],
            "ecdf_bins": json.dumps(
                [{"bin_center": 50, "cum_pct": 0.5}, {"bin_center": 60, "cum_pct": 1.0}]
            ),
            "network": baseline_params["network"],
            "timestamp": baseline_params["timestamp"],
            "site_id": baseline_params["site_id"],
            "baseline_resolution": baseline_params["baseline_resolution"],
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
            "minimum": baseline_params["minimum"],
            "maximum": baseline_params["maximum"],
            "baseline_version": baseline_params["baseline_version"],
            "site_minimum": baseline_params["site_minimum"],
            "site_maximum": baseline_params["site_maximum"],
        }
        baseline_raw_values = mock_df_raw[
            "pm2_5"
        ].values  # Use the dynamic pollutant column
        current_df = mock_df_raw.copy()

        # Test successful comparison with dynamic pollutant
        result = AirQoDataDriftCompute.compare_with_raw(
            current_df, baseline_raw_values, baseline_row
        )
        assert "ks_stat" in result
        assert "p_value" in result
        assert "delta_median" in result
        assert "delta_p90" in result

        # Test error when pollutant column is missing
        invalid_baseline_row = baseline_row.copy()
        invalid_baseline_row["pollutant"] = "non_existent_pollutant"
        with pytest.raises(
            ValueError,
            match="Pollutant column 'non_existent_pollutant' not found in data",
        ):
            AirQoDataDriftCompute.compare_with_raw(
                current_df, baseline_raw_values, invalid_baseline_row
            )

    def test_compare_with_bins(self, mock_df_raw, baseline_params):
        baseline_row = {
            "quantiles": [("p50", 50.0), ("p90", 90.0)],
            "ecdf_bins": json.dumps(
                [{"bin_center": 50, "cum_pct": 0.5}, {"bin_center": 60, "cum_pct": 1.0}]
            ),
            "network": baseline_params["network"],
            "timestamp": baseline_params["timestamp"],
            "site_id": baseline_params["site_id"],
            "baseline_resolution": baseline_params["baseline_resolution"],
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
            "minimum": baseline_params["minimum"],
            "maximum": baseline_params["maximum"],
            "baseline_version": baseline_params["baseline_version"],
            "site_minimum": baseline_params["site_minimum"],
            "site_maximum": baseline_params["site_maximum"],
        }
        current_df = mock_df_raw.copy()

        # Test successful comparison with dynamic pollutant
        result = AirQoDataDriftCompute.compare_with_bins(current_df, baseline_row)
        assert "D_approx" in result
        assert "delta_median" in result
        assert "delta_p90" in result

        # Test error when pollutant column is missing
        invalid_baseline_row = baseline_row.copy()
        invalid_baseline_row["pollutant"] = "non_existent_pollutant"
        with pytest.raises(
            ValueError,
            match="Pollutant column 'non_existent_pollutant' not found in current_df",
        ):
            AirQoDataDriftCompute.compare_with_bins(current_df, invalid_baseline_row)
