import ee
import pandas as pd
from configure import Config  # Assuming this is a configuration file or object

class PM25Model:

    def __init__(self):
        self.data_path = None
        self.credentials = ee.ServiceAccountCredentials(
            key_file=Config.CREDENTIALS,
            email=Config.GOOGLE_APPLICATION_CREDENTIALS_EMAIL
        )
        self.initialize_earth_engine()

    def initialize_earth_engine(self):
        """Initialize Earth Engine with provided credentials."""
        ee.Initialize(credentials=self.credentials, project=Config.GOOGLE_CLOUD_PROJECT_ID)

    def get_pm25_from_satellite(self, longitude, latitude, start_date, end_date):
        """
        Fetch PM2.5 data from the MODIS satellite for a given location and time period.

        Args:
            longitude (float): Longitude of the location.
            latitude (float): Latitude of the location.
            start_date (str): Start date in the format 'YYYY-MM-DD'.
            end_date (str): End date in the format 'YYYY-MM-DD'.

        Returns:
            pandas.DataFrame: A DataFrame containing the PM2.5 data.
        """
        # Define the geometry of the point
        point = ee.Geometry.Point(longitude, latitude)

        # Define the date range
        start = ee.Date(start_date)
        end = ee.Date(end_date)

        # Load the MODIS data
        dataset = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
            .filterDate(start, end) \
            .filterBounds(point)

        # Select the AOD band
        aod = dataset.select('Optical_Depth_047')

        # Calculate the mean AOD value over the time period
        mean_aod = aod.mean()

        # Sample the mean AOD value at the point
        aod_value = mean_aod.sample(point, 30).first().get('Optical_Depth_047').getInfo()

        # Create a pandas DataFrame with the results
        data = {
            'longitude': [longitude],
            'latitude': [latitude],
            'start_date': [start_date],
            'end_date': [end_date],
            'aod': [aod_value]
        }

        
        df = pd.DataFrame(data)

        # Derive PM2.5 from AOD using a linear regression model
        df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * df['aod']
        return df


