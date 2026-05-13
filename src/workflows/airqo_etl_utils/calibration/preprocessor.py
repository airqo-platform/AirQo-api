"""Data preprocessing for calibration model training.

Handles low-cost sensor (LCS) and BAM reference monitor data
emitted by ``DataUtils.extract_devices_data``.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger("airflow.task")


class CalibrationPreprocessor:
    """
    Static helpers to clean, derive features, and merge LCS + BAM data.
    """

    # Column written by AIRQO_BAM_MAPPING (hourly_conc → pm2_5)
    # or still named hourly_conc when extract_devices_data is called without
    # the downstream clean_bam_data step.
    _BAM_PM_CANDIDATES: Tuple[str, ...] = ("pm2_5", "hourly_conc")

    BAM_PM_TARGET: str = "bam_pm"
    required_lcs_cols: List[str] = [
        "device_id",
        "timestamp",
        "s1_pm2_5",
        "s2_pm2_5",
        "s1_pm10",
        "s2_pm10",
    ]
    CANDIDATE_FEATURES: Tuple[str, ...] = (
        "hour",
        "avg_pm2_5",
        "avg_pm10",
        "error_pm2_5",
        "error_pm10",
        "pm2_5_pm10",
        "pm2_5_pm10_mod",
    )

    @staticmethod
    def process_lcs(df: pd.DataFrame, tz_offset_hours: int = 0) -> pd.DataFrame:
        """
        Clean and derive PM features from a low-cost sensor DataFrame.

        Expects columns produced by ``DataUtils.extract_devices_data`` or ``DataUtils.extract_data_from_bigquery`` for
        ``DeviceCategory.LOWCOST``:
        ``s1_pm2_5``, ``s2_pm2_5``, ``s1_pm10``, ``s2_pm10``, ``timestamp``.

        Returns a DataFrame indexed by a timezone-aware ``DatetimeIndex``
        with derived columns: ``avg_pm2_5``, ``error_pm2_5``, ``avg_pm10``, ``error_pm10``, ``pm2_5_pm10``, ``pm2_5_pm10_mod``.

        Raises:
            ValueError: If required PM2.5 columns are absent.
        """
        required = {"s1_pm2_5", "s2_pm2_5"}

        missing = required - set(df.columns)
        if missing:
            raise ValueError(f"LCS data missing required columns: {missing}")

        df = df.copy()
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True, errors="coerce")
        if tz_offset_hours != 0:
            df["timestamp"] = df["timestamp"] + pd.Timedelta(hours=tz_offset_hours)
        df = df.dropna(subset=["timestamp"]).sort_values("timestamp")

        df.dropna(subset=["s1_pm2_5", "s2_pm2_5"], how="all", inplace=True)
        dedup_cols = (
            ["timestamp", "device_id"] if "device_id" in df.columns else ["timestamp"]
        )
        df = df.sort_values(["s1_pm2_5", "s2_pm2_5"]).drop_duplicates(
            subset=dedup_cols, keep="first"
        )
        df = df.set_index(["timestamp"]).sort_index()
        df = df.resample("h").mean(numeric_only=True)

        df = df[
            (
                (df[["s1_pm2_5", "s2_pm2_5"]] >= 0)
                & (df[["s1_pm2_5", "s2_pm2_5"]] <= 500.4)
            ).all(axis=1)
        ]

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
    def clean_data(df: pd.DataFrame, tz_offset_hours: int = 0) -> pd.DataFrame:
        """Clean and derive PM features from a low-cost sensor DataFrame.

        Wraps :meth:`process_lcs` with an early-return guard for empty input.
        """
        if df.empty:
            return pd.DataFrame()
        return CalibrationPreprocessor.process_lcs(df, tz_offset_hours=tz_offset_hours)

    @staticmethod
    def process_bam(df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and normalize BAM reference monitor data.

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
        df = df.resample("h").mean(numeric_only=True)
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

        env_cols = [c for c in ("temperature", "humidity") if c in df.columns]
        if env_cols:
            df = df.dropna(subset=env_cols, how="all")
        df = df[(df[pm_col] > 0) & (df[pm_col] <= 500.4)]
        df.rename(columns={pm_col: CalibrationPreprocessor.BAM_PM_TARGET}, inplace=True)
        return df

    @staticmethod
    def build_feature_columns(df: pd.DataFrame) -> List[str]:
        """Return the subset of ``CANDIDATE_FEATURES`` present in *df*."""
        return [
            c for c in CalibrationPreprocessor.CANDIDATE_FEATURES if c in df.columns
        ]

    @staticmethod
    def _join_bam_and_finalise(
        lcs_indexed: pd.DataFrame,
        reference_data: pd.DataFrame,
    ) -> pd.DataFrame:
        """Join a ``DatetimeIndex``-indexed LCS frame with processed BAM data.

        Adds the ``hour`` feature, drops all-NaN columns, and returns a
        reset-index DataFrame.
        """
        bam_processed = CalibrationPreprocessor.process_bam(reference_data)
        if bam_processed.empty:
            return pd.DataFrame()

        overlap = lcs_indexed.columns.intersection(bam_processed.columns)
        lcs_clean = lcs_indexed.drop(columns=overlap)

        merged = lcs_clean.join(bam_processed, how="inner").dropna(
            subset=[CalibrationPreprocessor.BAM_PM_TARGET]
        )

        if merged.empty:
            return pd.DataFrame()
        merged["hour"] = merged.index.hour
        merged.dropna(axis=1, how="all", inplace=True)
        merged.dropna(axis=0, how="any", inplace=True)
        return merged.reset_index()

    @staticmethod
    def build_wide_dataset(
        low_cost_data: pd.DataFrame,
        reference_data: pd.DataFrame,
        *,
        tz_offset_hours: int = 0,
    ) -> pd.DataFrame:
        """Clean LCS data, derive PM features, and inner-join with BAM reference.

        Args:
            low_cost_data: Raw LCS DataFrame.  Must contain at least
                ``device_id``, ``timestamp``, ``s1_pm2_5``, ``s2_pm2_5``.
            reference_data: Raw BAM reference DataFrame.
            tz_offset_hours: Hours to shift all LCS timestamps forward before
                merging with the BAM reference monitor (default 0).  Use this
                when the LCS and BAM clocks are in different timezones.

        Returns:
            DataFrame with one row per overlapping hour containing LCS PM
            features, ``bam_pm`` target, and an ``hour`` integer column.
            Returns an empty DataFrame when either input is empty or no
            common timestamps survive after cleaning.
        """
        if low_cost_data.empty or reference_data.empty:
            return pd.DataFrame()

        if "device_id" not in low_cost_data.columns:
            logger.warning("'device_id' column not found in LCS data; returning empty.")
            return pd.DataFrame()

        cleaned = CalibrationPreprocessor.process_lcs(
            low_cost_data, tz_offset_hours=tz_offset_hours
        )

        if cleaned.empty:
            return pd.DataFrame()

        return CalibrationPreprocessor._join_bam_and_finalise(cleaned, reference_data)
