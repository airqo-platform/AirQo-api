import io
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import joblib
import numpy as np
import pandas as pd


MODEL_PATH = Path(__file__).parents[1] / "models" / "calibrate_tool.py"
SPEC = importlib.util.spec_from_file_location("gcs_calibrate_tool", MODEL_PATH)
gcs_calibrate_tool = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gcs_calibrate_tool)


class FakeModel:
    def predict(self, features):
        return np.full(len(features), 12.345)


class GcsCalibrationModelTestCase(unittest.TestCase):
    def setUp(self):
        gcs_calibrate_tool._load_model_artifact.cache_clear()

    def test_loads_country_artifact_from_expected_gcs_blob(self):
        artifact_bytes = io.BytesIO()
        joblib.dump(
            {"model": FakeModel(), "features": ["hour", "avg_pm2_5"]},
            artifact_bytes,
        )
        blob = Mock()
        blob.download_as_bytes.return_value = artifact_bytes.getvalue()
        bucket = Mock()
        bucket.blob.return_value = blob
        client = Mock()
        client.bucket.return_value = bucket

        with patch.object(gcs_calibrate_tool.storage, "Client", return_value=client):
            regression = gcs_calibrate_tool.Regression(country="Uganda")

        client.bucket.assert_called_once_with("calibration_training_bucket")
        bucket.blob.assert_called_once_with(
            "calibration/uganda_pm2_5_cal_model.pkl"
        )
        self.assertEqual(regression.features, ["hour", "avg_pm2_5"])

    def test_defaults_to_uganda_model_when_country_is_omitted(self):
        self.assertEqual(gcs_calibrate_tool._normalise_country(None), "uganda")
        self.assertEqual(
            gcs_calibrate_tool._model_blob_name(
                gcs_calibrate_tool._normalise_country(None)
            ),
            "calibration/uganda_pm2_5_cal_model.pkl",
        )

    def test_uses_artifact_features_to_calibrate_pm25(self):
        regression = object.__new__(gcs_calibrate_tool.Regression)
        regression.model = FakeModel()
        regression.features = ["hour", "avg_pm2_5", "pm2_5_pm10_mod"]
        dataframe = pd.DataFrame(
            {
                "created_at": ["2026-01-01T05:00:00Z"],
                "sensor_1_pm25": [10],
                "sensor_2_pm25": [14],
                "sensor_1_pm10": [20],
                "sensor_2_pm10": [24],
                "rh": [60],
                "temp": [25],
            }
        )
        mapping = {
            "created_at": "datetime",
            "sensor_1_pm25": "pm2_5",
            "sensor_2_pm25": "s2_pm2_5",
            "sensor_1_pm10": "pm10",
            "sensor_2_pm10": "s2_pm10",
            "rh": "humidity",
            "temp": "temperature",
        }

        result = regression.compute_calibrated_val(mapping, dataframe)

        self.assertEqual(result["calibrated_pm2_5"].iloc[0], 12.34)
        self.assertEqual(result["avg_pm2_5"].iloc[0], 12)

    def test_accepts_pre_averaged_pm25_and_uses_zero_sensor_error(self):
        class CapturingModel:
            def __init__(self):
                self.features = None

            def predict(self, features):
                self.features = features.copy()
                return np.array([9.876])

        regression = object.__new__(gcs_calibrate_tool.Regression)
        regression.model = CapturingModel()
        regression.features = ["hour", "avg_pm2_5", "error_pm2_5"]
        dataframe = pd.DataFrame(
            {
                "created_at": ["2026-01-01T05:00:00Z"],
                "average_pm25": [11.5],
                "sensor_1_pm10": [20],
                "sensor_2_pm10": [24],
                "rh": [60],
                "temp": [25],
            }
        )
        mapping = {
            "created_at": "datetime",
            "average_pm25": "avg_pm2_5",
            "sensor_1_pm10": "pm10",
            "sensor_2_pm10": "s2_pm10",
            "rh": "humidity",
            "temp": "temperature",
        }

        result = regression.compute_calibrated_val(mapping, dataframe)

        self.assertEqual(result["avg_pm2_5"].iloc[0], 11.5)
        self.assertEqual(regression.model.features["error_pm2_5"].iloc[0], 0)
        self.assertEqual(result["calibrated_pm2_5"].iloc[0], 9.88)


if __name__ == "__main__":
    unittest.main()
