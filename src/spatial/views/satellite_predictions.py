"""Free Sentinel-2-backed PM2.5 prediction endpoint."""

from datetime import datetime, timezone
import logging
import math

import pandas as pd
from flask import jsonify, request
from google.oauth2 import service_account

from configure import Config, get_trained_model_from_gcs
from models.SatellitePredictionModel import SatellitePredictionModel


logger = logging.getLogger(__name__)


class SatellitePredictionView:
    @staticmethod
    def _coordinates(payload):
        try:
            latitude = float(payload.get("latitude"))
            longitude = float(payload.get("longitude"))
        except (TypeError, ValueError):
            return None, None, "Latitude and longitude must be numbers."
        if not math.isfinite(latitude) or not math.isfinite(longitude):
            return None, None, "Latitude and longitude must be finite numbers."
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            return None, None, "Coordinates are outside valid ranges."
        return latitude, longitude, None

    @staticmethod
    def _save_prediction(result):
        if not (
            Config.BIGQUERY_SATELLITE_MODEL_PREDICTIONS
            and Config.GOOGLE_CLOUD_PROJECT_ID
            and Config.CREDENTIALS
        ):
            return False

        credentials = service_account.Credentials.from_service_account_file(
            Config.CREDENTIALS
        )
        pd.DataFrame([result]).to_gbq(
            destination_table=Config.BIGQUERY_SATELLITE_MODEL_PREDICTIONS,
            project_id=Config.GOOGLE_CLOUD_PROJECT_ID,
            if_exists="append",
            credentials=credentials,
        )
        return True

    @staticmethod
    def make_predictions():
        payload = request.get_json(silent=True) or {}
        latitude, longitude, error = SatellitePredictionView._coordinates(payload)
        if error:
            return jsonify({"error": error}), 400

        model, model_error = get_trained_model_from_gcs(
            Config.GOOGLE_CLOUD_PROJECT_ID,
            Config.SATELLITE_PREDICTION_BUCKET,
            Config.SATELLITE_PREDICTION_MODEL_FILE,
        )
        if model is None:
            return (
                jsonify(
                    {
                        "error": "Satellite prediction model is unavailable.",
                        "bucket": Config.SATELLITE_PREDICTION_BUCKET,
                        "model_file": Config.SATELLITE_PREDICTION_MODEL_FILE,
                        "details": model_error,
                    }
                ),
                503,
            )

        try:
            prediction, features, context = SatellitePredictionModel.predict(
                model=model,
                latitude=latitude,
                longitude=longitude,
                start_date=payload.get("start_date"),
                end_date=payload.get("end_date"),
            )
        except ValueError as error:
            return jsonify({"error": str(error), "retraining_required": True}), 422
        except Exception:
            logger.exception("Failed to fetch Sentinel-2 prediction features")
            return (
                jsonify(
                    {
                        "error": (
                            "Sentinel-2 features are currently unavailable for "
                            "this location."
                        )
                    }
                ),
                503,
            )

        result = {
            "pm2_5_prediction": round(prediction, 3),
            "latitude": latitude,
            "longitude": longitude,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data_source": "Copernicus Sentinel-2 L2A via Element 84 Earth Search",
            "scene_id": context.get("scene_id"),
            "scene_datetime": context.get("scene_datetime"),
            "features": features,
        }
        try:
            result["saved_to_bigquery"] = SatellitePredictionView._save_prediction(
                {
                    key: value
                    for key, value in result.items()
                    if key != "features"
                }
            )
        except Exception:
            logger.exception("Failed to save satellite prediction to BigQuery")
            result["saved_to_bigquery"] = False

        return jsonify(result), 200
