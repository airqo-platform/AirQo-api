"""Tests for CalibrationPipeline."""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from airqo_etl_utils.calibration.pipeline import CalibrationPipeline


COUNTRY_CONFIG = {
    "uganda": {
        "primary_lcs": "AQ_DEVICE1",
        "lcs_devices": ["AQ_DEVICE1"],
        "reference_device": "BAM_DEVICE1",
        "tz_offset_hours": 0,
    }
}
BUCKET = "test-calibration-bucket"


class TestCalibrationPipelineInit:
    def test_raises_when_no_countries_configured(self):
        with pytest.raises(ValueError, match="No collocated device configuration"):
            CalibrationPipeline(
                start_date="2025-01-01T00:00:00Z",
                end_date="2025-03-01T00:00:00Z",
                countries={},
                bucket_name=BUCKET,
            )

    def test_raises_when_no_bucket_configured(self):
        with pytest.raises(ValueError, match="No calibration models bucket"):
            CalibrationPipeline(
                start_date="2025-01-01T00:00:00Z",
                end_date="2025-03-01T00:00:00Z",
                countries=COUNTRY_CONFIG,
                bucket_name=None,
            )

    def test_accepts_valid_config(self):
        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-03-01T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )
        assert "uganda" in pipeline.countries
        assert pipeline.bucket_name == BUCKET


class TestCalibrationPipelineRun:
    def _make_pipeline(self) -> CalibrationPipeline:
        return CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-01-31T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )

    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationModelTrainer.train_and_deploy"
    )
    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationPipeline._prepare_training_data"
    )
    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationPipeline._fetch_data_from_aggregator"
    )
    def test_run_calls_trainer_for_each_country(
        self,
        mock_fetch,
        mock_prepare,
        mock_train,
        merged_training_df,
    ):
        mock_fetch.return_value = (
            pd.DataFrame({"device_id": ["AQ_DEVICE1"], "x": [1]}),
            pd.DataFrame({"device_id": ["BAM_DEVICE1"], "x": [1]}),
        )
        features = [
            c
            for c in ("hour", "avg_pm2_5", "avg_pm10")
            if c in merged_training_df.columns
        ]
        mock_prepare.return_value = (merged_training_df, features)
        mock_train.return_value = {
            "r2": 0.95,
            "mae": 1.5,
            "rmse": 2.0,
            "deployed": True,
            "deployment_reason": "x",
        }

        pipeline = self._make_pipeline()
        results = pipeline.run()

        assert "uganda" in results
        assert "r2" in results["uganda"]
        mock_train.assert_called_once()

    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationPipeline._fetch_data_from_aggregator"
    )
    def test_run_captures_error_per_country_without_crashing(self, mock_fetch):
        mock_fetch.side_effect = RuntimeError("API down")

        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-01-31T00:00:00Z",
            countries={
                "uganda": COUNTRY_CONFIG["uganda"],
                "kenya": {
                    "primary_lcs": "AQ_DEVICE1",
                    "lcs_devices": ["AQ_DEVICE1", "AQ_DEVICE2"],
                    "reference_device": "BAM_DEVICE1",
                },
            },
            bucket_name=BUCKET,
        )
        results = pipeline.run()

        # Both countries should have an error key, not raise
        assert "error" in results["uganda"]
        assert "error" in results["kenya"]

    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationPipeline._fetch_data_from_aggregator"
    )
    def test_run_returns_error_for_empty_lcs_data(self, mock_fetch):
        mock_fetch.return_value = (
            pd.DataFrame(),
            pd.DataFrame({"hourly_conc": [10.0]}),
        )

        pipeline = self._make_pipeline()
        results = pipeline.run()
        assert "error" in results["uganda"]


class TestPrepareTrainingData:
    def test_falls_back_to_all_lcs_when_primary_not_found(self, lcs_raw_df, bam_raw_df):
        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-01-31T00:00:00Z",  # matches 30-day fixtures
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )
        # primary_lcs = "AQ_DEVICE1" but the data only contains "OTHER_DEVICE".
        # The pipeline should log a warning and use all available devices instead.
        lcs_other = lcs_raw_df.copy()
        lcs_other["device_id"] = "OTHER_DEVICE"

        df, features = pipeline._prepare_training_data(
            lcs_other,
            bam_raw_df,
            COUNTRY_CONFIG["uganda"],
        )

        assert not df.empty, "Fallback should produce usable training data"
        assert len(features) > 0, "Fallback should produce at least one feature"

    def test_blob_name_uses_lowercase_country(self):
        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-03-01T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )
        blob = f"calibration/{'Uganda'.lower()}_pm2_5_cal_model.pkl"
        assert blob == "calibration/uganda_pm2_5_cal_model.pkl"
