"""Validated CSV calibration using the existing model artifacts."""

import os
import numpy as np
import pandas as pd
from flask import Blueprint, current_app, jsonify, make_response, request

from models.calibrate_tool import Regression
from routes import route


calibrate_v2_bp = Blueprint("calibrate_v2_bp", __name__)
FIELDS = ("datetime", "pm2_5", "s2_pm2_5", "pm10", "s2_pm10",
          "humidity", "temperature")
REQUIRED_FIELDS = ("datetime", "pm2_5", "pm10", "humidity", "temperature")
SECONDARY_FIELDS = {"s2_pm2_5": "pm2_5", "s2_pm10": "pm10"}


def error(message, status=400):
    return jsonify(success=False, message=message), status


def validated_lcs_upload():
    """Return validated sensor readings for either calibration path."""
    upload = request.files.get("file")
    if upload is None or not upload.filename:
        raise ValueError("Upload a CSV using the 'file' field.")

    try:
        source = pd.read_csv(upload)
    except (ValueError, pd.errors.ParserError, UnicodeDecodeError):
        raise ValueError("The uploaded file could not be read as CSV.") from None
    mappings = {}
    for field in FIELDS:
        if field in request.form:
            column = request.form[field].strip()
            if not column:
                raise ValueError("Column mapping cannot be empty: " + field)
            mappings[field] = column
        elif field in REQUIRED_FIELDS or field in source.columns:
            mappings[field] = field
    if len(set(mappings.values())) != len(mappings):
        raise ValueError("Each field must map to a different CSV column.")
    missing = [column for column in mappings.values() if column not in source.columns]
    if missing:
        raise ValueError("Missing CSV columns: " + ", ".join(missing))
    if source.empty:
        raise ValueError("The CSV must contain at least one data row.")

    # Select before renaming so unrelated columns cannot collide or drop rows.
    data = source[list(mappings.values())].copy()
    data.columns = list(mappings)
    for secondary, primary in SECONDARY_FIELDS.items():
        if secondary not in data:
            data[secondary] = data[primary]
        else:
            # Blank secondary readings are optional on a per-row basis too.
            data[secondary] = data[secondary].fillna(data[primary])
    data["datetime"] = pd.to_datetime(data["datetime"], format="mixed", errors="coerce", utc=True)
    for field in FIELDS[1:]:
        data[field] = pd.to_numeric(data[field], errors="coerce")
    if data.isna().any().any() or not np.isfinite(data[list(FIELDS[1:])].values).all():
        raise ValueError("Required values must contain valid timestamps and finite numbers; no rows were processed.")
    pm_fields = ["pm2_5", "s2_pm2_5", "pm10", "s2_pm10"]
    if (data[pm_fields] < 0).any().any():
        raise ValueError("Particulate measurements must be nonnegative.")
    if not data["humidity"].between(0, 100).all():
        raise ValueError("Humidity must be between 0 and 100.")
    if (data[["pm10", "s2_pm10"]].mean(axis=1).round(2) <= 0).any():
        raise ValueError("Average PM10 must remain greater than zero when rounded to two decimals.")

    return data


def csv_response(result):
    response = make_response(result.to_csv(index=False))
    response.headers["Content-Type"] = "text/csv"
    response.headers["Content-Disposition"] = "attachment; filename=calibrated_data.csv"
    return response


@calibrate_v2_bp.route(route["calibrate_tool_v2"], methods=["POST"])
def calibrate_tool():
    try:
        data = validated_lcs_upload()
    except ValueError as exc:
        return error(str(exc))

    try:
        model = Regression(bucket=os.getenv("FORECAST_MODELS_BUCKET", "airqo_prediction_bucket_dev"))
    except Exception:
        current_app.logger.exception("Calibration model loading failed")
        return error("Calibration models are unavailable.", 503)
    try:
        result = model.compute_calibrated_val({}, data)
        predictions = result[["calibrated_pm2_5", "calibrated_pm10"]].values
        if not np.isfinite(predictions).all():
            raise ValueError("Nonfinite predictions")
    except Exception:
        current_app.logger.exception("Calibration prediction failed")
        return error("Calibration failed.", 500)

    return csv_response(result)
