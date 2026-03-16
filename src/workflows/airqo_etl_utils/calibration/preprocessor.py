"""Data preprocessing for calibration model training.

Handles low-cost sensor (LCS) and BAM reference monitor data
emitted by ``DataUtils.extract_devices_data``.
"""

from __future__ import annotations

import logging
from typing import List, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger("airflow.task")


class CalibrationPreprocessor:
    """Static helpers to clean, derive features, and merge LCS + BAM data."""

    # Column written by AIRQO_BAM_MAPPING (hourly_conc → pm2_5)
    # or still named hourly_conc when extract_devices_data is called without
    # the downstream clean_bam_data step.
    _BAM_PM_CANDIDATES: Tuple[str, ...] = ("pm2_5", "hourly_conc")

    BAM_PM_TARGET: str = "bam_pm"

    CANDIDATE_FEATURES: Tuple[str, ...] = (
        "hour",
        "avg_pm2_5",
        "avg_pm10",
        "humidity",
        "temperature",
        "error_pm2_5",
        "error_pm10",
        "pm2_5_pm10",
        "pm2_5_pm10_mod",
    )

    @staticmethod
    def process_lcs(df: pd.DataFrame) -> pd.DataFrame:
        """Clean and derive PM features from a low-cost sensor DataFrame.

        Expects columns produced by ``DataUtils.extract_devices_data`` or ``DataUtils.extract_data_from_bigquery`` for
        ``DeviceCategory.LOWCOST``:
        ``s1_pm2_5``, ``s2_pm2_5``, ``s1_pm10`` (opt), ``s2_pm10`` (opt),
        ``temperature`` (opt), ``humidity`` (opt), ``timestamp``.

        Returns a DataFrame indexed by a timezone-aware ``DatetimeIndex``
        with derived columns:
        ``avg_pm2_5``, ``error_pm2_5``, and optionally
        ``avg_pm10``, ``error_pm10``, ``pm2_5_pm10``, ``pm2_5_pm10_mod``.

        Raises:
            ValueError: If required PM2.5 columns are absent.
        """
        required = {"s1_pm2_5", "s2_pm2_5"}
        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"LCS data missing required columns: {missing}")

        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
        df = df.set_index("timestamp")

        for col in ["s1_pm2_5", "s2_pm2_5", "s1_pm10", "s2_pm10"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df.dropna(subset=["s1_pm2_5", "s2_pm2_5"])

        df["avg_pm2_5"] = df[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        df["error_pm2_5"] = (df["s1_pm2_5"] - df["s2_pm2_5"]).abs()

        if {"s1_pm10", "s2_pm10"}.issubset(df.columns):
            df["avg_pm10"] = df[["s1_pm10", "s2_pm10"]].mean(axis=1)
            df["error_pm10"] = (df["s1_pm10"] - df["s2_pm10"]).abs()
            denom = df["avg_pm10"].replace(0, np.nan)
            df["pm2_5_pm10"] = (df["avg_pm10"] - df["avg_pm2_5"]).abs()
            df["pm2_5_pm10_mod"] = df["pm2_5_pm10"] / denom

        return df

    @staticmethod
    def process_bam(df: pd.DataFrame) -> pd.DataFrame:
        """Clean and normalize BAM reference monitor data.

        Accepts DataFrames containing either a ``pm2_5`` column (already
        renamed via ``AIRQO_BAM_MAPPING``) or ``hourly_conc`` (raw field8
        parse from ``AIRQO_BAM_MAPPING_NEW``).  Quality filters: readings
        must be > 0 and ≤ 500.4 µg/m³.

        Returns a DataFrame indexed by a timezone-aware ``DatetimeIndex``
        with column ``bam_pm`` as the calibration target.

        Raises:
            ValueError: If no recognised PM2.5 column is found.
        """
        if df is None or df.empty:
            return pd.DataFrame()

        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp")
        df = df.set_index("timestamp")

        pm_col = next(
            (c for c in CalibrationPreprocessor._BAM_PM_CANDIDATES if c in df.columns),
            None,
        )
        if pm_col is None:
            raise ValueError(
                f"BAM data has no recognised PM2.5 column. "
                f"Expected one of {CalibrationPreprocessor._BAM_PM_CANDIDATES}."
            )

        df[pm_col] = pd.to_numeric(df[pm_col], errors="coerce")
        df = df.dropna(subset=[pm_col])
        df = df[(df[pm_col] > 0) & (df[pm_col] <= 500.4)]
        df = df.rename(columns={pm_col: CalibrationPreprocessor.BAM_PM_TARGET})

        return df

    @staticmethod
    def merge_hourly(
        lcs_df: pd.DataFrame,
        bam_df: pd.DataFrame,
        tz_offset_hours: int = 0,
    ) -> pd.DataFrame:
        """Resample both devices to hourly means and merge on timestamp.

        Args:
            lcs_df: Processed LCS DataFrame with ``DatetimeIndex``.
            bam_df: Processed BAM DataFrame with ``DatetimeIndex``.
            tz_offset_hours: Hours to shift LCS timestamps to align with
                the reference monitor timezone (default 0).

        Returns:
            Merged DataFrame with a reset ``timestamp`` column and an
            added ``hour`` feature.  Only rows where both LCS and
            ``bam_pm`` are present are retained.
        """
        if lcs_df.empty or bam_df.empty:
            return pd.DataFrame()

        work_lcs = lcs_df.copy()
        if tz_offset_hours:
            work_lcs.index = work_lcs.index + pd.Timedelta(hours=tz_offset_hours)

        lcs_hourly = work_lcs.resample("h").mean(numeric_only=True)
        bam_hourly = bam_df.resample("h").mean(numeric_only=True)

        # Bring BAM target + any extra meteorology the LCS doesn't already have
        bam_merge_cols = [CalibrationPreprocessor.BAM_PM_TARGET]
        for col in ("temperature", "humidity"):
            if col in bam_hourly.columns and col not in lcs_hourly.columns:
                bam_merge_cols.append(col)

        merged = lcs_hourly.join(bam_hourly[bam_merge_cols], how="inner")
        merged["hour"] = merged.index.hour
        merged = merged.dropna(subset=[CalibrationPreprocessor.BAM_PM_TARGET])

        return merged.reset_index()

    @staticmethod
    def build_feature_columns(df: pd.DataFrame) -> List[str]:
        """Return the subset of ``CANDIDATE_FEATURES`` present in *df*."""
        return [
            c for c in CalibrationPreprocessor.CANDIDATE_FEATURES if c in df.columns
        ]
