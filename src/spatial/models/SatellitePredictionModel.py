from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

import ee
from google.oauth2 import service_account

from configure import Config


class SatellitePredictionModel:
    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(
            credentials=service_account.Credentials.from_service_account_file(
                Config.CREDENTIALS,
                scopes=["https://www.googleapis.com/auth/earthengine"],
            ),
            project=Config.GOOGLE_CLOUD_PROJECT_ID,
        )

    @staticmethod
    def extract_data_for_image(image: ee.Image, aoi: ee.Geometry.Point) -> ee.Feature:
        return ee.Feature(
            None,
            image.reduceRegion(
                reducer=ee.Reducer.mean(), geometry=aoi, scale=1113.2
            ).set("date", image.date().format("YYYY-MM-dd")),
        )

    @staticmethod
    def get_satellite_data(
        aoi: ee.Geometry.Point, collection: str, fields: List[str]
    ) -> ee.FeatureCollection:
        return (
            ee.ImageCollection(collection)
            .filterDate(
                datetime.now(timezone.utc) - timedelta(days=7),
                datetime.now(timezone.utc),
            )
            .filterBounds(aoi)
            .select(fields)
            .map(
                lambda image: SatellitePredictionModel.extract_data_for_image(
                    image, aoi
                )
            )
        )

    @staticmethod
    def extract_data_for_location(
        location: Dict[str, Any], collections: Dict[str, List[str]]
    ) -> Dict[str, Any]:
        aoi = ee.Geometry.Point(location["coords"])
        result = {}

        for collection, fields in collections.items():
            satellite_data = SatellitePredictionModel.get_satellite_data(
                aoi, collection, fields
            )
            time_series = satellite_data.getInfo()

            if time_series["features"]:
                latest_feature = time_series["features"][-1]["properties"]
                for field in fields:
                    field_key = f"{collection}_{field}"
                    result[field_key] = latest_feature.get(field, 0) or 0
            else:
                for field in fields:
                    field_key = f"{collection}_{field}"
                    result[field_key] = 0

        # Add time-related features
        current_time = datetime.now(timezone.utc)
        result["year"] = current_time.year
        result["month"] = current_time.month
        result["day"] = current_time.day
        result["dayofweek"] = current_time.weekday()
        result["week"] = int(current_time.strftime("%V"))

        return result
