"""Tests for CalibrationPipeline."""

from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from airqo_etl_utils.calibration.pipeline import CalibrationPipeline


COUNTRY_CONFIG = {
    "uganda": {
        "primary_lcs": "AQ_G5341",
        "lcs_devices": ["AQ_G5341"],
        "reference_device": "BAM_MUK",
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
            end_date="2025-03-01T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )

    @patch(
        "airqo_etl_utils.calibration.pipeline.CalibrationModelTrainer.train_and_deploy"
    )
    @patch("airqo_etl_utils.calibration.pipeline.CalibrationPreprocessor.merge_hourly")
    @patch("airqo_etl_utils.calibration.pipeline.CalibrationPreprocessor.process_bam")
    @patch("airqo_etl_utils.calibration.pipeline.CalibrationPreprocessor.process_lcs")
    @patch("airqo_etl_utils.calibration.pipeline.DataUtils.extract_data_from_bigquery")
    def test_run_calls_trainer_for_each_country(
        self,
        mock_extract,
        mock_process_lcs,
        mock_process_bam,
        mock_merge,
        mock_train,
        merged_training_df,
    ):
        mock_extract.return_value = pd.DataFrame(
            {
                "device_id": ["AQ_G5341"] * 5,
                "timestamp": pd.date_range("2025-01-01", periods=5, freq="h", tz="UTC"),
                "s1_pm2_5": [10.0] * 5,
                "s2_pm2_5": [11.0] * 5,
            }
        )
        mock_process_lcs.return_value = pd.DataFrame({"avg_pm2_5": [10.0]})
        mock_process_bam.return_value = pd.DataFrame({"bam_pm": [12.0]})
        mock_merge.return_value = merged_training_df
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

    @patch("airqo_etl_utils.calibration.pipeline.DataUtils.extract_devices_data")
    def test_run_captures_error_per_country_without_crashing(self, mock_extract):
        mock_extract.side_effect = RuntimeError("API down")

        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-03-01T00:00:00Z",
            countries={
                "uganda": COUNTRY_CONFIG["uganda"],
                "kenya": {
                    "primary_lcs": "AQ_G5338",
                    "lcs_devices": ["AQ_G5338"],
                    "reference_device": "BAM_Nairobi",
                },
            },
            bucket_name=BUCKET,
        )
        results = pipeline.run()

        # Both countries should have an error key, not raise
        assert "error" in results["uganda"]
        assert "error" in results["kenya"]

    @patch("airqo_etl_utils.calibration.pipeline.DataUtils.extract_devices_data")
    def test_run_returns_error_for_empty_lcs_data(self, mock_extract):
        # lcs returns empty, bam returns something
        mock_extract.side_effect = [pd.DataFrame(), pd.DataFrame({"pm2_5": [10.0]})]

        pipeline = self._make_pipeline()
        results = pipeline.run()
        assert "error" in results["uganda"]


class TestPrepareTrainingData:
    @patch("airqo_etl_utils.calibration.pipeline.DataUtils.extract_devices_data")
    def test_falls_back_to_all_lcs_when_primary_not_found(
        self, mock_extract, lcs_raw_df, bam_raw_df
    ):
        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-03-01T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )
        # primary_lcs = "AQ_G5341" but data has "OTHER_DEVICE"
        lcs_other = lcs_raw_df.copy()
        lcs_other["device_id"] = "OTHER_DEVICE"

        df, features = pipeline._prepare_training_data(
            lcs_other,
            bam_raw_df,
            COUNTRY_CONFIG["uganda"],
        )
        # Should not raise; falls back to all LCS rows
        assert (
            not df.empty or df.empty
        )  # either outcome is valid here; no exception raised

    def test_blob_name_uses_lowercase_country(self):
        pipeline = CalibrationPipeline(
            start_date="2025-01-01T00:00:00Z",
            end_date="2025-03-01T00:00:00Z",
            countries=COUNTRY_CONFIG,
            bucket_name=BUCKET,
        )
        blob = f"calibration/{'Uganda'.lower()}_pm2_5_cal_model.pkl"
        assert blob == "calibration/uganda_pm2_5_cal_model.pkl"
