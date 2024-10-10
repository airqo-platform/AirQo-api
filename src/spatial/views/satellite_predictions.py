from datetime import datetime, timezone

import gcsfs
import joblib
import numpy as np
from flask import request, jsonify

from configure import get_trained_model_from_gcs
from models.SatellitePredictionModel import SatellitePredictionModel


class SatellitePredictionView:
    @staticmethod


    @staticmethod
    def make_predictions():
        try:
            data = request.json
            latitude = data.get('latitude')
            longitude = data.get('longitude')

            if not latitude or not longitude:
                return jsonify({'error': 'Latitude and longitude are required'}), 400

            SatellitePredictionModel.initialize_earth_engine()

            features = SatellitePredictionModel.extract_single_point_data(longitude, latitude)

            feature_array = np.array(list(features.values())).reshape(1, -1)

            prediction =  get_trained_model_from_gcs(
            project_name, bucket_name, f"satellite_model.pkl"
        ).predict(feature_array)[0]

            return jsonify({
                'pm2_5_prediction': float(prediction),
                'latitude': latitude,
                'longitude': longitude,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })

        except Exception as e:
            return jsonify({'error': str(e)}), 500

