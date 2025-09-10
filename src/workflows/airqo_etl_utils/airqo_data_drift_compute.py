import pandas as pd
import numpy as np
from scipy.stats import ks_2samp
import json
import uuid
from datetime import datetime
from typing import Dict, Any, Optional


class AirQoDataDriftCompute:
    """
    Class for computing baselines and comparing data drift for AirQo devices.
    Provides methods for ECDF bin generation, baseline computation, and drift comparison.
    """

    MIN_HOUR_COVERAGE: float = 0.75  # 75%
    COOLDOWN_HOURS: int = 48
    BASELINE_WINDOW_DAYS: int = 30
    ECDF_BINS: int = 100

    @staticmethod
    def get_region_bins(
        region_min: float, region_max: float, n_bins: int = 100
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
        df_raw: pd.DataFrame,
        device: str,
        pollutant: str,
        window_start: datetime,
        window_end: datetime,
        baseline_table: Any,
        region_min: Optional[float] = 0,
        region_max: Optional[float] = 1000,
        ecdf_bins_count: Optional[int] = 100,
        baseline_frequency: Optional[str] = "Hourly",
        device_number: Optional[int] = None,
    ) -> str:
        """
        Compute baseline statistics and ECDF bins for a device and pollutant.
        Fields match measurements_baseline.json schema.

        Args:
            df_raw (pd.DataFrame): DataFrame with ['timestamp','value','qc_flag'].
            device_id (str): Device identifier.
            pollutant (str): Pollutant name.
            window_start (datetime): Start of baseline window.
            window_end (datetime): End of baseline window.
            baseline_table (Any): Table-like object with .insert(dict) method.
            region_min (float): Region-wide minimum value.
            region_max (float): Region-wide maximum value.
            ecdf_bins_count (int): Number of ECDF bins.
            network (str): Network name.
            site_id (str): Site identifier.
            baseline_frequency (str): Frequency of baseline calculation.
            device_number (int): Device number.
            device_category (str): Device category.
        Returns:
            str: Baseline ID.
        Raises:
            ValueError: If insufficient data for baseline.
        """
        df = df_raw[
            (df_raw["timestamp"] >= window_start)
            & (df_raw["timestamp"] < window_end)
            & (~df_raw["qc_flag"])
        ]

        sample_count = len(df)
        expected_samples = (
            window_end - window_start
        ).total_seconds() / 60  # assuming 1-min frequency
        sample_coverage_pct = (
            sample_count / expected_samples * 100 if expected_samples > 0 else 0.0
        )

        # hourly coverage check
        df = df.copy()
        df["hour"] = df["timestamp"].dt.floor("H")
        hourly_counts = df.groupby("hour").size()
        valid_hours = int((hourly_counts >= (60 * cls.MIN_HOUR_COVERAGE)).sum())

        if sample_count < 2000 or valid_hours < (cls.BASELINE_WINDOW_DAYS * 0.5 * 24):
            raise ValueError("Insufficient data for baseline")

        # quantiles
        quantiles = np.percentile(
            df["value"].values, [1, 5, 10, 25, 50, 75, 90, 95, 99]
        ).tolist()
        q_map = dict(
            zip(
                ["p1", "p5", "p10", "p25", "p50", "p75", "p90", "p95", "p99"], quantiles
            )
        )

        # region-based ECDF bins
        vals = df["value"].values
        bin_edges = cls.get_region_bins(region_min, region_max, ecdf_bins_count)
        hist, edges = np.histogram(vals, bins=bin_edges)
        cum = (
            np.cumsum(hist) / float(hist.sum())
            if hist.sum() > 0
            else np.zeros_like(hist)
        )
        ecdf_bins = [
            {
                "bin_center": float((edges[i] + edges[i + 1]) / 2),
                "cum_pct": float(cum[i]),
            }
            for i in range(len(hist))
        ]

        baseline_id = str(uuid.uuid4())
        baseline_row = {
            "network": device.network,
            "timestamp": window_end.isoformat(),
            "site_id": device.site_id,
            "baseline_frequency": baseline_frequency,
            "device_number": device_number,
            "device_id": device.id,
            "device_category": device.device_category,
            "baseline_id": baseline_id,
            "pollutant": pollutant,
            "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(),
            "sample_count": int(sample_count),
            "sample_coverage_pct": float(sample_coverage_pct),
            "valid_hours": int(valid_hours),
            "quantiles": q_map,
            "ecdf_bins": ecdf_bins,
            "mean": float(df["value"].mean()),
            "stddev": float(df["value"].std()),
            "min": float(df["value"].min()),
            "max": float(df["value"].max()),
            "baseline_version": "1.0.1",
            "region_min": float(region_min),
            "region_max": float(region_max),
        }

        baseline_table.insert(baseline_row)
        return baseline_id

    @staticmethod
    def compare_with_raw(
        current_df: pd.DataFrame,
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
        curr_vals = current_df["value"].values
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
