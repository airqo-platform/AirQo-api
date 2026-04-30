"""Data preprocessing for calibration model training.

Handles low-cost sensor (LCS) and BAM reference monitor data
emitted by ``DataUtils.extract_devices_data``.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

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
        for col in ["s1_pm2_5", "s2_pm2_5"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        df = df[
            (
                (df[["s1_pm2_5", "s2_pm2_5"]] >= 0)
                & (df[["s1_pm2_5", "s2_pm2_5"]] <= 500.4)
            ).all(axis=1)
        ]

        df["avg_pm2_5"] = df[["s1_pm2_5", "s2_pm2_5"]].mean(axis=1)
        df["error_pm2_5"] = (df["s1_pm2_5"] - df["s2_pm2_5"]).abs()
        # # Eliminate features involving PM10 for now as they don't seem to be adding value and are often missing or zero, which causes issues with the engineered features and model training.  Can revisit if we get more reliable PM10 data in the future.
        if {"s1_pm10", "s2_pm10"}.issubset(df.columns):
            df["avg_pm10"] = df[["s1_pm10", "s2_pm10"]].mean(axis=1)
            df["error_pm10"] = (df["s1_pm10"] - df["s2_pm10"]).abs()
            denom = df["avg_pm10"].replace(0, np.nan)
            df["pm2_5_pm10"] = (df["avg_pm10"] - df["avg_pm2_5"]).abs()
            df["pm2_5_pm10_mod"] = df["pm2_5_pm10"] / denom

        return df

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
        bam_pm_cols = ["realtime_conc", "short_time_conc"]
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

        df = df[~df["temperature"].isna() | ~df["humidity"].isna()]
        # df = df[~(df[bam_pm_cols] >= 500.4).all(axis=1)] # Remove rows where either 'realtime_conc' and 'short_time_conc' exceeds 500.4
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
        bam_device_name: Optional[str] = None,
    ) -> pd.DataFrame:
        """Join a ``DatetimeIndex``-indexed LCS frame with processed BAM data.

        Shared by both the single-device fallback and the multi-device path in
        :meth:`build_wide_dataset`.  Adds the ``hour`` feature, drops all-NaN
        columns, and returns a reset-index DataFrame.
        """
        bam_processed = CalibrationPreprocessor.process_bam(reference_data)
        if bam_processed.empty:
            return pd.DataFrame()

        # if bam_device_name:
        #     bam_processed = bam_processed.rename(
        #         columns={
        #             c: f"{bam_device_name}_{c}"
        #             for c in bam_processed.columns
        #             if c != CalibrationPreprocessor.BAM_PM_TARGET
        #         }
        #     )
        merged = lcs_indexed.join(bam_processed, how="inner").dropna(
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
        device_col: str = "device_id",
        bam_device_name: Optional[str] = None,
        tz_offset_hours: int = 0,
    ) -> pd.DataFrame:
        """Process multiple LCS devices into a wide (horizontal) DataFrame.

        Each device's features are prefixed with its device ID so that one row
        per timestamp contains all devices' readings side by side, followed by
        ensemble averages across all devices and the BAM reference columns.

        Args:
            low_cost_data: Raw multi-device LCS DataFrame with a device
                identifier column (``device_col``).  Must contain at least
                ``timestamp``, ``s1_pm2_5``, ``s2_pm2_5``, and ``device_col``.
            reference_data: Raw BAM reference DataFrame.
            device_col: Column in *low_cost_data* that identifies each device
                (default ``"device_number"``).
            bam_device_name: Optional label used to prefix extra BAM columns
                (e.g. ``"bam_loggerA1"``).  ``bam_pm`` is never prefixed.
            tz_offset_hours: Hours to shift all LCS timestamps forward before
                merging with the BAM reference monitor (default 0).  Use this
                when the LCS and BAM clocks are in different timezones.

        Returns:
            Wide DataFrame with one row per timestamp, device-prefixed LCS
            feature columns, ensemble aggregate columns, ``bam_pm``, and an
            ``hour`` integer column.  Returns an empty DataFrame when either
            input is empty, when no common timestamps survive after cleaning,
            or when the device column is absent (falls back to
            :meth:`process_lcs` with a warning).
        """
        if low_cost_data.empty or reference_data.empty:
            return pd.DataFrame()

        if device_col not in low_cost_data.columns:
            logger.warning(
                "Column '%s' not found in LCS data; returning empty.", device_col
            )
            return pd.DataFrame()

        cleaned = CalibrationPreprocessor.process_lcs(
            low_cost_data, tz_offset_hours=tz_offset_hours
        )

        if cleaned.empty:
            return pd.DataFrame()

        return CalibrationPreprocessor._join_bam_and_finalise(
            cleaned, reference_data, bam_device_name
        )
