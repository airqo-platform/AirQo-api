from datetime import datetime
from typing import List, Dict, Any

import ee
import pandas as pd
from google.oauth2 import service_account

from airqo_etl_utils.config import configuration


class SatelliteUtils:

    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=['https://www.googleapis.com/auth/earthengine']
        ), project=configuration.GOOGLE_CLOUD_PROJECT_ID)

    @staticmethod
    def extract_data_for_image(image: ee.Image, aoi: ee.Geometry.Point) -> ee.Feature:
        return ee.Feature(None, image.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=1000
        ).set('date', image.date().format('YYYY-MM-dd')))

    @staticmethod
    def get_satellite_data(aoi: ee.Geometry.Point, collection: str, fields: List[str], start_date: datetime,
                           end_date: datetime) -> ee.ImageCollection:
        return ee.ImageCollection(collection) \
            .filterDate(start_date.strftime('%Y-%m-%d'), end_date.strftime('%Y-%m-%d')) \
            .filterBounds(aoi) \
            .select(fields) \
            .map(lambda image: SatelliteUtils.extract_data_for_image(image, aoi))

    @staticmethod
    def process_time_series(time_series: Dict[str, Any], fields: List[str]) -> Dict[str, Dict[str, List[float]]]:
        daily_data = {}
        for feature in time_series['features']:
            date = feature['properties']['date']
            if date not in daily_data:
                daily_data[date] = {field: [] for field in fields}
            for field in fields:
                if field in feature['properties']:
                    daily_data[date][field].append(feature['properties'][field])
        return daily_data

    @staticmethod
    def calculate_daily_means(daily_data: Dict[str, Dict[str, List[float]]], fields: List[str], city: str) -> List[
        Dict[str, Any]]:
        results = []
        for date, data in daily_data.items():
            result = {
                'timestamp': datetime.strptime(date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0),
                'city': city
            }
            for field in fields:
                if data[field]:
                    result[field] = sum(filter(None, data[field])) / len(data[field])
                else:
                    result[field] = None
            results.append(result)
        return results

    @staticmethod
    def extract_data_for_location(location: Dict[str, Any], collections: Dict[str, List[str]], start_date: datetime,
                                  end_date: datetime) -> List[Dict[str, Any]]:
        aoi = ee.Geometry.Point(location["coords"])
        all_data = []

        for collection, fields in collections.items():
            prefixed_fields = [f"{collection}_{field}" for field in fields]
            satellite_data = SatelliteUtils.get_satellite_data(aoi, collection, fields, start_date, end_date)
            time_series = satellite_data.getInfo()
            daily_data = SatelliteUtils.process_time_series(time_series, fields)
            prefixed_daily_data = {date: {f"{collection}_{field}": values for field, values in data.items()}
                                   for date, data in daily_data.items()}
            all_data.extend(
                SatelliteUtils.calculate_daily_means(prefixed_daily_data, prefixed_fields, location['city']))

        return all_data

    @staticmethod
    def extract_data_from_api(locations: List[Dict[str, Any]], start_date: datetime, end_date: datetime,
                              satellite_collections: Dict[str, List[str]]) -> pd.DataFrame:

        SatelliteUtils.initialize_earth_engine()
        all_data = []
        for location in locations:
            all_data.extend(
                SatelliteUtils.extract_data_for_location(location, satellite_collections, start_date, end_date))
            print("first done")

        return pd.DataFrame(all_data)
