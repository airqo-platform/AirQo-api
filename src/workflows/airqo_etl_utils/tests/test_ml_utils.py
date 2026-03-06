import pandas as pd
import pytest
import numpy as np
from unittest.mock import MagicMock

from airqo_etl_utils.ml_utils import BaseMlUtils as FUtils, ForecastUtils
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
        for s in [1, 2, 6, 12, 24, 48, 72, 168]:
            assert f"pm2_5_last_{s}_hour" in hourly_df.columns
        for s in [3, 6, 12, 24, 48, 72, 168]:
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

    def test_generate_hourly_forecasts_for_next_7_days(self, monkeypatch):
        timestamps = pd.date_range("2025-01-01", periods=24 * 12, freq="h")
        historical_data = pd.DataFrame(
            {
                "site_id": ["site-a"] * len(timestamps),
                "device_id": ["device-a"] * len(timestamps),
                "device_number": [12345] * len(timestamps),
                "timestamp": timestamps,
                "pm2_5": np.linspace(10, 20, len(timestamps)),
                "latitude": [0.234] * len(timestamps),
                "longitude": [32.564] * len(timestamps),
            }
        )

        featured = FUtils.get_lag_and_roll_features(
            historical_data.copy(), "pm2_5", Frequency.HOURLY
        )
        featured = FUtils.get_cyclic_features(featured, Frequency.HOURLY)
        featured = FUtils.get_location_features(featured)
        excluded = {
            "device_id",
            "site_id",
            "device_number",
            "pm2_5",
            "timestamp",
            "latitude",
            "longitude",
        }
        trained_features = [col for col in featured.columns if col not in excluded]

        class DummyModel:
            def predict(self, X):
                return np.full(len(X), 23.5, dtype=float)

        class MockStorage:
            def load_file_object(self, bucket, source_file):
                return {"model": DummyModel(), "features": trained_features}

        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.GCSFileStorage", lambda: MockStorage()
        )

        forecasts = ForecastUtils.generate_forecasts(
            data=historical_data,
            project_name="demo-project",
            bucket_name="demo-bucket",
            frequency=Frequency.HOURLY,
            horizon=24 * 7,
        )

        assert len(forecasts) == 24 * 7
        assert forecasts["timestamp"].is_monotonic_increasing
        assert (
            forecasts["timestamp"].diff().dropna() == pd.Timedelta(hours=1)
        ).all()
        assert forecasts["timestamp"].iloc[0] == historical_data["timestamp"].max() + pd.Timedelta(hours=1)
        assert (forecasts["pm2_5"] == 23.5).all()

    def test_train_and_save_hourly_forecast_model_logs_mlflow(self, monkeypatch):
        def _device_rows(device_id: str, device_number: int) -> pd.DataFrame:
            ts = pd.date_range("2025-01-01", periods=24 * 30, freq="h")
            values = np.sin(np.linspace(0, 18, len(ts))) * 7 + 24
            return pd.DataFrame(
                {
                    "device_id": [device_id] * len(ts),
                    "device_number": [device_number] * len(ts),
                    "timestamp": ts,
                    "pm2_5": values,
                    "latitude": [0.234] * len(ts),
                    "longitude": [32.564] * len(ts),
                }
            )

        raw_training_data = pd.concat(
            [_device_rows("device-a", 12345), _device_rows("device-b", 67890)],
            ignore_index=True,
        )
        featured_training_data = FUtils.get_lag_and_roll_features(
            raw_training_data, "pm2_5", Frequency.HOURLY
        )
        featured_training_data = FUtils.get_cyclic_features(
            featured_training_data, Frequency.HOURLY
        )
        featured_training_data = FUtils.get_location_features(featured_training_data)

        class DummyRegressor:
            def __init__(self, **kwargs):
                self.best_iteration_ = 15

            def fit(self, X, y, eval_set=None, eval_metric=None, callbacks=None):
                return self

            def predict(self, X):
                return np.full(len(X), 24.0, dtype=float)

        saved_artifact = {}
        logged_run = {}

        class MockStorage:
            def save_file_object(self, bucket, obj, destination_file):
                saved_artifact["bucket"] = bucket
                saved_artifact["obj"] = obj
                saved_artifact["destination_file"] = destination_file

        class MockTracker:
            def __init__(self, **kwargs):
                logged_run["tracker_init"] = kwargs

            def log_run(self, **kwargs):
                logged_run["run"] = kwargs

        monkeypatch.setattr("airqo_etl_utils.ml_utils.LGBMRegressor", DummyRegressor)
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.GCSFileStorage", lambda: MockStorage()
        )
        monkeypatch.setattr("airqo_etl_utils.ml_utils.MlflowTracker", MockTracker)
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.configuration.HOURLY_FORECAST_HORIZON",
            "168",
            raising=False,
        )
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.configuration.FORECAST_MODELS_BUCKET",
            "test-forecast-bucket",
            raising=False,
        )
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.configuration.MLFLOW_HOURLY_EXPERIMENT_NAME",
            "/Shared/hourly_forecast_model_development",
            raising=False,
        )
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.configuration.MLFLOW_EXPERIMENT_NAME",
            "/Shared/fallback_experiment",
            raising=False,
        )

        metrics = ForecastUtils.train_and_save_forecast_models(
            featured_training_data, Frequency.HOURLY
        )

        assert saved_artifact["destination_file"] == "hourly_forecast_model.pkl"
        assert saved_artifact["obj"]["horizon"] == 168
        assert metrics["horizon"] == 168
        assert metrics["deployed"] is True
        assert logged_run["run"]["tags"]["frequency"] == "hourly"
        assert logged_run["run"]["fail_run"] is False
        assert (
            logged_run["tracker_init"]["experiment_name"]
            == "/Shared/hourly_forecast_model_development"
        )

    def test_hourly_training_marks_mlflow_failed_when_not_deployed(self, monkeypatch):
        def _device_rows(device_id: str, device_number: int) -> pd.DataFrame:
            ts = pd.date_range("2025-01-01", periods=24 * 30, freq="h")
            values = np.sin(np.linspace(0, 18, len(ts))) * 7 + 24
            return pd.DataFrame(
                {
                    "device_id": [device_id] * len(ts),
                    "device_number": [device_number] * len(ts),
                    "timestamp": ts,
                    "pm2_5": values,
                    "latitude": [0.234] * len(ts),
                    "longitude": [32.564] * len(ts),
                }
            )

        raw_training_data = pd.concat(
            [_device_rows("device-a", 12345), _device_rows("device-b", 67890)],
            ignore_index=True,
        )
        featured_training_data = FUtils.get_lag_and_roll_features(
            raw_training_data, "pm2_5", Frequency.HOURLY
        )
        featured_training_data = FUtils.get_cyclic_features(
            featured_training_data, Frequency.HOURLY
        )
        featured_training_data = FUtils.get_location_features(featured_training_data)

        class DummyRegressor:
            def __init__(self, **kwargs):
                self.best_iteration_ = 15

            def fit(self, X, y, eval_set=None, eval_metric=None, callbacks=None):
                return self

            def predict(self, X):
                return np.full(len(X), 24.0, dtype=float)

        logged_run = {}

        class MockTracker:
            def __init__(self, **kwargs):
                logged_run["tracker_init"] = kwargs

            def log_run(self, **kwargs):
                logged_run["run"] = kwargs

        monkeypatch.setattr("airqo_etl_utils.ml_utils.LGBMRegressor", DummyRegressor)
        monkeypatch.setattr("airqo_etl_utils.ml_utils.MlflowTracker", MockTracker)
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.ForecastModelTrainer._deploy_if_better",
            lambda **kwargs: {
                "deployed": False,
                "reason": "candidate_not_better_than_best_historical",
                "old_metrics": {"r2": 0.5, "mae": 1.0, "rmse": 1.2},
            },
        )
        monkeypatch.setattr(
            "airqo_etl_utils.ml_utils.configuration.FORECAST_MODELS_BUCKET",
            "test-forecast-bucket",
            raising=False,
        )

        metrics = ForecastUtils.train_and_save_forecast_models(
            featured_training_data, Frequency.HOURLY
        )

        assert metrics["deployed"] is False
        assert metrics["deployment_reason"] == "candidate_not_better_than_best_historical"
        assert logged_run["run"]["fail_run"] is True
        assert (
            logged_run["run"]["tags"]["decision_reason"]
            == "candidate_not_better_than_best_historical"
        )
