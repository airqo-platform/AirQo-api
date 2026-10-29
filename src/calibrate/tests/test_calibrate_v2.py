import io
import os
import unittest
from unittest.mock import patch, MagicMock

import numpy as np
from app import app
from upload_limits import MAX_CSV_BYTES
from calibrate_v2 import FIELDS
from models.calibrate_tool import Regression


class Predictor:
    def predict(self, data):
        return np.full(len(data), 12.346)


class CalibrationTests(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def upload(self, row="2026-10-28T10:00:00Z,25,27,40,42,65,24", **mappings):
        payload = {field: field for field in FIELDS}
        payload.update(mappings)
        csv = ",".join(FIELDS) + ",unused\n" + row + ",\n"
        payload["file"] = (io.BytesIO(csv.encode()), "input.csv")
        return self.client.post("/api/v2/calibrate/tool", data=payload)

    def test_routes_registered(self):
        paths = {rule.rule for rule in app.url_map.iter_rules()}
        self.assertIn("/api/v2/calibrate/tool", paths)
        self.assertIn("/api/v1/calibrate/tool", paths)
        self.assertIn("/api/v1/calibrate/tool/train", paths)

    def test_v1_routes_available(self):
        for path in ("/api/v1/calibrate/tool", "/api/v1/calibrate/tool/train"):
            with self.subTest(path=path):
                self.assertEqual(self.client.post(path).status_code, 400)

    def test_missing_file(self):
        self.assertEqual(self.client.post("/api/v2/calibrate/tool").status_code, 400)

    def test_upload_size_limit(self):
        for path in ("/api/v1/calibrate/tool", "/api/v1/calibrate/tool/train",
                     "/api/v2/calibrate/tool"):
            with self.subTest(path=path), patch("calibrate_v2.Regression") as model:
                response = self.client.post(path, data={
                    "file": (io.BytesIO(b"x" * (MAX_CSV_BYTES + 1)), "large.csv")})
                self.assertEqual(response.status_code, 413)
                self.assertFalse(response.json["success"])
                self.assertIn("20 MB", response.json["message"])
                model.assert_not_called()

    def test_exact_file_limit_allows_multipart_overhead(self):
        import pandas as pd

        with patch("calibrate_v2.pd.read_csv", return_value=pd.DataFrame()) as reader:
            response = self.client.post("/api/v2/calibrate/tool", data={
                "file": (io.BytesIO(b"x" * MAX_CSV_BYTES), "boundary.csv")})
        self.assertEqual(response.status_code, 400)  # Empty parsed table, not oversized.
        reader.assert_called_once()

    def test_oversized_request_returns_json(self):
        response = self.client.post("/api/v2/calibrate/tool", data={
            "file": (io.BytesIO(b"x" * (app.config["MAX_CONTENT_LENGTH"] + 1)), "large.csv")})
        self.assertEqual(response.status_code, 413)
        self.assertFalse(response.json["success"])

    def test_native_headers_and_optional_secondary_readings(self):
        cases = [
            ("datetime,pm2_5,pm10,humidity,temperature\n2026-10-24 20:00:00 UTC,25,40,65,24\n", 25, 40),
            ("datetime,pm2_5,pm10,humidity,temperature,s2_pm2_5\n2026-10-24 20:00:00 UTC,25,40,65,24,27\n", 26, 40),
            ("datetime,pm2_5,pm10,humidity,temperature,s2_pm2_5,s2_pm10,site_id,pm2_5_calibrated_value\n2026-10-24 20:00:00 UTC,25,40,65,24,,42,site-1,\n", 25, 41),
        ]
        for csv, pm25, pm10 in cases:
            with self.subTest(csv=csv), patch.object(Regression, "__init__", return_value=None), \
                    patch.object(Regression, "rf_regressor", Predictor(), create=True), \
                    patch.object(Regression, "lasso_regressor", Predictor(), create=True):
                response = self.client.post("/api/v2/calibrate/tool", data={
                    "file": (io.BytesIO(csv.encode()), "input.csv")})
                self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
                self.assertIn(f"{float(pm25)},{float(pm10)},", response.get_data(as_text=True))

    def test_missing_required_native_header(self):
        response = self.client.post("/api/v2/calibrate/tool", data={
            "file": (io.BytesIO(b"datetime,pm2_5,pm10,humidity\n2026-10-28,25,40,65\n"), "input.csv")})
        self.assertEqual(response.status_code, 400)
        self.assertIn("temperature", response.json["message"])

    def test_success_with_real_feature_processing(self):
        with patch.object(Regression, "__init__", return_value=None):
            with patch.object(Regression, "rf_regressor", Predictor(), create=True), \
                    patch.object(Regression, "lasso_regressor", Predictor(), create=True):
                response = self.upload()
        self.assertEqual(response.status_code, 200)
        lines = response.get_data(as_text=True).splitlines()
        self.assertEqual(lines[0], "avg_pm2_5,avg_pm10,datetime,calibrated_pm2_5,calibrated_pm10")
        self.assertEqual(len(lines), 2)
        self.assertIn("26.0,41.0", lines[1])
        self.assertTrue(lines[1].endswith(",12.35,12.35"))

    def test_invalid_rows_rejected_before_loading_models(self):
        with patch("calibrate_v2.Regression") as model:
            for row in ["bad,25,27,40,42,65,24",
                        "2026-10-28,25,27,0,0,65,24",
                        "2026-10-28,25,27,0.001,0.001,65,24",
                        "2026-10-28,-1,27,40,42,65,24",
                        "2026-10-28,25,27,40,42,101,24",
                        "2026-10-28,inf,27,40,42,65,24"]:
                with self.subTest(row=row):
                    self.assertEqual(self.upload(row).status_code, 400)
            model.assert_not_called()

    def test_bad_mappings(self):
        self.assertEqual(self.upload(pm2_5="missing").status_code, 400)
        self.assertEqual(self.upload(pm2_5="pm10").status_code, 400)
        self.assertEqual(self.upload(pm2_5="").status_code, 400)

    def test_unavailable_models(self):
        with patch("calibrate_v2.Regression", side_effect=FileNotFoundError):
            response = self.upload()
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json["success"])

    def test_configured_bucket_is_used(self):
        with patch.dict(os.environ, {"FORECAST_MODELS_BUCKET": "test-models"}), \
                patch("calibrate_v2.Regression", side_effect=FileNotFoundError) as model:
            with self.assertLogs(app.logger, level="ERROR"):
                self.upload()
            model.assert_called_once_with(bucket="test-models")

    def test_workflow_ratio_feature(self):
        import pandas as pd

        with patch.object(Regression, "__init__", return_value=None):
            model = Regression()
        model.workflow_features = True
        model.rf_regressor = MagicMock()
        model.lasso_regressor = MagicMock()
        model.rf_regressor.predict.return_value = np.array([10.0])
        model.lasso_regressor.predict.return_value = np.array([20.0])
        model.compute_calibrated_val({}, pd.DataFrame({
            "datetime": ["2026-10-28T10:00:00Z"], "pm2_5": [25],
            "s2_pm2_5": [27], "pm10": [40], "s2_pm10": [42],
            "humidity": [65], "temperature": [24]}))
        features = model.rf_regressor.predict.call_args[0][0]
        self.assertAlmostEqual(features.iloc[0]["pm2_5_pm10_mod"], 26 / 41)

    def test_empty_csv(self):
        self.assertEqual(self.upload("").status_code, 400)


if __name__ == "__main__":
    unittest.main()
