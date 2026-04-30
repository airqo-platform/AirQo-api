"""Tests for CalibrationPreprocessor."""

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.calibration.preprocessor import CalibrationPreprocessor


class TestProcessLcs:
    def test_returns_datetime_index(self, lcs_raw_df):
        result = CalibrationPreprocessor.process_lcs(lcs_raw_df)
        assert isinstance(result.index, pd.DatetimeIndex)

    def test_computes_avg_and_error_pm2_5(self, lcs_raw_df):
        result = CalibrationPreprocessor.process_lcs(lcs_raw_df)
        expected_avg = (lcs_raw_df["s1_pm2_5"] + lcs_raw_df["s2_pm2_5"]) / 2
        # resampling happens later; check values exist
        assert "avg_pm2_5" in result.columns
        assert "error_pm2_5" in result.columns

    def test_computes_pm10_derived_columns(self, lcs_raw_df):
        result = CalibrationPreprocessor.process_lcs(lcs_raw_df)
        for col in ("avg_pm10", "error_pm10", "pm2_5_pm10", "pm2_5_pm10_mod"):
            assert col in result.columns, f"Missing column: {col}"

    def test_drops_rows_with_null_pm2_5(self):
        df = pd.DataFrame(
            {
                "device_id": ["A", "B", "C"],
                "timestamp": pd.date_range("2025-01-01", periods=3, freq="h", tz="UTC"),
                "s1_pm2_5": [10.0, np.nan, 15.0],
                "s2_pm2_5": [12.0, 11.0, np.nan],
            }
        )
        result = CalibrationPreprocessor.process_lcs(df)
        # Only the first row has both s1_pm2_5 and s2_pm2_5
        assert len(result) == 1

    def test_raises_on_missing_required_columns(self, lcs_raw_df_missing_cols):
        with pytest.raises(ValueError, match="missing required columns"):
            CalibrationPreprocessor.process_lcs(lcs_raw_df_missing_cols)

    def test_pm2_5_pm10_mod_not_inf(self, lcs_raw_df):
        result = CalibrationPreprocessor.process_lcs(lcs_raw_df)
        # Division by zero is replaced with NaN, not inf
        assert not np.isinf(result["pm2_5_pm10_mod"].dropna()).any()


class TestProcessBam:
    def test_renames_hourly_conc_to_bam_pm(self, bam_raw_df):
        result = CalibrationPreprocessor.process_bam(bam_raw_df)
        assert "bam_pm" in result.columns
        assert "hourly_conc" not in result.columns

    def test_accepts_pm2_5_column(self, bam_raw_df_pm2_5_col):
        result = CalibrationPreprocessor.process_bam(bam_raw_df_pm2_5_col)
        assert "bam_pm" in result.columns

    def test_filters_invalid_readings(self, bam_df_with_invalid_readings):
        result = CalibrationPreprocessor.process_bam(bam_df_with_invalid_readings)
        # Only the two valid rows (25.0 and 40.0) should survive
        assert len(result) == 2
        assert (result["bam_pm"] > 0).all()
        assert (result["bam_pm"] <= 500.4).all()

    def test_returns_empty_for_none_input(self):
        result = CalibrationPreprocessor.process_bam(None)
        assert result.empty

    def test_returns_empty_for_empty_df(self):
        result = CalibrationPreprocessor.process_bam(pd.DataFrame())
        assert result.empty

    def test_raises_when_no_pm_column(self):
        df = pd.DataFrame(
            {
                "device_id": ["BAM"],
                "timestamp": ["2025-01-01T00:00:00Z"],
                "wind_speed": [0.5],
            }
        )
        with pytest.raises(ValueError, match="no recognised PM2.5 column"):
            CalibrationPreprocessor.process_bam(df)

    def test_returns_datetime_index(self, bam_raw_df):
        result = CalibrationPreprocessor.process_bam(bam_raw_df)
        assert isinstance(result.index, pd.DatetimeIndex)


