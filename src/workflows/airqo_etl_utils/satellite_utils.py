from datetime import timedelta

import ee
import pandas as pd
from google.oauth2 import service_account

from airqo_etl_utils.config import configuration
from airqo_etl_utils.constants import satellite_collections


class SatelliteUtils:

    @staticmethod
    def extract_data_from_api(locations, date):
        ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS, scopes=['https://www.googleapis.com/auth/earthengine']
        ), project=configuration.GOOGLE_CLOUD_PROJECT_ID)
        data = []
        end_date = date + timedelta(days=1)

        for location in locations:

            aoi = ee.Geometry.Point(location["coords"])

            results = {'city': location['city'], 'timestamp': date.strftime('%Y-%m-%d')}

            for collection, fields in satellite_collections.items():
                satellite_data = ee.ImageCollection(collection) \
                    .filterDate(start=date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d')) \
                    .filterBounds(aoi) \
                    .select(fields).mean() \
                    .reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=aoi,
                    scale=1000,
                ).getInfo()
                results.update(satellite_data)

            data.append(results)
        return pd.DataFrame(data)
