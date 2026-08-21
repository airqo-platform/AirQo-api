import io
import os
import re
from functools import lru_cache

import joblib
import numpy as np
import pandas as pd
from google.cloud import storage


CALIBRATION_MODELS_BUCKET = os.getenv(
    "CALIBRATION_MODELS_BUCKET", "calibration_training_bucket"
)
CALIBRATION_MODEL_PREFIX = os.getenv("CALIBRATION_MODEL_PREFIX", "calibration")
CALIBRATION_MODEL_BLOB = os.getenv("CALIBRATION_MODEL_BLOB")
CALIBRATION_MODEL_COUNTRY = os.getenv("CALIBRATION_MODEL_COUNTRY", "uganda")
GCP_PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT_ID")

DEFAULT_FEATURES = [
    "hour",
    "avg_pm2_5",
    "avg_pm10",
    "error_pm2_5",
    "error_pm10",
    "pm2_5_pm10",
    "pm2_5_pm10_mod",
]


class CalibrationModelError(RuntimeError):
    """Raised when a deployed calibration model cannot be loaded or used."""


def _normalise_country(country):
    country = (country or CALIBRATION_MODEL_COUNTRY or "").strip().lower()
    if not country and CALIBRATION_MODEL_BLOB:
        return "configured"
    if not country:
        raise ValueError("Please specify the country calibration model to use.")
    if not re.fullmatch(r"[a-z0-9 _-]+", country):
        raise ValueError("Country may contain only letters, numbers, spaces, _ or -.")
    return country


def _model_blob_name(country):
    if CALIBRATION_MODEL_BLOB:
        return CALIBRATION_MODEL_BLOB.strip("/")
    prefix = CALIBRATION_MODEL_PREFIX.strip("/")
    return f"{prefix}/{country}_pm2_5_cal_model.pkl"


@lru_cache(maxsize=16)
def _load_model_artifact(bucket_name, blob_name, project_id=None):
    try:
        client = storage.Client(project=project_id) if project_id else storage.Client()
        model_bytes = client.bucket(bucket_name).blob(blob_name).download_as_bytes()
        artifact = joblib.load(io.BytesIO(model_bytes))
    except Exception as error:
        raise CalibrationModelError(
            f"Unable to load calibration model gs://{bucket_name}/{blob_name}."
        ) from error

    if isinstance(artifact, dict):
        model = artifact.get("model")
        features = artifact.get("features")
    else:
        model = artifact
        features = DEFAULT_FEATURES

    if model is None or not hasattr(model, "predict"):
        raise CalibrationModelError("The calibration artifact has no usable model.")
    if not isinstance(features, (list, tuple)) or not features:
        raise CalibrationModelError("The calibration artifact has no feature list.")

    return model, list(features)


class Regression:
    """Load a deployed country model from GCS and calibrate uploaded readings."""

    def __init__(self, country=None):
        self.country = _normalise_country(country)
        self.blob_name = _model_blob_name(self.country)
        self.model, self.features = _load_model_artifact(
            CALIBRATION_MODELS_BUCKET,
            self.blob_name,
            GCP_PROJECT_ID,
        )

    def compute_calibrated_val(self, map_columns, df):
        df = df.rename(columns=map_columns).copy()
        df["datetime"] = pd.to_datetime(df["datetime"], utc=True, errors="coerce")

        has_average_pm2_5 = "avg_pm2_5" in df.columns
        numeric_columns = ["pm10", "s2_pm10", "temperature", "humidity"]
        if has_average_pm2_5:
            numeric_columns.append("avg_pm2_5")
        else:
            numeric_columns.extend(["pm2_5", "s2_pm2_5"])
        df[numeric_columns] = df[numeric_columns].apply(
            pd.to_numeric, errors="coerce"
        )
        df.dropna(subset=["datetime", *numeric_columns], inplace=True)
        if df.empty:
            raise ValueError("No valid measurement rows were found.")

        df["hour"] = df["datetime"].dt.hour
        if has_average_pm2_5:
            # A pre-averaged reading cannot provide sensor-pair disagreement.
            df["error_pm2_5"] = 0.0
        else:
            df["avg_pm2_5"] = df[["pm2_5", "s2_pm2_5"]].mean(axis=1)
            df["error_pm2_5"] = (df["pm2_5"] - df["s2_pm2_5"]).abs()
        df["avg_pm10"] = df[["pm10", "s2_pm10"]].mean(axis=1)
        df["error_pm10"] = (df["pm10"] - df["s2_pm10"]).abs()
        df["pm2_5_pm10"] = (df["avg_pm10"] - df["avg_pm2_5"]).abs()
        denominator = df["avg_pm10"].replace(0, np.nan)
        df["pm2_5_pm10_mod"] = df["pm2_5_pm10"] / denominator
        df.replace([np.inf, -np.inf], np.nan, inplace=True)

        missing_features = sorted(set(self.features) - set(df.columns))
        if missing_features:
            raise CalibrationModelError(
                "The uploaded data cannot provide model features: "
                + ", ".join(missing_features)
            )

        valid_rows = df.dropna(subset=self.features)
        if valid_rows.empty:
            raise ValueError("No rows contain all values required by the model.")

        try:
            calibrated_pm2_5 = self.model.predict(valid_rows[self.features])
        except Exception as error:
            raise CalibrationModelError(
                "The deployed calibration model could not process the uploaded data."
            ) from error

        calibrated_data = valid_rows[["avg_pm2_5", "avg_pm10", "datetime"]].copy()
        calibrated_data["calibrated_pm2_5"] = np.asarray(
            calibrated_pm2_5
        ).round(2)
        return calibrated_data
