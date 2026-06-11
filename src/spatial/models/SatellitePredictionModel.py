"""PM2.5 prediction features sourced from free Sentinel-2 STAC data."""

from datetime import datetime, timezone
import os

import pandas as pd

from models.sentinel2_context_model import Sentinel2ContextModel


class SatellitePredictionModel:
    """Build schema-aware model input from the free Sentinel-2 archive."""

    @staticmethod
    def extract_data_for_location(latitude, longitude, start_date=None, end_date=None):
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
            "year": timestamp.year,
            "month": timestamp.month,
            "day": timestamp.day,
            "dayofweek": timestamp.weekday(),
            "week": int(timestamp.strftime("%V")),
        }
        return features, context

    @staticmethod
    def get_feature_names(model):
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
        start_date=None,
        end_date=None,
    ):
        features, context = cls.extract_data_for_location(
            latitude=latitude,
            longitude=longitude,
            start_date=start_date,
            end_date=end_date,
        )
        model_input = cls.prepare_model_input(model, features)
        prediction = model.predict(model_input)[0]
        return float(prediction), features, context
