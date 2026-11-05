"""Reference calibration training, independent of HTTP and job storage."""

import io
import os
import platform

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Lasso
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

REQUIRED = ("datetime", "pm2_5", "pm10", "humidity", "temperature")
SECONDARY = {"s2_pm2_5": "pm2_5", "s2_pm10": "pm10"}
FEATURES = ["avg_pm2_5", "avg_pm10", "temperature", "humidity", "hour",
            "error_pm2_5", "error_pm10", "pm2_5_pm10", "pm2_5_pm10_mod"]
MIN_SAMPLES = 30


def prepare_training(source, options):
    """Select paired data, aggregate matching times, and reject invalid rows."""
    pollutant = options.get("pollutant", "both")
    if pollutant not in {"pm2_5", "pm10", "both"}:
        raise ValueError("pollutant must be pm2_5, pm10, or both.")
    pollutants = ["pm2_5", "pm10"] if pollutant == "both" else [pollutant]
    interval = options.get("averaging_interval", "1h")
    if interval not in {"1h", "raw"}:
        raise ValueError("averaging_interval must be 1h or raw.")
    fields = list(REQUIRED) + list(SECONDARY) + ["reference_" + p for p in pollutants]
    mappings = {}
    for field in fields:
        column = options.get(field, field)
        if not column or not isinstance(column, str):
            raise ValueError("Empty column mapping: " + field)
        if field not in SECONDARY or field in options or column in source:
            mappings[field] = column
    if len(set(mappings.values())) != len(mappings):
        raise ValueError("Each training field must map to a different CSV column.")
    missing = [column for column in mappings.values() if column not in source]
    if missing:
        raise ValueError("Missing CSV columns: " + ", ".join(missing))
    data = source[list(mappings.values())].copy()
    data.columns = list(mappings)
    if data.empty:
        raise ValueError("Training CSV must contain paired sensor and reference readings.")
    data["datetime"] = pd.to_datetime(data["datetime"], utc=True, errors="coerce")
    for secondary, primary in SECONDARY.items():
        if secondary not in data:
            data[secondary] = data[primary]
        else:
            data[secondary] = data[secondary].fillna(data[primary])
    numeric = [field for field in data if field != "datetime"]
    data[numeric] = data[numeric].apply(pd.to_numeric, errors="coerce")
    if data.isna().any().any() or not np.isfinite(data[numeric].values).all():
        raise ValueError("Training values must have valid timestamps and finite numbers.")
    particulate = ["pm2_5", "pm10", *SECONDARY, *["reference_" + p for p in pollutants]]
    if (data[particulate] < 0).any().any() or not data.humidity.between(0, 100).all():
        raise ValueError("PM and reference values must be nonnegative; humidity must be 0-100.")
    # A file represents one collocated sensor/reference pair, never a pooled site mix.
    if "site_id" in source and source["site_id"].dropna().nunique() > 1:
        raise ValueError("Upload one collocated site per training job.")
    if interval == "1h":
        data["datetime"] = data.datetime.dt.floor("h")
    # Exact duplicates/timestamps cannot leak across train and validation sets.
    data = data.groupby("datetime", as_index=False, sort=True)[numeric].mean()
    if len(data) < MIN_SAMPLES:
        raise ValueError(f"At least {MIN_SAMPLES} distinct paired timestamps are required after averaging.")
    maximum = int(os.getenv("CALIBRATION_TRAIN_MAX_ROWS", "50000"))
    if len(data) > maximum:
        raise ValueError(f"Training is limited to {maximum} paired timestamps after averaging.")
    if (data[["pm10", "s2_pm10"]].mean(axis=1).round(2) <= 0).any():
        raise ValueError("Average PM10 must be greater than zero after rounding.")
    return data, pollutants, interval


def build_features(data):
    features = pd.DataFrame(index=data.index)
    features["avg_pm2_5"] = data[["pm2_5", "s2_pm2_5"]].mean(axis=1).round(2)
    features["avg_pm10"] = data[["pm10", "s2_pm10"]].mean(axis=1).round(2)
    features["temperature"] = data.temperature
    features["humidity"] = data.humidity
    features["hour"] = data.datetime.dt.hour
    features["error_pm2_5"] = (data.pm2_5 - data.s2_pm2_5).abs()
    features["error_pm10"] = (data.pm10 - data.s2_pm10).abs()
    features["pm2_5_pm10"] = features.avg_pm2_5 - features.avg_pm10
    features["pm2_5_pm10_mod"] = features.avg_pm2_5 / features.avg_pm10
    return features[FEATURES]


def train_reference_models(data, pollutants, interval):
    features = build_features(data)
    if not np.isfinite(features.values).all():
        raise ValueError("Training feature calculations produced nonfinite values.")
    boundary = int(len(data) * 0.8)
    training, validation = features.iloc[:boundary], features.iloc[boundary:]
    results = data.iloc[boundary:].copy()
    metrics, models = {}, {}
    for pollutant in pollutants:
        model = (RandomForestRegressor(n_estimators=200, max_depth=20, random_state=42, n_jobs=1)
                 if pollutant == "pm2_5" else Lasso(random_state=42, max_iter=10000))
        target = data["reference_" + pollutant]
        model.fit(training, target.iloc[:boundary])
        predicted = model.predict(validation)
        actual = target.iloc[boundary:]
        if not np.isfinite(predicted).all():
            raise ValueError("Model produced nonfinite predictions.")
        raw = features["avg_" + pollutant].iloc[boundary:]
        metrics[pollutant] = {
            "mae": float(mean_absolute_error(actual, predicted)),
            "rmse": float(np.sqrt(mean_squared_error(actual, predicted))),
            "r2": float(r2_score(actual, predicted)) if actual.nunique() > 1 else None,
            "raw_mae": float(mean_absolute_error(actual, raw)),
            "model_type": type(model).__name__,
        }
        if any(value is not None and not np.isfinite(value)
               for name, value in metrics[pollutant].items() if name != "model_type"):
            raise ValueError("Training produced nonfinite validation metrics.")
        results["calibrated_" + pollutant] = np.round(predicted, 2)
        # Deliberately export the evaluated model, without fitting on holdout data.
        models[pollutant] = model
    summary = {
        "metrics": metrics, "training_rows": len(training), "validation_rows": len(validation),
        "training_end": data.datetime.iloc[boundary - 1].isoformat(),
        "validation_start": data.datetime.iloc[boundary].isoformat(),
        "averaging_interval": interval, "timezone": "UTC",
        "split": "earliest 80% training, latest 20% validation",
        "warning": "Validation metrics do not guarantee improvement; compare mae with raw_mae.",
    }
    artifact = {
        "kind": "user_reference_calibration", "version": 1, "models": models,
        "features": FEATURES, "ratio": "avg_pm2_5 / avg_pm10",
        "secondary_fallback": "primary", "summary": summary,
        "versions": {"python": platform.python_version(), "sklearn": sklearn.__version__,
                     "numpy": np.__version__, "pandas": pd.__version__, "joblib": joblib.__version__},
    }
    buffer = io.BytesIO()
    joblib.dump(artifact, buffer, compress=3)
    return summary, results.to_csv(index=False).encode(), buffer.getvalue()
