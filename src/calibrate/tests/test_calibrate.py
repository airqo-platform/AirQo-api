import io
import sys
import types
import unittest
from unittest.mock import patch

import pandas as pd


class FakeRegression:
    def __init__(self, country=None):
        self.country = country

    def compute_calibrated_val(self, map_columns, dataframe):
        return pd.DataFrame(
            {
                "datetime": [dataframe["created_at"].iloc[0]],
                "calibrated_pm2_5": [12.5],
                "calibrated_pm10": [18.0],
            }
        )


# Isolate API tests from MongoDB, cloud libraries, and local pickle artifacts.
flask_pymongo = types.ModuleType("flask_pymongo")
flask_pymongo.PyMongo = lambda _app: None
sys.modules["flask_pymongo"] = flask_pymongo

models = types.ModuleType("models")
calibration_tool = types.ModuleType("models.calibrate_tool")
calibration_tool.Regression = FakeRegression
training_tool = types.ModuleType("models.train_calibrate_tool")
training_tool.Train_calibrate_tool = object
models.calibrate_tool = calibration_tool
models.train_calibrate_tool = training_tool
sys.modules["models"] = models
sys.modules["models.calibrate_tool"] = calibration_tool
sys.modules["models.train_calibrate_tool"] = training_tool

from app import app


COLUMN_MAPPING = {
    "country": "uganda",
    "datetime": "created_at",
    "pm2_5": "pm2_5",
    "s2_pm2_5": "s2_pm2_5",
    "pm10": "pm10",
    "s2_pm10": "s2_pm10",
    "humidity": "humidity",
    "temperature": "temperature",
}


class CalibrateToolTestCase(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.client = app.test_client()

    def _post(self, content, filename="measurements.csv", mapping=None):
        data = dict(COLUMN_MAPPING if mapping is None else mapping)
        data["file"] = (io.BytesIO(content), filename)
        return self.client.post(
            "/api/v1/calibrate/tool",
            data=data,
            content_type="multipart/form-data",
        )

    @patch("calibrate.calibration_tool.Regression", return_value=FakeRegression())
    def test_calibrates_valid_csv(self, _regression):
        csv = (
            b"created_at,pm2_5,s2_pm2_5,pm10,s2_pm10,humidity,temperature\n"
            b"2026-01-01T00:00:00Z,10,11,20,21,60,24\n"
        )

        response = self._post(csv)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/csv")
        self.assertIn("calibrated_data.csv", response.headers["Content-Disposition"])
        self.assertNotIn(b"Unnamed: 0", response.data)

    def test_rejects_non_csv_file(self):
        response = self._post(b"not a csv", filename="measurements.txt")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["message"], "Only CSV files are supported.")

    def test_rejects_file_larger_than_20_mb(self):
        response = self._post(b"x" * (20 * 1024 * 1024 + 1))

        self.assertEqual(response.status_code, 413)
        self.assertIn("20 MB", response.get_json()["message"])

    def test_reports_missing_mapped_columns(self):
        response = self._post(b"created_at,pm2_5\n2026-01-01,10\n")

        self.assertEqual(response.status_code, 400)
        self.assertIn("missing from the uploaded file", response.get_json()["message"])

    def test_requires_all_column_mappings(self):
        mapping = dict(COLUMN_MAPPING)
        del mapping["temperature"]

        response = self._post(b"created_at\n2026-01-01\n", mapping=mapping)

        self.assertEqual(response.status_code, 400)
        self.assertIn("Please map", response.get_json()["message"])

    @patch("calibrate.calibration_tool.Regression", return_value=FakeRegression())
    def test_accepts_one_pre_averaged_pm25_column(self, _regression):
        mapping = dict(COLUMN_MAPPING)
        del mapping["pm2_5"]
        del mapping["s2_pm2_5"]
        mapping["avg_pm2_5"] = "average_pm25"
        csv = (
            b"created_at,average_pm25,pm10,s2_pm10,humidity,temperature\n"
            b"2026-01-01T00:00:00Z,12,20,21,60,24\n"
        )

        response = self._post(csv, mapping=mapping)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/csv")

    @patch("calibrate.calibration_tool.Regression", return_value=FakeRegression())
    def test_allows_country_to_be_omitted_for_default_model(self, regression):
        mapping = dict(COLUMN_MAPPING)
        del mapping["country"]

        response = self._post(
            (
                b"created_at,pm2_5,s2_pm2_5,pm10,s2_pm10,humidity,temperature\n"
                b"2026-01-01T00:00:00Z,10,11,20,21,60,24\n"
            ),
            mapping=mapping,
        )

        self.assertEqual(response.status_code, 200)
        regression.assert_called_once_with(country=None)


if __name__ == "__main__":
    unittest.main()
