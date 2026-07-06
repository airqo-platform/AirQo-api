"""PM2.5 prediction features sourced from free Sentinel-2 STAC data."""

from datetime import datetime, timezone
import os

import pandas as pd
import requests

from models.sentinel2_context_model import Sentinel2ContextModel


class SatellitePredictionModel:
    """Build schema-aware model input from the free Sentinel-2 archive."""

    @staticmethod
    def _normalize_utc_timestamp(value):
        timestamp = pd.Timestamp(value)
        if pd.isna(timestamp):
            raise ValueError("date must be a valid ISO date or timestamp.")
        if timestamp.tzinfo is None:
            timestamp = timestamp.tz_localize("UTC")
        else:
            timestamp = timestamp.tz_convert("UTC")
        return timestamp

    @staticmethod
    def _nasa_power_weather(latitude, longitude, timestamp):
        date_text = timestamp.strftime("%Y%m%d")
        url = (
            "https://power.larc.nasa.gov/api/temporal/daily/point"
            "?parameters=T2M,RH2M"
            "&community=AG"
            f"&longitude={longitude}"
            f"&latitude={latitude}"
            f"&start={date_text}"
            f"&end={date_text}"
            "&format=JSON"
        )
        timeout = float(os.getenv("NASA_POWER_REQUEST_TIMEOUT_SECONDS", "30"))
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        parameters = response.json()["properties"]["parameter"]

        temperature = parameters["T2M"].get(date_text)
        humidity = parameters["RH2M"].get(date_text)
        if temperature == -999:
            temperature = None
        if humidity == -999:
            humidity = None

        return {
            "temperature": (
                round(float(temperature), 2)
                if temperature is not None
                else None
            ),
            "humidity": (
                round(float(humidity), 2)
                if humidity is not None
                else None
            ),
            "weather_source": "NASA POWER",
        }

    @staticmethod
    def _needs_weather(feature_names):
        weather_features = {
            "temperature",
            "humidity",
            "air_temperature",
            "relative_humidity",
        }
        return bool(weather_features.intersection(feature_names or []))

    @classmethod
    def extract_data_for_location(
        cls,
        latitude,
        longitude,
        date=None,
        start_date=None,
        end_date=None,
        feature_names=None,
    ):
        requested_timestamp = (
            cls._normalize_utc_timestamp(date)
            if date
            else None
        )
        if requested_timestamp is not None and not end_date:
            end_date = requested_timestamp.strftime("%Y-%m-%d")

        context = Sentinel2ContextModel().get_context(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
        )
        indices = context.get("indices") or {}
        scene_datetime = context.get("scene_datetime")
        timestamp = (
            datetime.fromisoformat(scene_datetime.replace("Z", "+00:00"))
            if scene_datetime
            else datetime.now(timezone.utc)
        )
        feature_timestamp = cls._normalize_utc_timestamp(timestamp)

        features = {
            "ndvi": indices.get("ndvi"),
            "ndbi": indices.get("ndbi"),
            "ndwi": indices.get("ndwi"),
            "bare_soil_index": indices.get("bare_soil_index"),
            "normalized_burn_ratio": indices.get("normalized_burn_ratio"),
            "aerosol_optical_thickness": context.get(
                "aerosol_optical_thickness"
            ),
            "scene_cloud_cover": context.get("scene_cloud_cover"),
            "latitude": float(latitude),
            "longitude": float(longitude),
            "year": int(feature_timestamp.year),
            "month": int(feature_timestamp.month),
            "day": int(feature_timestamp.day),
            "dayofweek": int(feature_timestamp.weekday()),
            "week": int(feature_timestamp.strftime("%V")),
        }
        cls._add_interaction_features(features)
        if requested_timestamp is not None:
            features["requested_date"] = requested_timestamp.strftime("%Y-%m-%d")

        if cls._needs_weather(feature_names):
            weather = cls._nasa_power_weather(
                latitude=latitude,
                longitude=longitude,
                timestamp=feature_timestamp,
            )
            features.update(weather)
            features["air_temperature"] = weather["temperature"]
            features["relative_humidity"] = weather["humidity"]

        return features, context

    @staticmethod
    def _multiply_feature(features, *names):
        result = 1.0
        for name in names:
            value = features.get(name)
            if value is None:
                return None
            result *= float(value)
        return result

    @classmethod
    def _add_interaction_features(cls, features):
        features["day_aod"] = cls._multiply_feature(
            features,
            "day",
            "aerosol_optical_thickness",
        )
        features["ndvi_aod"] = cls._multiply_feature(
            features,
            "ndvi",
            "aerosol_optical_thickness",
        )
        features["ndvi_bsi"] = cls._multiply_feature(
            features,
            "ndvi",
            "bare_soil_index",
        )
        features["lat_aod"] = cls._multiply_feature(
            features,
            "latitude",
            "aerosol_optical_thickness",
        )
        features["lon_aod"] = cls._multiply_feature(
            features,
            "longitude",
            "aerosol_optical_thickness",
        )

    @classmethod
    def get_feature_names(cls, model):
        feature_names = getattr(model, "feature_names_in_", None)
        if feature_names is not None:
            return [str(name) for name in feature_names]

        booster = getattr(model, "booster_", None)
        if booster is not None:
            booster_names = booster.feature_name()
            if booster_names and not all(
                name.startswith("Column_") for name in booster_names
            ):
                return [str(name) for name in booster_names]

        configured_order = os.getenv("SATELLITE_PREDICTION_FEATURE_ORDER", "")
        return [
            name.strip()
            for name in configured_order.split(",")
            if name.strip()
        ]

    @classmethod
    def prepare_model_input(cls, model, features):
        feature_names = cls.get_feature_names(model)
        if not feature_names:
            raise ValueError(
                "The prediction model does not declare feature names. Retrain it "
                "with Sentinel-2 features or configure "
                "SATELLITE_PREDICTION_FEATURE_ORDER."
            )

        missing = [
            name
            for name in feature_names
            if name not in features or features[name] is None
        ]
        if missing:
            raise ValueError(
                "The deployed model is incompatible with the available Sentinel-2 "
                f"feature schema. Missing features: {', '.join(missing)}"
            )

        return pd.DataFrame(
            [{name: features[name] for name in feature_names}],
            columns=feature_names,
        )

    @classmethod
    def predict(
        cls,
        model,
        latitude,
        longitude,
        date=None,
        start_date=None,
        end_date=None,
    ):
        feature_names = cls.get_feature_names(model)
        features, context = cls.extract_data_for_location(
            latitude=latitude,
            longitude=longitude,
            date=date,
            start_date=start_date,
            end_date=end_date,
            feature_names=feature_names,
        )
        model_input = cls.prepare_model_input(model, features)
        prediction = model.predict(model_input)[0]
        return float(prediction), features, context
