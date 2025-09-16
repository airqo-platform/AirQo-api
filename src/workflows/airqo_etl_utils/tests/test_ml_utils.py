import pandas as pd
import pytest
from unittest.mock import MagicMock

from airqo_etl_utils.ml_utils import BaseMlUtils as FUtils
from airqo_etl_utils.tests.conftest import ForecastFixtures
from airqo_etl_utils.constants import Frequency


class TestsForecasts(ForecastFixtures):
    # Preprocess data tests
    def test_preprocess_data_typical_case(self, preprocessing_sample_df):
        result = FUtils.preprocess_data(
            preprocessing_sample_df, Frequency.DAILY, "training"
        )
        assert "pm2_5" in result.columns

    def test_preprocess_data_invalid_input(self, preprocessing_sample_df):
        df = preprocessing_sample_df.drop(columns=["device_id"])
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, Frequency.DAILY, "training")

    def test_preprocess_data_invalid_timestamp(self, preprocessing_sample_df):
        df = preprocessing_sample_df.copy()
        df["timestamp"] = "invalid"
        with pytest.raises(ValueError):
            FUtils.preprocess_data(df, Frequency.DAILY, "training")

    # Feature engineering tests
    # get_lag_and_rolling_features tests

    def test_empty_df(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_lag_and_roll_features(pd.DataFrame(), "pm2_5", Frequency.DAILY)

    def test_missing_columns(self, feat_eng_sample_df_daily):
        del feat_eng_sample_df_daily[
            "device_id"
        ]  # Test for case where 'device_id' is missing
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_lag_and_roll_features(
                feat_eng_sample_df_daily, "pm2_5", Frequency.DAILY
            )

    def test_invalid_frequency(self, feat_eng_sample_df_daily):
        # Create a mock frequency object with an invalid value
        mock_freq = MagicMock()
        mock_freq.str = (
            "annually"  # This value doesn't exist in the function's if/elif conditions
        )
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_lag_and_roll_features(
                feat_eng_sample_df_daily, "pm2_5", mock_freq
            )

    def test_hourly_freq(self, feat_eng_sample_df_hourly):
        hourly_df = FUtils.get_lag_and_roll_features(
            feat_eng_sample_df_hourly, "pm2_5", Frequency.HOURLY
        )
        for s in [1, 2, 6, 12]:
            assert f"pm2_5_last_{s}_hour" in hourly_df.columns
        for s in [3, 6, 12, 24]:
            for f in ["mean", "std", "median", "skew"]:
                assert f"pm2_5_{f}_{s}_hour" in hourly_df.columns

    def test_daily_freq(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_lag_and_roll_features(
            feat_eng_sample_df_daily, "pm2_5", Frequency.DAILY
        )
        # Based on the actual implementation, we expect these lag values
        for s in [1, 2, 3, 7]:
            assert f"pm2_5_last_{s}_day" in daily_df.columns
        # Based on the actual implementation, we expect these rolling statistics
        for s in [2, 3, 7]:
            for f in ["mean", "std", "max", "min"]:
                assert f"pm2_5_{f}_{s}_day" in daily_df.columns

    def test_empty_df_for_cyclic_features(self):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_cyclic_features(pd.DataFrame(), Frequency.DAILY)

    def test_missing_columns_for_cyclic_features(self, feat_eng_sample_df_daily):
        # First create a dataframe without timestamp
        df_without_timestamp = feat_eng_sample_df_daily.drop(columns=["timestamp"])
        with pytest.raises(ValueError, match="Required columns missing"):
            FUtils.get_cyclic_features(df_without_timestamp, Frequency.DAILY)

    def test_invalid_frequency_for_cyclic_features(self, feat_eng_sample_df_daily):
        # Create a mock frequency object with an invalid value
        mock_freq = MagicMock()
        mock_freq.str = (
            "annually"  # This value doesn't exist in the function's if/elif conditions
        )
        with pytest.raises(ValueError, match="Invalid frequency"):
            FUtils.get_cyclic_features(feat_eng_sample_df_daily, mock_freq)

    # For 'daily' frequency
    def test_daily_freq_for_cyclic_features(self, feat_eng_sample_df_daily):
        daily_df = FUtils.get_cyclic_features(feat_eng_sample_df_daily, Frequency.DAILY)
        for a in ["year", "month", "day", "dayofweek", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in daily_df.columns

    # For 'hourly' frequency
    def test_hourly_freq_for_cyclic_features(self, feat_eng_sample_df_hourly):
        hourly_df = FUtils.get_cyclic_features(
            feat_eng_sample_df_hourly, Frequency.HOURLY
        )
        for a in ["year", "month", "day", "dayofweek", "hour", "week"]:
            for t in ["_sin", "_cos"]:
                assert f"{a}{t}" in hourly_df.columns

    def test_empty_df_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        with pytest.raises(ValueError, match="Empty dataframe provided"):
            FUtils.get_location_features(pd.DataFrame())

    def test_missing_timestamp_for_location_features(
        self,
        sample_dataframe_for_location_features,
    ):
        del sample_dataframe_for_location_features["timestamp"]
        with pytest.raises(ValueError, match="timestamp column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    # For missing 'latitude' column
    def test_missing_latitude_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        del sample_dataframe_for_location_features[
            "latitude"
        ]  # Test for missing 'latitude'
        with pytest.raises(ValueError, match="latitude column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    def test_missing_longitude_for_location_features(
        self, sample_dataframe_for_location_features
    ):
        del sample_dataframe_for_location_features[
            "longitude"
        ]  # Test for missing 'longitude'
        with pytest.raises(ValueError, match="longitude column is missing"):
            FUtils.get_location_features(sample_dataframe_for_location_features)

    # Test the normal procedure
    def test_get_location_features(self, sample_dataframe_for_location_features):
        df = FUtils.get_location_features(sample_dataframe_for_location_features)
        for cord in ["x_cord", "y_cord", "z_cord"]:
            assert cord in df.columns

    @pytest.mark.xfail
    @pytest.mark.parametrize(
        "frequency,collection_name",
        [
            ("hourly", "hourly_forecasts"),
            ("daily", "daily_forecasts"),
            # ("invalid", None),
        ],
    )
    def test_save_forecasts_to_mongo_frequency(
        self, mock_db, frequency, collection_name, sample_dataframe_db
    ):
        if frequency == "invalid":
            # Expect a ValueError for an invalid frequency
            with pytest.raises(ValueError) as e:
                FUtils.save_forecasts_to_mongo(sample_dataframe_db, frequency)
            assert str(e.value) == f"Invalid frequency argument: {frequency}"
        else:
            # Expect no exception for a valid frequency
            FUtils.save_forecasts_to_mongo(sample_dataframe_db, frequency)
            mock_collection = getattr(mock_db, collection_name)
            assert mock_collection.update_one.call_count == 0
