from datetime import datetime, timezone
from typing import Dict

import ee
from google.oauth2 import service_account

from configure import Config, satellite_collections


class SatellitePredictionModel:
    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
            Config.CREDENTIALS,
            scopes=['https://www.googleapis.com/auth/earthengine']
        ), project=Config.GOOGLE_CLOUD_PROJECT_ID)

    @staticmethod
    def extract_single_point_data(longitude: float, latitude: float) -> Dict[str, float]:
        aoi = ee.Geometry.Point([longitude, latitude])
        current_time = datetime.now(timezone.utc)

        all_features = {}

        for collection, fields in satellite_collections.items():
            image = ee.ImageCollection(collection) \
                .filterDate(current_time.strftime('%Y-%m-%d')) \
                .filterBounds(aoi) \
                .first()

            if image:
                values = image.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=aoi,
                    scale=1113.2
                ).getInfo()

                for field in fields:
                    all_features[f"{collection}_{field}"] = values.get(field)

        # Add time-related features
        all_features['year'] = current_time.year
        all_features['month'] = current_time.month
        all_features['day'] = current_time.day
        all_features['dayofweek'] = current_time.weekday()
        all_features['week'] = int(current_time.strftime('%V'))

        return all_features