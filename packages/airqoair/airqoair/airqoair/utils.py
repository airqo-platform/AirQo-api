from __future__ import annotations

from collections.abc import Iterable
from os import PathLike
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

DataSource = pd.DataFrame | str | PathLike[str]
SUPPORTED_FILE_FORMATS = ("csv", "json", "jsonl", "ndjson")


def load_data(
    data: DataSource,
    *,
    date_col: str | None = "date",
    copy: bool = True,
    format: str | None = None,
    read_kwargs: dict[str, Any] | None = None,
) -> pd.DataFrame:
    read_kwargs = read_kwargs or {}
    frame = _coerce_to_dataframe(data, copy=copy, format=format, read_kwargs=read_kwargs)

    if date_col is None:
        if frame.empty:
            raise ValueError("data must contain at least one row")
        return frame.reset_index(drop=True)

    if date_col not in frame.columns:
        raise ValueError(f"Missing required date column: {date_col}")

    frame[date_col] = pd.to_datetime(frame[date_col], errors="coerce")
    frame = frame.dropna(subset=[date_col]).sort_values(date_col).reset_index(drop=True)

    if frame.empty:
        raise ValueError("No valid rows remain after parsing the date column")

    return frame


def _coerce_to_dataframe(
    data: DataSource,
    *,
    copy: bool,
    format: str | None,
    read_kwargs: dict[str, Any],
) -> pd.DataFrame:
    if isinstance(data, pd.DataFrame):
        return data.copy() if copy else data

    if isinstance(data, (str, PathLike)):
        path = Path(data)
        reader = (format or path.suffix.lstrip(".")).lower()
        if not reader:
            raise ValueError(
                "Could not infer file format. Use a .csv, .json, .jsonl, or .ndjson path, "
                "or pass format='csv'/'json'/'jsonl'/'ndjson'."
            )

        if reader == "csv":
            return pd.read_csv(path, **read_kwargs)
        if reader == "json":
            return pd.read_json(path, **read_kwargs)
        if reader in {"jsonl", "ndjson"}:
            json_kwargs = dict(read_kwargs)
            json_kwargs.setdefault("lines", True)
            return pd.read_json(path, **json_kwargs)

        raise ValueError(
            f"Unsupported data format '{reader}'. Supported formats are {', '.join(SUPPORTED_FILE_FORMATS)}."
        )

    raise TypeError(
        "data must be a pandas DataFrame or a path to a csv, json, jsonl, or ndjson file"
    )


def available_numeric_columns(
    data: pd.DataFrame,
    *,
    exclude: Iterable[str] = (),
) -> list[str]:
    blocked = set(exclude)
    columns: list[str] = []
    for column in data.columns:
        if column in blocked:
            continue
        if pd.api.types.is_numeric_dtype(data[column]):
            columns.append(column)
    return columns


def summary(
    data: DataSource,
    *,
    pollutant_cols: list[str] | None = None,
    group_by: str | list[str] | None = None,
    date_col: str = "date",
) -> pd.DataFrame:
    frame = load_data(data, date_col=date_col)
    columns = pollutant_cols or available_numeric_columns(frame, exclude=[date_col])

    if not columns:
        raise ValueError("No numeric columns available for summary statistics")

    if group_by is None:
        result = frame[columns].agg(["count", "mean", "median", "min", "max", "std"]).T
        result.index.name = "variable"
        return result.reset_index()

    grouped = frame.groupby(group_by, dropna=False)[columns]
    result = grouped.agg(["count", "mean", "median", "min", "max", "std"])
    return result


def circular_mean(degrees: pd.Series) -> float:
    clean = degrees.dropna().astype(float) % 360
    if clean.empty:
        return np.nan

    radians = np.deg2rad(clean.to_numpy())
    sin_mean = np.sin(radians).mean()
    cos_mean = np.cos(radians).mean()

    if np.isclose(sin_mean, 0.0) and np.isclose(cos_mean, 0.0):
        return np.nan

    return float((np.rad2deg(np.arctan2(sin_mean, cos_mean)) + 360) % 360)


def validate_columns(data: pd.DataFrame, required: Iterable[str]) -> None:
    missing = [column for column in required if column not in data.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def _offset_span(label: pd.Timestamp, avg: str) -> pd.Timedelta:
    offset = pd.tseries.frequencies.to_offset(avg)
    return (label + offset) - label


def infer_expected_counts(index: pd.Series, labels: pd.Index, avg: str) -> pd.Series | None:
    diffs = pd.Series(index.sort_values().diff().dropna())
    diffs = diffs[diffs > pd.Timedelta(0)]
    if diffs.empty:
        return None

    base_step = diffs.mode().iloc[0]
    expected = []
    for label in labels:
        span = _offset_span(pd.Timestamp(label), avg)
        count = max(int(round(span / base_step)), 1)
        expected.append(count)
    return pd.Series(expected, index=labels, dtype="float64")
