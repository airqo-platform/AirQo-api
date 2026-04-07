"""Shared fixtures for calibration tests."""

from typing import List

import numpy as np
import pandas as pd
import pytest


# ------------------------------------------------------------------ #
# Helpers                                                              #
# ------------------------------------------------------------------ #


def _make_timestamps(n: int, freq: str = "h") -> List[pd.Timestamp]:
    return list(pd.date_range("2025-01-01", periods=n, freq=freq, tz="UTC"))


# ------------------------------------------------------------------ #
# LCS fixtures                                                         #
# ------------------------------------------------------------------ #


@pytest.fixture()
def lcs_raw_df() -> pd.DataFrame:
    """Minimal raw LCS DataFrame as returned by extract_devices_data."""
    n = 24 * 30  # 30 days of raw readings
    rng = np.random.default_rng(0)
    return pd.DataFrame(
        {
            "device_id": ["AQ_G5341"] * n,
            "timestamp": _make_timestamps(n),
            "s1_pm2_5": rng.uniform(5, 80, n),
            "s2_pm2_5": rng.uniform(5, 80, n),
            "s1_pm10": rng.uniform(10, 120, n),
            "s2_pm10": rng.uniform(10, 120, n),
            "temperature": rng.uniform(18, 35, n),
            "humidity": rng.uniform(30, 90, n),
        }
    )


@pytest.fixture()
def lcs_raw_df_missing_cols() -> pd.DataFrame:
    """LCS DataFrame that is missing the required s2_pm2_5 column."""
    return pd.DataFrame(
        {"device_id": ["X"], "timestamp": ["2025-01-01T00:00:00Z"], "s1_pm2_5": [10.0]}
    )


# ------------------------------------------------------------------ #
# BAM fixtures                                                         #
# ------------------------------------------------------------------ #


@pytest.fixture()
def bam_raw_df() -> pd.DataFrame:
    """Minimal raw BAM DataFrame (uses hourly_conc, matching extract_devices_data output)."""
    n = 30 * 24  # 30 days, one per hour
    rng = np.random.default_rng(1)
    return pd.DataFrame(
        {
            "device_id": ["BAM_MUK"] * n,
            "timestamp": _make_timestamps(n),
            "hourly_conc": rng.uniform(5, 60, n),
            "temperature": rng.uniform(18, 35, n),
            "humidity": rng.uniform(30, 90, n),
        }
    )


@pytest.fixture()
def bam_raw_df_pm2_5_col() -> pd.DataFrame:
    """BAM DataFrame where hourly_conc has already been renamed to pm2_5."""
    n = 30 * 24
    rng = np.random.default_rng(2)
    return pd.DataFrame(
        {
            "device_id": ["BAM_MUK"] * n,
            "timestamp": _make_timestamps(n),
            "pm2_5": rng.uniform(5, 60, n),
            "temperature": rng.uniform(18, 35, n),
            "humidity": rng.uniform(30, 90, n),
        }
    )


@pytest.fixture()
def bam_df_with_invalid_readings() -> pd.DataFrame:
    """BAM DataFrame containing values outside valid range (> 500 or <= 0)."""
    return pd.DataFrame(
        {
            "device_id": ["BAM"] * 5,
            "timestamp": _make_timestamps(5),
            "pm2_5": [-1.0, 0.0, 25.0, 501.0, 40.0],
        }
    )


# ------------------------------------------------------------------ #
# Merged training fixture                                              #
# ------------------------------------------------------------------ #


@pytest.fixture()
def merged_training_df() -> pd.DataFrame:
    """Hourly merged DataFrame ready for model training (100 rows)."""
    n = 100
    rng = np.random.default_rng(3)
    timestamps = pd.date_range("2025-01-01", periods=n, freq="h", tz="UTC")
    return pd.DataFrame(
        {
            "timestamp": timestamps,
            "hour": timestamps.hour,
            "avg_pm2_5": rng.uniform(5, 80, n),
            "avg_pm10": rng.uniform(10, 120, n),
            "error_pm2_5": rng.uniform(0, 10, n),
            "error_pm10": rng.uniform(0, 15, n),
            "pm2_5_pm10": rng.uniform(0, 40, n),
            "pm2_5_pm10_mod": rng.uniform(0, 1, n),
            "temperature": rng.uniform(18, 35, n),
            "humidity": rng.uniform(30, 90, n),
            "bam_pm": rng.uniform(5, 60, n),
        }
    )
