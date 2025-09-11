import pandas as pd
import numpy as np
from scipy.stats import ks_2samp
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from .constants import Frequency


class AirQoDataDriftCompute:
    """
    Class for computing baselines and comparing data drift for AirQo devices.
    Provides methods for ECDF bin generation, baseline computation, and drift comparison.
    """

    MIN_HOUR_COVERAGE: float = 0.5  # 50%
    COOLDOWN_HOURS: int = 48
    BASELINE_WINDOW_DAYS: int = 30
    ECDF_BINS: int = 100
    EXPECTED_SAMPLES_PER_HOUR = 20

    @classmethod
    def calculate_expected_sample_count(cls, resolution: Frequency) -> int:
        """
        Calculate the minimum valid hours required for baseline computation based on resolution.
        Args:
            resolution (Frequency): Frequency enum value (WEEKLY or MONTHLY).
        Returns:
            int: Minimum valid hours required.
        """
        valid_hours = 0
        match resolution:
            case Frequency.RAW:
                valid_hours = int(
                    (cls.BASELINE_WINDOW_DAYS * cls.EXPECTED_SAMPLES_PER_HOUR) * 24
                )
            case Frequency.HOURLY:
                valid_hours = int((cls.BASELINE_WINDOW_DAYS / 30) * 24)
            case Frequency.WEEKLY:
                valid_hours = int((cls.BASELINE_WINDOW_DAYS / 4) * 24)
            case Frequency.MONTHLY:
                valid_hours = int(cls.BASELINE_WINDOW_DAYS * 24)

        return valid_hours

    @classmethod
    def get_region_bins(
        cls, region_min: float, region_max: float, n_bins: int = 100
    ) -> np.ndarray:
        """
        Generate bin edges for ECDF using region-wide min and max values.
        Ensures consistency across baselines/devices within the same region.

        Args:
            region_min (float): Minimum value for region.
            region_max (float): Maximum value for region.
            n_bins (int): Number of bins.
        Returns:
            np.ndarray: Array of bin edges.
        """
        return np.linspace(region_min, region_max, n_bins + 1)

    @classmethod
    def compute_baseline(
        cls,
        data: pd.DataFrame,
        device: Dict[str, Any],
        pollutants: List[str],
        resolution: Frequency,
        window_start: datetime,
        window_end: datetime,
        region_min: Optional[float] = 0,
        region_max: Optional[float] = 1000,
        ecdf_bins_count: Optional[int] = 100,
    ) -> List[Dict[str, Any]]:
        """
        Compute baseline statistics and ECDF bins for a device and one or more pollutants.
        Fields match measurements_baseline.json schema.

        Args:
            data (pd.DataFrame): DataFrame with device air quality measurements.
            device (Dict[str, Any]): Device dictionary with device metadata.
            pollutants (List[str]): List of pollutant names.
            window_start (datetime): Start of baseline window.
            window_end (datetime): End of baseline window.
            region_min (float): Region-wide minimum value.
            region_max (float): Region-wide maximum value.
            ecdf_bins_count (int): Number of ECDF bins.
        Returns:
            List[Dict[str, Any]]: List of baseline statistics and metadata, one per pollutant.
        Raises:
            ValueError: If insufficient data for baseline.
        """

        sample_count: int = data.shape[1]
        expected_samples: int = cls.calculate_expected_sample_count(resolution)
        sample_coverage_pct: float = (
            (sample_count / expected_samples) * 100 if expected_samples > 0 else 0.0
        )

        valid_sample_count: int = expected_samples * cls.MIN_HOUR_COVERAGE

        if sample_count < valid_sample_count:
            raise ValueError("Insufficient data for baseline")

        # quantiles
        quantile_names: List[str] = [
            "p1",
            "p5",
            "p10",
            "p25",
            "p50",
            "p75",
            "p90",
            "p95",
            "p99",
        ]
        q_map: Dict[str, Dict[str, float]] = {}
        for pollutant in pollutants:
            quantile_values = np.percentile(
                data[pollutant].values, [1, 5, 10, 25, 50, 75, 90, 95, 99]
            ).tolist()
            q_map[pollutant] = dict(zip(quantile_names, quantile_values))

        # region-based ECDF bins for multiple pollutants
        ecdf_bins: Dict[str, List[Dict[str, float]]] = {}
        bin_edges = cls.get_region_bins(region_min, region_max, ecdf_bins_count)

        for pollutant in pollutants:
            vals = data[pollutant].dropna().values  # Ensure no NaN values
            hist, edges = np.histogram(vals, bins=bin_edges)
            cum = (
                np.cumsum(hist) / float(hist.sum())
                if hist.sum() > 0
                else np.zeros_like(hist)
            )
            ecdf_bins[pollutant] = [
                {
                    "bin_center": float((edges[i] + edges[i + 1]) / 2),
                    "cum_pct": float(cum[i]),
                }
                for i in range(len(hist))
            ]

        baseline_id = str(uuid.uuid4())
        # The baseline_id can be unique but multi-pollutant in this case considers a device having two sensors measuring the same thing and not actually two different pollutants.
        # Logic can be modified to handle multiple/different pollutants later.
        # When this is done, consider updating and or automating the baseline version changes to enable tracking
        baseline_rows: List[Dict[str, Any]] = []
        for pollutant in pollutants:
            baseline_row = {
                "network": device["network"],
                "timestamp": window_end.isoformat(),
                "device_id": device["device_id"],
                "site_id": device["site_id"],
                "baseline_frequency": resolution,
                "device_number": device["device_number"],
                "device_category": device["device_category"],
                "baseline_id": baseline_id,
                "pollutant": pollutant,
                "window_start": window_start.isoformat(),
                "window_end": window_end.isoformat(),
                "sample_count": int(sample_count),
                "sample_coverage_pct": float(sample_coverage_pct),
                "valid_hours": int(valid_sample_count),
                "quantiles": q_map[pollutant],
                "ecdf_bins": ecdf_bins[pollutant],
                "mean": float(data[pollutant].mean()),
                "stddev": float(data[pollutant].std()),
                "min": float(data[pollutant].min()),
                "max": float(data[pollutant].max()),
                "baseline_version": "1.0.1",
                "region_min": float(region_min),
                "region_max": float(region_max),
            }
            baseline_rows.append(baseline_row)
        return baseline_rows

    @staticmethod
    def compare_with_raw(
        data: pd.DataFrame,
        baseline_raw_values: np.ndarray,
        baseline_row: Dict[str, Any],
    ) -> Dict[str, float]:
        """
        Compare current data against a baseline using raw values (exact KS test).

        Args:
            current_df (pd.DataFrame): DataFrame with 'value' column for current period.
            baseline_raw_values (np.ndarray): 1D array of baseline raw values.
            baseline_row (dict): Baseline metadata (quantiles, etc.).
        Returns:
            dict: KS statistic, p-value, delta_median, delta_p90.
        """
        curr_vals = data["value"].values
        ks_stat, p_value = ks_2samp(baseline_raw_values, curr_vals)

        baseline_q = json.loads(baseline_row["quantiles"])
        curr_qs = np.percentile(curr_vals, [50, 90])
        delta_median = float(curr_qs[0] - baseline_q["p50"])
        delta_p90 = float(curr_qs[1] - baseline_q["p90"])

        return {
            "ks_stat": float(ks_stat),
            "p_value": float(p_value),
            "delta_median": delta_median,
            "delta_p90": delta_p90,
        }

    @staticmethod
    def compare_with_bins(
        current_df: pd.DataFrame, baseline_row: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Compare current data against a baseline using stored ECDF bins (approximate KS test).

        Args:
            current_df (pd.DataFrame): DataFrame with 'value' column for current period.
            baseline_row (dict): Baseline metadata including ecdf_bins and quantiles.
        Returns:
            dict: D_approx, delta_median, delta_p90.
        """
        baseline_ecdf = json.loads(baseline_row["ecdf_bins"])
        base_centers = np.array([b["bin_center"] for b in baseline_ecdf])
        base_cum = np.array([b["cum_pct"] for b in baseline_ecdf])

        curr_vals = current_df["value"].values
        # Histogram aligned to baseline bins
        curr_hist, _ = np.histogram(
            curr_vals, bins=np.append(base_centers - 0.5, base_centers[-1] + 0.5)
        )
        curr_cum = (
            np.cumsum(curr_hist) / float(curr_hist.sum())
            if curr_hist.sum() > 0
            else np.zeros_like(curr_hist)
        )

        # Approximate KS = max vertical gap between ECDFs
        D_approx = float(np.max(np.abs(base_cum - curr_cum)))

        baseline_q = json.loads(baseline_row["quantiles"])
        curr_qs = np.percentile(curr_vals, [50, 90])
        delta_median = float(curr_qs[0] - baseline_q["p50"])
        delta_p90 = float(curr_qs[1] - baseline_q["p90"])

        return {
            "D_approx": D_approx,
            "delta_median": delta_median,
            "delta_p90": delta_p90,
        }
