"""Free Sentinel-2-backed PM2.5 prediction endpoint."""

from datetime import datetime, timezone
import logging
import math

import pandas as pd
from flask import jsonify, request
from google.oauth2 import service_account

from configure import Config
from configure import _resolve_credentials_path
from models.SatellitePredictionModel import SatellitePredictionModel
from models.trained_model_cache import get_trained_model_from_gcs
from models.site_category_model import SiteCategoryModel


logger = logging.getLogger(__name__)


class SatellitePredictionView:
    MAX_DAILY_RANGE_DAYS = 30
    PREDICTION_DISCLAIMER = (
        "Satellite PM2.5 predictions are model estimates based on available "  
        "satellite, weather, and location features. They are not regulatory " 
        "monitoring measurements and should be interpreted with uncertainty."
    )

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
    def _parse_date(value, field_name):
        if not value:
            return None, f"{field_name} is required."
        try:
            timestamp = pd.Timestamp(value)
        except Exception:
            return None, f"{field_name} must be a valid ISO date or timestamp."
        if pd.isna(timestamp):
            return None, f"{field_name} must be a valid ISO date or timestamp."
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")
        return timestamp.normalize(), None

    @staticmethod
    def _today_utc():
        return pd.Timestamp(datetime.now(timezone.utc)).normalize()

    @staticmethod
    def _future_date_error():
        return "Sentinel-2 features are currently unavailable for this location."

    @classmethod
    def _is_future_date(cls, timestamp):
        return timestamp > cls._today_utc()

    @classmethod
    def _prediction_dates(cls, payload):
        start_value = (
            payload.get("starttime")
            or payload.get("start_time")
            or payload.get("start_date")
        )
        end_value = (
            payload.get("endtime")
            or payload.get("end_time")
            or payload.get("end_date")
        )
        timestamp_value = payload.get("timestamp") or payload.get("date")

        if start_value or end_value:
            if timestamp_value:
                return (
                    None,
                    None,
                    "Use either timestamp/date or starttime/endtime, not both.",
                    400,
                )
            if not start_value or not end_value:
                return (
                    None,
                    None,
                    "Both starttime and endtime are required for daily PM2.5 predictions.",
                    400,
                )

            start, error = cls._parse_date(start_value, "starttime")
            if error:
                return None, None, error, 400
            end, error = cls._parse_date(end_value, "endtime")
            if error:
                return None, None, error, 400
            if start > end:
                return None, None, "starttime must be on or before endtime.", 400
            if cls._is_future_date(start) or cls._is_future_date(end):
                return None, None, cls._future_date_error(), 503

            day_count = int((end - start).days) + 1
            if day_count > cls.MAX_DAILY_RANGE_DAYS:
                return (
                    None,
                    None,
                    f"The daily prediction range cannot exceed {cls.MAX_DAILY_RANGE_DAYS} days.",
                    400,
                )

            dates = [
                date.strftime("%Y-%m-%d")
                for date in pd.date_range(start, end, freq="D")
            ]
            return dates, "range", None, None

        if timestamp_value:
            timestamp, error = cls._parse_date(timestamp_value, "timestamp")
            if error:
                return None, None, error, 400
            if cls._is_future_date(timestamp):
                return None, None, cls._future_date_error(), 503
            return [timestamp.strftime("%Y-%m-%d")], "single", None, None

        return None, None, "Provide either timestamp or starttime and endtime.", 400

    @staticmethod
    def _place_from_coordinates(latitude, longitude):
        try:
            reverse_result = SiteCategoryModel()._reverse_geocode(
                latitude,
                longitude,
            )
        except Exception:
            logger.exception("Failed to reverse-geocode satellite prediction point")
            return {"name": None, "display_name": None}

        if reverse_result.get("_error"):
            return {"name": None, "display_name": None}

        address = reverse_result.get("address") or {}
        name = (
            reverse_result.get("name")
            or address.get("suburb")
            or address.get("village")
            or address.get("town")
            or address.get("city")
            or address.get("municipality")
            or address.get("county")
            or reverse_result.get("display_name")
        )
        return {
            "name": name,
            "display_name": reverse_result.get("display_name"),
            "address": {
                key: value
                for key, value in address.items()
                if key
                in {
                    "suburb",
                    "village",
                    "town",
                    "city",
                    "municipality",
                    "county",
                    "state",
                    "country",
                }
            },
        }

    @staticmethod
    def _save_prediction(result):
        credentials_path = _resolve_credentials_path(Config.CREDENTIALS)
        if not (
            Config.BIGQUERY_SATELLITE_MODEL_PREDICTIONS
            and Config.GOOGLE_CLOUD_PROJECT_ID
            and credentials_path
        ):
            return False

        credentials = service_account.Credentials.from_service_account_file(
            credentials_path
        )
        pd.DataFrame([result]).to_gbq(
            destination_table=Config.BIGQUERY_SATELLITE_MODEL_PREDICTIONS,
            project_id=Config.GOOGLE_CLOUD_PROJECT_ID,
            if_exists="append",
            credentials=credentials,
        )
        return True

    @classmethod
    def _predict_for_date(cls, model, latitude, longitude, date, place=None):
        prediction, features, context = SatellitePredictionModel.predict(
            model=model,
            latitude=latitude,
            longitude=longitude,
            date=date,
        )
        return {
            "date": date,
            "pm2_5_prediction": round(prediction, 3),
            "latitude": latitude,
            "longitude": longitude,
            "place_name": (place or {}).get("name"),
            "place": place or {"name": None, "display_name": None},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "data_source": (
                "Copernicus Sentinel-2 L2A via Element 84 Earth Search"
                if context.get("sentinel2_used")
                else features.get("weather_source")
            ),
            "weather_source": features.get("weather_source"),
            "weather_date": features.get("weather_date"),
            "weather_date_offset_days": features.get("weather_date_offset_days"),
            "requested_date": features.get("requested_date"),
            "scene_id": context.get("scene_id"),
            "scene_datetime": context.get("scene_datetime"),
            "features": features,
        }

    @staticmethod
    def make_predictions():
        payload = request.get_json(silent=True) or {}
        latitude, longitude, error = SatellitePredictionView._coordinates(payload)
        if error:
            return jsonify({"error": error}), 400

        dates, mode, error, status = SatellitePredictionView._prediction_dates(
            payload
        )
        if error:
            return jsonify({"error": error}), status

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
                        "details": model_error,
                    }
                ),
                503,
            )

        place = SatellitePredictionView._place_from_coordinates(
            latitude,
            longitude,
        )

        try:
            results = [
                SatellitePredictionView._predict_for_date(
                    model=model,
                    latitude=latitude,
                    longitude=longitude,
                    date=date,
                    place=place,
                )
                for date in dates
            ]
        except ValueError:
            logger.exception("Satellite prediction request failed validation")
            return (
                jsonify(
                    {
                        "error": "Invalid input or unavailable features for the requested period.",
                        "retraining_required": True,
                    }
                ),
                422,
            )
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

        for result in results:
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

        if mode == "range":
            return (
                jsonify(
                    {
                        "latitude": latitude,
                        "longitude": longitude,
                        "place_name": place.get("name"),
                        "place": place,
                        "starttime": dates[0],
                        "endtime": dates[-1],
                        "count": len(results),
                        "max_days": SatellitePredictionView.MAX_DAILY_RANGE_DAYS,
                        "disclaimer": SatellitePredictionView.PREDICTION_DISCLAIMER,
                        "daily_pm2_5": results,
                    }
                ),
                200,
            )

        result = dict(results[0])
        result["disclaimer"] = SatellitePredictionView.PREDICTION_DISCLAIMER
        return jsonify(result), 200
