from datetime import datetime, timedelta
from typing import List, Dict, Any

import ee
import pandas as pd
from google.oauth2 import service_account

from airqo_etl_utils.config import configuration


class SatelliteUtils:

    @staticmethod
    def initialize_earth_engine():
        """Authenticates and initializes Earth Engine"""
        ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=['https://www.googleapis.com/auth/earthengine']
        ), project=configuration.GOOGLE_CLOUD_PROJECT_ID)

    @staticmethod
    def get_satellite_data(aoi: ee.Geometry.Point, collection: str, bands: List[str], start_date: datetime,
                           end_date: datetime) -> ee.FeatureCollection:
        """Retrieves satellite data for a single collection

        Args:
            aoi (ee.Geometry.Point): Area of interest
            collection (str): Collection to retrieve data for e.g COPERNICUS_S2
            bands (List[str]): List of bands to retrieve data for e.g ["CLOUDY_PIXEL_PERCENTAGE"]
            start_date (datetime): Start date
            end_date (datetime): End date

        Returns:
            ee.FeatureCollection: Collection of data
            """

        def extract_data_for_image(image: ee.Image, aoi: ee.Geometry.Point) -> ee.Feature:
            """Reducer to extract data for a single image. Uses mean reducer"""
            return ee.Feature(None, image.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=aoi,
                scale=1000
            ).set('date', image.date().format('YYYY-MM-dd')))

        return ee.ImageCollection(collection) \
            .filterDate(start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d')) \
            .filterBounds(aoi) \
            .select(bands) \
            .map(lambda image: extract_data_for_image(image, aoi))

    @staticmethod
    def process_time_series(time_series: Dict[str, Any], bands: List[str]) -> Dict[str, Dict[str, List[float]]]:
        daily_data = {}
        for feature in time_series['features']:
            date = feature['properties']['date']
            if date not in daily_data:
                daily_data[date] = {band: [] for band in bands}
            for band in bands:
                if band in feature['properties']:
                    daily_data[date][band].append(feature['properties'][band])
        return daily_data

    @staticmethod
    def calculate_daily_means(daily_data: Dict[str, Dict[str, List[float]]], bands: List[str], city: str) -> List[
        Dict[str, Any]]:
        results = []
        for date, data in daily_data.items():
            result = {
                'timestamp': datetime.strptime(date, '%Y-%m-%d').replace(hour=0, minute=0, second=0, microsecond=0),
                'city': city
            }
            for band in bands:
                if data[band]:
                    result[band] = sum(filter(None, data[band])) / len(data[band])
                else:
                    result[band] = None
            results.append(result)
        return results

    @staticmethod
    def extract_data_for_location(location: Dict[str, Any], collections: Dict[str, List[str]], start_date: datetime,
                                  end_date: datetime) -> List[Dict[str, Any]]:
        """Handles the retrieval of satellite data for a single location"""
        aoi = ee.Geometry.Point(location["coords"]).buffer(7500)
        location_data = []

        for collection, bands in collections.items():
            prefixed_bands = [f"{collection}_{band}" for band in bands]
            satellite_data = SatelliteUtils.get_satellite_data(aoi, collection, bands, start_date, end_date)
            time_series = satellite_data.getInfo()
            daily_data = SatelliteUtils.process_time_series(time_series, bands)
            prefixed_daily_data = {date: {f"{collection}_{band}": values for band, values in data.items()}
                                   for date, data in daily_data.items()}
            location_data.extend(
                SatelliteUtils.calculate_daily_means(prefixed_daily_data, prefixed_bands, location['city']))

        return location_data

    @staticmethod
    def extract_satellite_data(locations: List[Dict[str, List[float]]], satellite_collections: Dict[str, List[str]]) -> \
            list[list[dict[str, Any]]]:

        """Triggers the operation to retrieve satellite data for specified locations

        Args:
            locations (List[Dict[str, List[float]]]): List of locations to retrieve data for
            satellite_collections (Dict[str, List[str]]): List of satellite collections to retrieve data for

        Returns:
            List[Dict[str, Any]]: List of data for each location
        """
        SatelliteUtils.initialize_earth_engine()

        start_date = datetime.now() - timedelta(days=7)
        end_date = datetime.now()
        all_data = []
        for location in locations:
            all_data.append(
                SatelliteUtils.extract_data_for_location(location, satellite_collections, start_date, end_date))


    @staticmethod
    def format_data(data: List[Dict[str, Any]]) -> pd.DataFrame:
        data = pd.DataFrame(data)
        data.columns = data.columns.str.lower()
        data.columns = [
            c.replace("/", "_").replace(" ", "_").lower()
            for c in data.columns
        ]

        return data
