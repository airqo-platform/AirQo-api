from unittest.mock import MagicMock

import numpy as np
import pandas as pd

from airqo_etl_utils.tests._test_dependency_stubs import apply_ml_utils_import_stubs

apply_ml_utils_import_stubs()

from airqo_etl_utils.satellite_model_training import SatelliteModelTrainer


def _feature_payload(latitude=-1.24, longitude=36.82):
    return {
        "scene_id": "S2_TEST",
        "scene_datetime": "2026-01-15T08:00:00+00:00",
        "scene_cloud_cover": 12.0,
        "ndvi": 0.45,
        "ndbi": -0.12,
        "ndwi": -0.31,
        "bare_soil_index": 0.08,
        "normalized_burn_ratio": 0.52,
        "aerosol_optical_thickness": 0.11,
        "latitude": latitude,
        "longitude": longitude,
        "year": 2026,
        "month": 1,
        "day": 15,
        "dayofweek": 3,
        "week": 3,
    }


def test_enrich_airqo_daily_with_sentinel2_reuses_location_day_cache(monkeypatch):
    calls = []

    def fake_features(latitude, longitude, timestamp):
        calls.append((latitude, longitude, timestamp))
        return _feature_payload(latitude=latitude, longitude=longitude)

    monkeypatch.setattr(SatelliteModelTrainer, "_features_for_date", fake_features)

    data = pd.DataFrame(
        {
            "timestamp": [
                "2026-01-15T00:00:00Z",
                "2026-01-15T13:00:00Z",
            ],
            "latitude": [-1.24001, -1.24002],
            "longitude": [36.82001, 36.82002],
            "pm2_5": [21.5, 24.0],
        }
    )

    enriched = SatelliteModelTrainer.enrich_airqo_daily_with_sentinel2(data)

    assert len(calls) == 1
    assert enriched["sentinel2_error"].isna().all()
    assert enriched.loc[0, "scene_id"] == "S2_TEST"
    assert enriched.loc[1, "ndvi"] == 0.45


def test_train_and_upload_saves_model_and_logs_mlflow(monkeypatch):
    class FakeRegressor:
        def __init__(self, **params):
            self.params = params

        def fit(self, X, y):
            self.mean_ = float(y.mean())
            self.feature_names_in_ = list(X.columns)
            return self

        def predict(self, X):
            return np.full(len(X), self.mean_)

    storage = MagicMock()
    storage.save_file_object.return_value = "gs://satellite-bucket/satellite/model.pkl"
    tracker = MagicMock()

    monkeypatch.setattr(
        "airqo_etl_utils.satellite_model_training.LGBMRegressor", FakeRegressor
    )
    monkeypatch.setattr(
        "airqo_etl_utils.satellite_model_training.GCSFileStorage",
        lambda: storage,
    )
    monkeypatch.setattr(
        "airqo_etl_utils.satellite_model_training.MlflowTracker",
        lambda **kwargs: tracker,
    )
    monkeypatch.setattr(
        "airqo_etl_utils.satellite_model_training.configuration.SATELLITE_PREDICTION_BUCKET",
        "satellite-bucket",
    )
    monkeypatch.setattr(
        "airqo_etl_utils.satellite_model_training.configuration.SATELLITE_PREDICTION_MODEL_FILE",
        "satellite/model.pkl",
    )

    data = pd.DataFrame(
        {
            "timestamp": pd.date_range("2026-01-01", periods=12, freq="h", tz="UTC"),
            "pm2_5": np.linspace(10, 32, 12),
            **{
                feature: np.linspace(1, 12, 12)
                for feature in SatelliteModelTrainer.FEATURE_ORDER
            },
        }
    )

    metadata = SatelliteModelTrainer.train_and_upload(data)

    assert metadata["rows_total"] == 12
    assert metadata["uri"] == "gs://satellite-bucket/satellite/model.pkl"
    assert metadata["feature_names"] == SatelliteModelTrainer.FEATURE_ORDER
    storage.save_file_object.assert_called_once()
    tracker.log_run.assert_called_once()
    assert tracker.log_run.call_args.kwargs["tags"]["pipeline"] == "satellite_prediction"