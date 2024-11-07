from datetime import datetime, timezone

import numpy as np
import pandas as pd
from flask import request, jsonify
from google.oauth2 import service_account

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
                "satellite_prediction_model.pkl",
            )

            prediction = model.predict(feature_array)[0]

            result = {
                "pm2_5_prediction": round(float(prediction), 3),
                "latitude": latitude,
                "longitude": longitude,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            try:
                df = pd.DataFrame([result])
                credentials = service_account.Credentials.from_service_account_file(
                    Config.CREDENTIALS
                )

                df.to_gbq(
                    destination_table=f"{Config.BIGQUERY_SATELLITE_MODEL_PREDICTIONS}",
                    project_id=Config.GOOGLE_CLOUD_PROJECT_ID,
                    if_exists="append",
                    credentials=credentials,
                )

            except Exception as e:
                print(f"Error saving predictions to BigQuery: {e}")

            return jsonify(result), 200
        except Exception as e:
            print(f"Error making predictions: {e}")
            return jsonify({"error": "An internal error has occurred"}), 500
