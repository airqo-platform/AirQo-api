"""
Data cleaning pipeline for BigQuery query results.

This module post-processes the raw DataFrame returned by the BigQuery layer
into the shape expected by API consumers. It is deliberately decoupled from
BigQuery and application config: every input a step needs is carried on
``CleaningContext``, so the whole pipeline is a pure ``DataFrame -> DataFrame``
transformation that can be unit-tested without any I/O or mocking.

Design
------
- ``CleaningStep`` — one small, documented, independently testable transform.
- ``DataCleaningPipeline`` — runs an ordered list of steps; copies the input
  once so the caller's DataFrame is never mutated; short-circuits on empty.
- ``build_download_pipeline()`` — the standard ordering used by data exports.

To add or reorder behaviour, add a ``CleaningStep`` and place it in the factory
(or build a custom pipeline for a new endpoint). Nothing else needs to change.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional, Sequence, Set

import numpy as np
import pandas as pd

from constants import DataType, DeviceCategory, Frequency

logger = logging.getLogger(__name__)


# Frequencies whose rows are aggregated into a single named period column
# (produced by the query's time-grouping) instead of a per-record `datetime`.
_PERIOD_COLUMN = {
    Frequency.WEEKLY: "week",
    Frequency.MONTHLY: "month",
    Frequency.YEARLY: "year",
}


@dataclass
class CleaningContext:
    """
    Inputs a cleaning step may need, resolved by the caller.

    Keeping these here (rather than reaching into config/BigQuery from a step)
    is what makes the pipeline a pure function and trivially testable.

    Attributes:
        datatype: Semantic data type of the result (raw vs calibrated/averaged).
        frequency: Aggregation frequency of the result.
        device_category: Device category the data was queried for.
        pollutants: Pollutants that were requested (e.g. ["pm2_5"]).
        extra_columns: Optional metadata/weather columns the caller asked to keep.
        optional_fields: The full set of optional columns available for the
            device category; any not in ``extra_columns`` are dropped.
    """

    datatype: DataType
    frequency: Frequency
    device_category: DeviceCategory
    pollutants: List[str] = field(default_factory=list)
    extra_columns: List[str] = field(default_factory=list)
    optional_fields: Set[str] = field(default_factory=set)

    @property
    def period_column(self) -> Optional[str]:
        """Grouped-period column name (week/month/year), or None for
        per-timestamp frequencies (raw/hourly/daily)."""
        return _PERIOD_COLUMN.get(self.frequency)

    @property
    def is_grouped(self) -> bool:
        """True when rows represent an aggregated period rather than a timestamp."""
        return self.period_column is not None

    @property
    def identity_column(self) -> str:
        """Column identifying a data source within one time bucket.

        The identity varies by source; the dedup key is always
        (identity, time). Currently implemented:

        - device-backed data (lowcost, bam, ...) -> ``device_id``
        - satellite forecasts -> ``city`` (no device_id or site_id exists;
          city is the finest grain that query projects)

        Extend this mapping as sources gain identifiers — e.g.
        country-level queries, coordinates, or site_id-keyed data.
        """
        if self.device_category == DeviceCategory.SATELLITE:
            return "city"
        return "device_id"

    @property
    def sort_columns(self) -> List[str]:
        """Columns used to order records deterministically."""
        tail = self.period_column if self.is_grouped else "datetime"
        return [self.identity_column, tail]

    @property
    def dedup_columns(self) -> List[str]:
        """Column combination that uniquely identifies a record (for dedup).

        Grouped frequencies key on the period column instead of datetime —
        the query returns one row per (identity, period), so deduping on the
        identity alone would collapse a multi-period range to a single row
        per source.
        """
        if self.is_grouped:
            return [self.identity_column, self.period_column]
        return [self.identity_column, "datetime"]


class CleaningStep(ABC):
    """
    A single composable transformation over a DataFrame.

    Contract:
    - Receives the working DataFrame and the shared context; returns a
      DataFrame (may be the same object or a new one).
    - Must be safe when its target columns are absent — steps never assume a
      column exists, so the pipeline stays robust across datatypes/frequencies.
    - Must not mutate ``ctx``.
    """

    @property
    def name(self) -> str:
        return type(self).__name__

    @abstractmethod
    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        raise NotImplementedError


class CoerceNumericAndDropZeroColumns(CleaningStep):
    """
    Coerce numeric columns to real numbers and drop all-zero columns.

    Non-numeric junk in numeric columns becomes NaN (``errors="coerce"``).
    For raw data spanning non-airqo or mixed networks, ``pm2_5`` is treated as
    a required numeric column so its absence is surfaced as an error rather
    than silently returning a malformed export.

    Raises:
        ValueError: If a required numeric column is missing.
    """

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        required: Set[str] = set(df.select_dtypes(include="number").columns)

        if ctx.datatype == DataType.RAW and "network" in df.columns:
            networks = df["network"].dropna().unique().tolist()
            if "airqo" not in networks or len(networks) > 1:
                required.add("pm2_5")

        missing = [col for col in required if col not in df.columns]
        if missing:
            raise ValueError(f"Missing required numeric columns: {missing}")

        if required:
            cols = list(required)
            df[cols] = df[cols].apply(pd.to_numeric, errors="coerce")

        zero_only_columns = df.columns[(df == 0).all()]
        return df.drop(columns=list(zero_only_columns))


class DropOptionalColumns(CleaningStep):
    """
    Drop optional metadata/weather columns the caller did not request.

    The device category's optional fields (plus the internal ``timestamp``
    helper column) are removed unless explicitly named in
    ``ctx.extra_columns``. Absent columns are ignored.
    """

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        droppable = set(ctx.optional_fields) | {"timestamp"}
        keep = set(ctx.extra_columns or [])
        to_drop = droppable - keep
        return df.drop(columns=list(to_drop), errors="ignore")


class SortRecords(CleaningStep):
    """Order records deterministically by ``ctx.sort_columns`` (when present)."""

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        cols = [c for c in ctx.sort_columns if c in df.columns]
        if cols:
            df = df.sort_values(cols, ascending=True)
        return df


class DropDuplicateRecords(CleaningStep):
    """Drop duplicate records identified by ``ctx.dedup_columns`` (keep first).

    Dedup runs only when the FULL key is present. A partial key does not
    identify a record, so falling back to whatever columns exist silently
    drops distinct rows — e.g. forecast data has no device_id, and deduping
    it on datetime alone would collapse every location sharing a timestamp.
    """

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        cols = ctx.dedup_columns
        if all(c in df.columns for c in cols):
            df = df.drop_duplicates(subset=cols, keep="first")
        return df


class TagFrequency(CleaningStep):
    """Annotate every record with the frequency it represents."""

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        df["frequency"] = ctx.frequency.value
        return df


class RenameDeviceIdToName(CleaningStep):
    """
    Rename ``device_id`` -> ``device_name`` for the public response contract.

    Runs after sorting/dedup, which rely on ``device_id``.
    """

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        if "device_id" in df.columns:
            df = df.rename(columns={"device_id": "device_name"})
        return df


class NullifyNaN(CleaningStep):
    """Replace NaN with None so JSON serialisation emits ``null`` (not ``NaN``)."""

    def apply(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        return df.replace({np.nan: None})


class DataCleaningPipeline:
    """
    Runs an ordered sequence of :class:`CleaningStep` over a DataFrame.

    The input DataFrame is copied once up front, so callers keep their original
    untouched and individual steps may mutate the working copy freely. An empty
    (or None) input short-circuits and is returned unchanged.
    """

    def __init__(self, steps: Sequence[CleaningStep]):
        self._steps: List[CleaningStep] = list(steps)

    @property
    def steps(self) -> List[CleaningStep]:
        return list(self._steps)

    def run(self, df: pd.DataFrame, ctx: CleaningContext) -> pd.DataFrame:
        """Apply every step in order and return the cleaned DataFrame."""
        if df is None or df.empty:
            return df

        result = df.copy()
        for step in self._steps:
            result = step.apply(result, ctx)
            logger.debug(
                "cleaning step %s -> %d rows x %d cols",
                step.name,
                len(result),
                result.shape[1],
            )
        return result


def build_download_pipeline() -> DataCleaningPipeline:
    """
    The standard cleaning order for data-export/download results.

    Order matters: numeric coercion first (so zero-column detection is
    accurate), then sort and dedup (which still rely on ``device_id``), then
    the ``device_id`` -> ``device_name`` rename, and NaN nullification last.
    """
    return DataCleaningPipeline(
        [
            CoerceNumericAndDropZeroColumns(),
            SortRecords(),
            DropOptionalColumns(),
            DropDuplicateRecords(),
            TagFrequency(),
            RenameDeviceIdToName(),
            NullifyNaN(),
        ]
    )