class TestBuildWideDataset:
    def test_merge_produces_bam_pm_column(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, bam_raw_df)
        assert "bam_pm" in result.columns

    def test_hour_feature_added(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, bam_raw_df)
        assert "hour" in result.columns
        assert result["hour"].between(0, 23).all()

    def test_no_null_bam_pm_in_output(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, bam_raw_df)
        assert not result["bam_pm"].isna().any()

    def test_returns_empty_for_empty_lcs(self, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(pd.DataFrame(), bam_raw_df)
        assert result.empty

    def test_returns_empty_for_empty_bam(self, lcs_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, pd.DataFrame())
        assert result.empty

    def test_tz_offset_shifts_timestamps(self, lcs_raw_df, bam_raw_df):
        result_no_offset = CalibrationPreprocessor.build_wide_dataset(
            lcs_raw_df, bam_raw_df, tz_offset_hours=0
        )
        result_offset = CalibrationPreprocessor.build_wide_dataset(
            lcs_raw_df, bam_raw_df, tz_offset_hours=1
        )
        # The offset version should have different (shifted) timestamps
        assert not result_no_offset["timestamp"].equals(result_offset["timestamp"])

    def test_timestamp_column_present(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, bam_raw_df)
        assert "timestamp" in result.columns

    def test_device_columns_are_prefixed(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(lcs_raw_df, bam_raw_df)
        prefixed = [c for c in result.columns if c.startswith("AQ_G5341_")]
        assert len(prefixed) > 0

    def test_bam_device_name_prefixes_extra_cols(self, lcs_raw_df, bam_raw_df):
        result = CalibrationPreprocessor.build_wide_dataset(
            lcs_raw_df, bam_raw_df, bam_device_name="BAM_MUK"
        )
        assert any(c.startswith("BAM_MUK_") for c in result.columns)
        assert "bam_pm" in result.columns  # target itself is never prefixed


class TestCleanData:
    def test_returns_empty_for_empty_lcs(self):
        result = CalibrationPreprocessor.clean_data(pd.DataFrame())
        assert result.empty

    def test_returns_datetime_index(self, lcs_raw_df):
        result = CalibrationPreprocessor.clean_data(lcs_raw_df)
        assert isinstance(result.index, pd.DatetimeIndex)

    def test_happy_path_returns_lcs_feature_columns(self, lcs_raw_df):
        result = CalibrationPreprocessor.clean_data(lcs_raw_df)
        assert not result.empty
        assert "avg_pm2_5" in result.columns
        assert "error_pm2_5" in result.columns
        assert "bam_pm" not in result.columns

    def test_out_of_range_lcs_pm25_removed(self):
        """Only the one row with valid PM values in both sensors survives."""
        ts = list(pd.date_range("2025-01-01", periods=5, freq="h", tz="UTC"))
        lcs = pd.DataFrame(
            {
                "device_id": ["A"] * 5,
                "timestamp": ts,
                "s1_pm2_5": [-5.0, np.nan, 30.0, 600.0, np.nan],
                "s2_pm2_5": [-5.0, np.nan, 28.0, 590.0, np.nan],
                "s1_pm10": [10.0] * 5,
                "s2_pm10": [10.0] * 5,
            }
        )
        result = CalibrationPreprocessor.clean_data(lcs)
        assert len(result) == 1

    def test_returns_empty_when_all_lcs_pm25_out_of_range(self):
        ts = list(pd.date_range("2025-01-01", periods=3, freq="h", tz="UTC"))
        lcs = pd.DataFrame(
            {
                "device_id": ["A"] * 3,
                "timestamp": ts,
                "s1_pm2_5": [-999.0, -1.0, 600.0],
                "s2_pm2_5": [-999.0, -1.0, 600.0],
            }
        )
        result = CalibrationPreprocessor.clean_data(lcs)
        assert result.empty


class TestBuildFeatureColumns:
    def test_returns_only_present_columns(self, merged_training_df):
        features = CalibrationPreprocessor.build_feature_columns(merged_training_df)
        for f in features:
            assert f in merged_training_df.columns

    def test_all_candidate_features_in_order(self, merged_training_df):
        features = CalibrationPreprocessor.build_feature_columns(merged_training_df)
        # All CANDIDATE_FEATURES that exist in merged_training_df should be returned
        expected = [
            c
            for c in CalibrationPreprocessor.CANDIDATE_FEATURES
            if c in merged_training_df.columns
        ]
        assert features == expected

    def test_empty_df_returns_empty_list(self):
        features = CalibrationPreprocessor.build_feature_columns(pd.DataFrame())
        assert features == []
