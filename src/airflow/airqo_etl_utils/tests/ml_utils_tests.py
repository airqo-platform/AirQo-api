import pandas as pd
import pytest

from airqo_etl_utils.ml_utils import ForecastUtils as FUtils
from airqo_etl_utils.tests.conftest import ForecastFixtures


class TestsForecasts(ForecastFixtures):
    # Preprocess data tests
    def test_preprocess_data_typical_case(self, preprocessing_sample_df):
        result = FUtils.preprocess_data(preprocessing_sample_df, "daily")
        assert "pm2_5" in result.columns

    def test_preprocess_data_invalid_input(self, preprocessing_sample_df):
        df = preprocessing_sample_df.drop(columns=["device_id"])
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, "daily")

    def test_preprocess_data_invalid_timestamp(self, preprocessing_sample_df):
        df = preprocessing_sample_df.copy()
        df["timestamp"] = "invalid"
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, "daily")

    # Feature engineering tests
    # get_lag_and_rolling_features tests

    def test_empty_df(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_lag_and_roll_features(pd.DataFrame(), "pm2_5", "daily")

    def test_missing_columns(self, feat_eng_sample_df_daily):
        del feat_eng_sample_df_daily[
            "device_id"
        ]  # Test for case where 'device_id' is missing
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_lag_and_roll_features(feat_eng_sample_df_daily, "pm2_5", "daily")

    def test_invalid_frequency(self, feat_eng_sample_df_daily):
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_lag_and_roll_features(
                feat_eng_sample_df_daily, "pm2_5", "annually"
            )

    def test_hourly_freq(self, sample_hourly_dataframe):
        hourly_df = FUtils.get_lag_and_roll_features(
            sample_hourly_dataframe, "pm2_5", "hourly"
        )
        for s in [1, 2, 6, 12]:
            assert f"pm2_5_last_{s}_hour" in hourly_df.columns
        for s in [3, 6, 12, 24]:
            for f in ["mean", "std", "median", "skew"]:
                assert f"pm2_5_{f}_{s}_hour" in hourly_df.columns

    def test_daily_freq(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_lag_and_roll_features(
            feat_eng_sample_df_daily, "pm2_5", "daily"
        )
        for s in [1, 2, 3, 7, 14]:
            assert f"pm2_5_last_{s}_day" in daily_df.columns
        for s in [2, 3, 7, 14]:
            for f in ["mean", "std", "max", "min"]:
                assert f"pm2_5_{f}_{s}_day" in daily_df.columns

    def test_empty_df_for_time_and_cyclic_features(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_time_and_cyclic_features(pd.DataFrame(), "daily")

    def test_missing_columns_for_time_and_cyclic_features(self, feat_eng_sample_df_daily):
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_time_and_cyclic_features(feat_eng_sample_df_daily, "daily")

    def test_invalid_frequency_for_time_and_cyclic_features(self, feat_eng_sample_df_daily):
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_time_and_cyclic_features(feat_eng_sample_df_daily, "annually")

# For 'daily' frequency
    def test_daily_freq_for_time_and_cyclic_features(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_time_and_cyclic_features(feat_eng_sample_df_daily, "daily")
        for a in ["year", "month", "day", "dayofweek", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in daily_df.columns

# For 'hourly' frequency
    def test_hourly_freq_for_time_and_cyclic_features(self, feat_eng_sample_df_hourly):
        hourly_df = FUtils.get_time_and_cyclic_features(feat_eng_sample_df_hourly, "hourly")
        for a in ["year", "month", "day", "dayofweek", "hour", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in hourly_df.columns
