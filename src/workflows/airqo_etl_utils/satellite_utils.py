import ee
import pandas as pd
from google.oauth2 import service_account

from airqo_etl_utils.config import configuration


class SatelliteUtils:
    """ Class for methods for extracting satellite data from Earth Engine.
     """

    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
            configuration.GOOGLE_APPLICATION_CREDENTIALS,
            scopes=['https://www.googleapis.com/auth/earthengine']
        ), project=configuration.GOOGLE_CLOUD_PROJECT_ID)

    @staticmethod
    def get_city_region(city_info):
        center = ee.Geometry.Point(city_info['coords'])
        return center.buffer(12000)

    @staticmethod
    def get_satellite_data(regions, collection, fields, start_date, end_date):
        fc = ee.FeatureCollection(regions)
        images = ee.ImageCollection(collection) \
            .filterDate(start_date, end_date) \
            .select(fields)

        def reduce_regions(image):
            reduced = image.reduceRegions(
                collection=fc,
                reducer=ee.Reducer.mean(),
                scale=1000
            )
            return reduced.map(lambda f: f.set('date', image.date().format('YYYY-MM-dd')))

        reduced = images.map(reduce_regions).flatten()

        return reduced

    @staticmethod
    def extract_satellite_data(cities, start_date, end_date, satellite_collections):
        SatelliteUtils.initialize_earth_engine()

        # Create regions for each city
        regions = [{'city': city['city'], 'geometry': SatelliteUtils.get_city_region(city)} for city in cities]

        all_data = []
        for collection, fields in satellite_collections.items():
            data = SatelliteUtils.get_satellite_data(regions, collection, fields, start_date, end_date)

            # Convert to pandas DataFrame
            df = pd.DataFrame(data.getInfo()['features'])
            df['properties'] = df['properties'].apply(pd.Series)
            df = df.drop(['geometry', 'type'], axis=1)
            df = pd.concat([df.drop(['properties'], axis=1), df['properties']], axis=1)

            # Rename columns
            df.columns = [f"{collection}_{c}" if c in fields else c for c in df.columns]

            all_data.append(df)

        # Merge all dataframes
        result = pd.concat(all_data, axis=1)
        result = result.loc[:, ~result.columns.duplicated()]  # Remove duplicate columns

        # Clean up column names
        result.columns = result.columns.str.lower()
        result.columns = [c.replace("/", "_").replace(" ", "_").lower() for c in result.columns]

        return result
