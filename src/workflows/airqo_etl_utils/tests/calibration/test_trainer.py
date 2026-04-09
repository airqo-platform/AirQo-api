"""Tests for CalibrationModelTrainer."""

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from airqo_etl_utils.calibration.trainer import CalibrationModelTrainer


# ------------------------------------------------------------------ #
# _fit_rf                                                              #
# ------------------------------------------------------------------ #


class TestFitRf:
    def test_returns_model_and_metrics(self):
        rng = np.random.default_rng(0)
        X = rng.uniform(0, 50, (100, 3))
        y = X[:, 0] * 0.5 + rng.normal(0, 2, 100)
        model, metrics = CalibrationModelTrainer._fit_rf(
            X[:80],
            y[:80],
            X[80:],
            y[80:],
            {"n_estimators": 10, "random_state": 0},
        )
        assert hasattr(model, "predict")
        for key in ("r2", "mae", "rmse", "n_train", "n_val"):
            assert key in metrics

    def test_n_train_n_val_correct(self):
        rng = np.random.default_rng(1)
        X = rng.uniform(0, 10, (60, 2))
        y = rng.uniform(0, 10, 60)
        _, metrics = CalibrationModelTrainer._fit_rf(
            X[:40],
            y[:40],
            X[40:],
            y[40:],
            {"n_estimators": 5, "random_state": 1},
        )
        assert metrics["n_train"] == 40
        assert metrics["n_val"] == 20


# ------------------------------------------------------------------ #
# train_and_deploy                                                     #
# ------------------------------------------------------------------ #


class TestTrainAndDeploy:
    @patch("airqo_etl_utils.calibration.trainer.MlflowTracker")
    @patch("airqo_etl_utils.calibration.trainer.ForecastModelTrainer._deploy_if_better")
    def test_returns_metrics_with_deployment_keys(
        self, mock_deploy, mock_tracker_cls, merged_training_df
    ):
        mock_deploy.return_value = {
            "deployed": True,
            "reason": "no_previous_model_metrics",
            "old_metrics": None,
        }
        mock_tracker_cls.return_value = MagicMock()

        features = [
            c
            for c in ("hour", "avg_pm2_5", "avg_pm10")
            if c in merged_training_df.columns
        ]
        result = CalibrationModelTrainer.train_and_deploy(
            merged_training_df,
            country="uganda",
            features=features,
            target="bam_pm",
            bucket_name="test-bucket",
            blob_name="calibration/uganda.pkl",
            rf_params={"n_estimators": 10, "random_state": 0},
        )
        assert "r2" in result
        assert "mae" in result
        assert "rmse" in result
        assert "deployed" in result
        assert "deployment_reason" in result

    @patch("airqo_etl_utils.calibration.trainer.MlflowTracker")
    @patch("airqo_etl_utils.calibration.trainer.ForecastModelTrainer._deploy_if_better")
    def test_deploy_if_better_called_with_correct_blob(
        self, mock_deploy, mock_tracker_cls, merged_training_df
    ):
        mock_deploy.return_value = {
            "deployed": False,
            "reason": "candidate_not_better",
            "old_metrics": {},
        }
        mock_tracker_cls.return_value = MagicMock()

        features = ["hour", "avg_pm2_5"]
        CalibrationModelTrainer.train_and_deploy(
            merged_training_df,
            country="kenya",
            features=features,
            target="bam_pm",
            bucket_name="my-bucket",
            blob_name="calibration/kenya.pkl",
            rf_params={"n_estimators": 10, "random_state": 0},
        )
        call_kwargs = mock_deploy.call_args.kwargs
        assert call_kwargs["bucket_name"] == "my-bucket"
        assert call_kwargs["blob_name"] == "calibration/kenya.pkl"

    @patch("airqo_etl_utils.calibration.trainer.MlflowTracker")
    @patch("airqo_etl_utils.calibration.trainer.ForecastModelTrainer._deploy_if_better")
    def test_mlflow_log_run_called_once(
        self, mock_deploy, mock_tracker_cls, merged_training_df
    ):
        mock_deploy.return_value = {
            "deployed": True,
            "reason": "no_previous_model_metrics",
            "old_metrics": None,
        }
        mock_instance = MagicMock()
        mock_tracker_cls.return_value = mock_instance

        features = ["hour", "avg_pm2_5"]
        CalibrationModelTrainer.train_and_deploy(
            merged_training_df,
            country="nigeria",
            features=features,
            target="bam_pm",
            bucket_name="b",
            blob_name="b.pkl",
            rf_params={"n_estimators": 10, "random_state": 0},
        )
        mock_instance.log_run.assert_called_once()

    @patch("airqo_etl_utils.calibration.trainer.MlflowTracker")
    @patch("airqo_etl_utils.calibration.trainer.ForecastModelTrainer._deploy_if_better")
    def test_raises_when_not_enough_data(self, mock_deploy, mock_tracker_cls):
        """Only 5 rows — below the min_rows=50 threshold."""
        mock_deploy.return_value = {
            "deployed": False,
            "reason": "x",
            "old_metrics": None,
        }
        tiny_df = pd.DataFrame(
            {
                "timestamp": pd.date_range("2025-01-01", periods=5, freq="h", tz="UTC"),
                "hour": range(5),
                "avg_pm2_5": [10.0] * 5,
                "bam_pm": [12.0] * 5,
            }
        )
        with pytest.raises(ValueError):
            CalibrationModelTrainer.train_and_deploy(
                tiny_df,
                country="test",
                features=["hour", "avg_pm2_5"],
                target="bam_pm",
                bucket_name="b",
                blob_name="b.pkl",
            )

    @patch("airqo_etl_utils.calibration.trainer.MlflowTracker")
    @patch("airqo_etl_utils.calibration.trainer.ForecastModelTrainer._deploy_if_better")
    def test_default_rf_params_used_when_none_given(
        self, mock_deploy, mock_tracker_cls, merged_training_df
    ):
        mock_deploy.return_value = {
            "deployed": True,
            "reason": "no_previous_model_metrics",
            "old_metrics": None,
        }
        mock_tracker_cls.return_value = MagicMock()

        features = ["hour", "avg_pm2_5"]
        result = CalibrationModelTrainer.train_and_deploy(
            merged_training_df,
            country="ghana",
            features=features,
            target="bam_pm",
            bucket_name="b",
            blob_name="b.pkl",
        )
        # Should complete without error using defaults
        assert "r2" in result
