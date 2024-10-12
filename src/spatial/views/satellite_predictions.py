from datetime import datetime, timezone

import numpy as np
from flask import request, jsonify

from configure import get_trained_model_from_gcs, Config, satellite_collections
from models.SatellitePredictionModel import SatellitePredictionModel


class SatellitePredictionView:
    @staticmethod
    @staticmethod
    def make_predictions():
        try:
            data = request.json
            latitude = data.get("latitude")
            longitude = data.get("longitude")
            city = data.get("city")

            if not latitude or not longitude:
                return jsonify({"error": "Latitude and longitude are required"}), 400

            SatellitePredictionModel.initialize_earth_engine()

            location = {"city": city, "coords": [longitude, latitude]}

            features = SatellitePredictionModel.extract_data_for_location(
                location, satellite_collections
            )
            features["latitude"] = latitude
            features["longitude"] = longitude
            feature_array = np.array(list(features.values())).reshape(1, -1)

            model = get_trained_model_from_gcs(
                Config.GOOGLE_CLOUD_PROJECT_ID,
                Config.PROJECT_BUCKET,
                f"satellite_prediction_model.pkl",
            )

            prediction = model.predict(feature_array)[0]
            return jsonify(
                {
                    "pm2_5_prediction": round(float(prediction), 3),
                    "latitude": latitude,
                    "longitude": longitude,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
            )

        except Exception as e:
            return jsonify({"error": str(e)}), 500
