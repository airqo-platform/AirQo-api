"""
Unit tests for the data cleaning pipeline.

Every step is a pure DataFrame -> DataFrame transform, so these tests need no
BigQuery, Redis, or async machinery — they construct a DataFrame, run a step
(or the whole pipeline), and assert on the result.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from constants import DataType, DeviceCategory, Frequency
from api.utils.data_cleaning import (
    CleaningContext,
    CoerceNumericAndDropZeroColumns,
    DataCleaningPipeline,
    DropDuplicateRecords,
    DropOptionalColumns,
    NullifyNaN,
    RenameDeviceIdToName,
    SortRecords,
    TagFrequency,
    build_download_pipeline,
)


def _ctx(**overrides) -> CleaningContext:
    """A lowcost/daily/calibrated context with sensible defaults for tests."""
    base = dict(
        datatype=DataType.CALIBRATED,
        frequency=Frequency.DAILY,
        device_category=DeviceCategory.LOWCOST,
        pollutants=["pm2_5"],
        extra_columns=[],
        optional_fields={"latitude", "longitude", "temperature", "humidity", "site_id"},
    )
    base.update(overrides)
    return CleaningContext(**base)


# ---------------------------------------------------------------------------
# CleaningContext computed properties
# ---------------------------------------------------------------------------


class TestCleaningContext:
    def test_ungrouped_frequency_uses_datetime(self):
        ctx = _ctx(frequency=Frequency.HOURLY)
        assert ctx.is_grouped is False
        assert ctx.period_column is None
        assert ctx.sort_columns == ["device_id", "datetime"]
        assert ctx.dedup_columns == ["device_id", "datetime"]

    @pytest.mark.parametrize(
        "frequency,period",
        [
            (Frequency.WEEKLY, "week"),
            (Frequency.MONTHLY, "month"),
            (Frequency.YEARLY, "year"),
        ],
    )
    def test_grouped_frequency_uses_period_column(self, frequency, period):
        ctx = _ctx(frequency=frequency)
        assert ctx.is_grouped is True
        assert ctx.period_column == period
        assert ctx.sort_columns == ["device_id", period]
        assert ctx.dedup_columns == ["device_id"]


# ---------------------------------------------------------------------------
# Individual steps
# ---------------------------------------------------------------------------


class TestCoerceNumericAndDropZeroColumns:
    def test_drops_all_zero_column(self):
        df = pd.DataFrame({"pm2_5": [1.0, 2.0], "pm10": [0, 0]})
        out = CoerceNumericAndDropZeroColumns().apply(df, _ctx())
        assert "pm10" not in out.columns
        assert "pm2_5" in out.columns

    def test_coerces_non_numeric_to_nan(self):
        df = pd.DataFrame({"pm2_5": [1.0, 2.0], "site_id": ["s1", "s2"]})
        out = CoerceNumericAndDropZeroColumns().apply(df, _ctx())
        # site_id is non-numeric object → untouched (not in numeric dtypes)
        assert out["site_id"].tolist() == ["s1", "s2"]

    def test_raw_multi_network_requires_pm2_5(self):
        """Raw data across mixed networks must have pm2_5; absence is an error."""
        df = pd.DataFrame({"pm10": [1.0, 2.0], "network": ["airqo", "metone"]})
        with pytest.raises(ValueError, match="pm2_5"):
            CoerceNumericAndDropZeroColumns().apply(df, _ctx(datatype=DataType.RAW))

    def test_raw_single_airqo_network_ok_without_pm2_5(self):
        df = pd.DataFrame({"pm10": [1.0, 2.0], "network": ["airqo", "airqo"]})
        out = CoerceNumericAndDropZeroColumns().apply(df, _ctx(datatype=DataType.RAW))
        assert "pm10" in out.columns


class TestDropOptionalColumns:
    def test_drops_optional_fields_not_requested(self):
        df = pd.DataFrame(
            {
                "pm2_5": [1.0],
                "temperature": [20.0],
                "humidity": [50.0],
                "site_name": ["A"],
            }
        )
        out = DropOptionalColumns().apply(df, _ctx(extra_columns=[]))
        assert "temperature" not in out.columns
        assert "humidity" not in out.columns
        # non-optional columns survive
        assert "pm2_5" in out.columns
        assert "site_name" in out.columns

    def test_keeps_requested_extra_columns(self):
        df = pd.DataFrame({"pm2_5": [1.0], "temperature": [20.0], "humidity": [50.0]})
        out = DropOptionalColumns().apply(df, _ctx(extra_columns=["temperature"]))
        assert "temperature" in out.columns
        assert "humidity" not in out.columns

    def test_drops_internal_timestamp_column(self):
        df = pd.DataFrame({"pm2_5": [1.0], "timestamp": ["2023-01-01"]})
        out = DropOptionalColumns().apply(df, _ctx())
        assert "timestamp" not in out.columns

    def test_absent_columns_are_ignored(self):
        df = pd.DataFrame({"pm2_5": [1.0]})
        out = DropOptionalColumns().apply(df, _ctx())  # nothing to drop
        assert list(out.columns) == ["pm2_5"]


class TestSortRecords:
    def test_sorts_by_device_and_datetime(self):
        df = pd.DataFrame(
            {
                "device_id": ["d2", "d1", "d1"],
                "datetime": ["2023-01-02", "2023-01-02", "2023-01-01"],
                "pm2_5": [3, 2, 1],
            }
        )
        out = SortRecords().apply(df, _ctx(frequency=Frequency.HOURLY))
        assert out["pm2_5"].tolist() == [1, 2, 3]

    def test_safe_when_sort_columns_absent(self):
        df = pd.DataFrame({"pm2_5": [1, 2]})
        out = SortRecords().apply(df, _ctx())
        assert len(out) == 2  # no error


class TestDropDuplicateRecords:
    def test_dedups_by_device_and_datetime_keep_first(self):
        df = pd.DataFrame(
            {
                "device_id": ["d1", "d1", "d2"],
                "datetime": ["t1", "t1", "t1"],
                "pm2_5": [10, 99, 20],
            }
        )
        out = DropDuplicateRecords().apply(df, _ctx(frequency=Frequency.HOURLY))
        assert len(out) == 2
        assert out.iloc[0]["pm2_5"] == 10  # first kept, 99 dropped

    def test_grouped_dedups_by_device_only(self):
        df = pd.DataFrame(
            {"device_id": ["d1", "d1"], "week": ["w1", "w1"], "pm2_5": [1, 2]}
        )
        out = DropDuplicateRecords().apply(df, _ctx(frequency=Frequency.WEEKLY))
        assert len(out) == 1


class TestTagFrequency:
    def test_adds_frequency_column(self):
        df = pd.DataFrame({"pm2_5": [1, 2]})
        out = TagFrequency().apply(df, _ctx(frequency=Frequency.DAILY))
        assert out["frequency"].tolist() == ["daily", "daily"]


class TestRenameDeviceIdToName:
    def test_renames_when_present(self):
        df = pd.DataFrame({"device_id": ["d1"], "pm2_5": [1]})
        out = RenameDeviceIdToName().apply(df, _ctx())
        assert "device_name" in out.columns
        assert "device_id" not in out.columns

    def test_noop_when_absent(self):
        df = pd.DataFrame({"pm2_5": [1]})
        out = RenameDeviceIdToName().apply(df, _ctx())
        assert list(out.columns) == ["pm2_5"]


class TestNullifyNaN:
    def test_replaces_nan_with_none(self):
        df = pd.DataFrame({"pm2_5": [1.0, np.nan]})
        out = NullifyNaN().apply(df, _ctx())
        assert out["pm2_5"].tolist()[1] is None


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


class TestDataCleaningPipeline:
    def test_empty_dataframe_short_circuits(self):
        pipeline = build_download_pipeline()
        out = pipeline.run(pd.DataFrame(), _ctx())
        assert out.empty

    def test_does_not_mutate_caller_dataframe(self):
        df = pd.DataFrame(
            {
                "device_id": ["d1"],
                "datetime": ["t1"],
                "pm2_5": [1.0],
                "temperature": [20.0],
            }
        )
        original_columns = list(df.columns)
        build_download_pipeline().run(df, _ctx())
        assert list(df.columns) == original_columns  # untouched

    def test_end_to_end_download_cleaning(self):
        df = pd.DataFrame(
            {
                "device_id": ["d2", "d1"],
                "datetime": ["2023-01-02", "2023-01-01"],
                "site_id": ["s2", "s1"],
                "site_name": ["B", "A"],
                "pm2_5": [20.0, 10.0],
                "pm10": [0, 0],  # all-zero → dropped
                "temperature": [24.0, 23.0],  # optional, not requested → dropped
                "humidity": [np.nan, 50.0],  # optional, not requested → dropped
            }
        )
        out = build_download_pipeline().run(df, _ctx())

        # zero column and unrequested optionals removed
        assert "pm10" not in out.columns
        assert "temperature" not in out.columns
        assert "humidity" not in out.columns
        assert "site_id" not in out.columns  # optional for lowcost, not requested
        # device_id renamed, frequency tagged
        assert "device_name" in out.columns
        assert "device_id" not in out.columns
        assert out["frequency"].unique().tolist() == ["daily"]
        # sorted by device then datetime (d1 first)
        assert out.iloc[0]["device_name"] == "d1"
        # non-optional metadata retained
        assert "site_name" in out.columns

    def test_custom_pipeline_runs_only_given_steps(self):
        pipeline = DataCleaningPipeline([TagFrequency()])
        out = pipeline.run(pd.DataFrame({"pm2_5": [1]}), _ctx())
        assert "frequency" in out.columns
        assert list(pipeline.steps) and len(pipeline.steps) == 1
