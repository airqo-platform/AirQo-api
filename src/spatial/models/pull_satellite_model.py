import ee
import pandas as pd
from configure import Config  # Assuming this is a configuration file or objects
from datetime import datetime, timedelta
from google.oauth2 import service_account

class BasePM25Model:
    def __init__(self):
        """Initialize the BasePM25Model class with necessary configurations and Earth Engine initialization."""
        self.data_path = None
        self.credentials = self._get_service_account_credentials()
        self.initialize_earth_engine()

    def _get_service_account_credentials(self):
        """Retrieve service account credentials for Google Earth Engine."""
        return ee.ServiceAccountCredentials(
            email=Config.GOOGLE_APPLICATION_CREDENTIALS_EMAIL,
            key_file=Config.CREDENTIALS
        )

    def initialize_earth_engine(self):
        """Initialize Earth Engine with provided credentials."""
        ee.Initialize(
            credentials=self.credentials, 
            project=Config.GOOGLE_CLOUD_PROJECT_ID
        )
class PM25Model(BasePM25Model):
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
        point = ee.Geometry.Point(longitude, latitude)
        start = ee.Date(start_date)
        end = ee.Date(end_date)

        dataset = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
            .filterDate(start, end) \
            .filterBounds(point)
        aod = dataset.select('Optical_Depth_047')
        mean_aod = aod.mean()
        aod_value = mean_aod.sample(point, 30).first().get('Optical_Depth_047').getInfo()

        data = {
            'longitude': [longitude],
            'latitude': [latitude],
            'start_date': [start_date],
            'end_date': [end_date],
            'aod': [aod_value]
        }

        df = pd.DataFrame(data)
        df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * df['aod']
        return df

class PM25ModelDaily(BasePM25Model):
    def get_aod_for_dates(self, longitude, latitude, start_date, end_date):
        point = ee.Geometry.Point(longitude, latitude)
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        dataset = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
            .filterBounds(point) \
            .select('Optical_Depth_047')

        data = []
        current_date = start
        while current_date <= end:
            daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))
            daily_aod = daily_dataset.mean()
            try:
                aod_value = daily_aod.sample(point, 500).first().get('Optical_Depth_047').getInfo()
            except Exception as e:
                aod_value = None
            data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                'aod': aod_value
            })
            current_date += timedelta(days=1)

        df = pd.DataFrame(data)
        df.dropna(subset=['aod'], inplace=True)
        df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * df['aod']
        return df

class Sentinel5PModel(BasePM25Model):
    def get_pollutant_data(self, longitude, latitude, start_date, end_date, pollutants):
        point = ee.Geometry.Point(longitude, latitude)
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')
        data = []

        for pollutant in pollutants:
            dataset = self.get_dataset_for_pollutant(pollutant)
            current_date = start
            while current_date <= end:
                daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))
                daily_mean = daily_dataset.mean()
                try:
                    value = daily_mean.sample(point, 500).first().get(self.get_band_name_for_pollutant(pollutant)).getInfo()
                except Exception as e:
                    value = None
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'longitude': longitude,
                    'latitude': latitude,
                    pollutant: value
                })
                current_date += timedelta(days=1)

        df = pd.DataFrame(data)
        return df

    def get_dataset_for_pollutant(self, pollutant):
        datasets = {
            'SO2': 'COPERNICUS/S5P/NRTI/L3_SO2',
            'HCHO': 'COPERNICUS/S5P/NRTI/L3_HCHO',
            'CO': 'COPERNICUS/S5P/NRTI/L3_CO',
            'NO2': 'COPERNICUS/S5P/NRTI/L3_NO2',
            'O3': 'COPERNICUS/S5P/NRTI/L3_O3',
            'AOD':'COPERNICUS/S5P/OFFL/L3_AER_AI',
            'CH4':'COPERNICUS/S5P/OFFL/L3_CH4',
            'TEMP':'MODIS/061/MOD21A1D'
        }
        return ee.ImageCollection(datasets[pollutant])

    def get_band_name_for_pollutant(self, pollutant):
        band_names = {
            'SO2': 'SO2_column_number_density', 
            'HCHO': 'CH4_column_volume_mixing_ratio_dry_air',  
            'CO': 'CO_column_number_density',
            'NO2': 'NO2_column_number_density', 
            'O3': 'O3_column_number_density',
            'AOD':'absorbing_aerosol_index',
            'CH4':'CH4_column_volume_mixing_ratio_dry_air',
            'TEMP':'LST_1KM',
        }
        return band_names[pollutant]

class SatelliteData(BasePM25Model):
    def get_sate_pollutant_data(self, longitude, latitude, start_date, end_date, pollutant):
        point = ee.Geometry.Point(longitude, latitude)
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        collection_id, band_name = self.get_collection_and_band(pollutant)
        dataset = ee.ImageCollection(collection_id).filterBounds(point).select(band_name)

        data = []
        current_date = start
        while current_date <= end:
            daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))
            daily_mean = daily_dataset.mean()
            try:
                value = daily_mean.sample(point, 500).first().get(band_name).getInfo()
            except Exception as e:
                value = None
            data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                pollutant: value
            })
            current_date += timedelta(days=1)

        df = pd.DataFrame(data)
        df.dropna(subset=[pollutant], inplace=True)
        return df

    def get_collection_and_band(self, pollutant):
        if pollutant == 'SO2':
            return 'COPERNICUS/S5P/NRTI/L3_SO2', 'SO2_column_number_density'
        elif pollutant == 'HCHO':
            return 'COPERNICUS/S5P/NRTI/L3_HCHO', 'tropospheric_HCHO_column_number_density'
        elif pollutant == 'CO':
            return 'COPERNICUS/S5P/NRTI/L3_CO', 'CO_column_number_density'
        elif pollutant == 'NO2':
            return 'COPERNICUS/S5P/NRTI/L3_NO2', 'NO2_column_number_density'
        elif pollutant == 'O3':
            return 'COPERNICUS/S5P/NRTI/L3_O3', 'O3_column_number_density'
        else:
            raise ValueError("Invalid pollutant name")

    def get_merged_pollutant_data(self, longitude, latitude, start_date, end_date):
        pollutants = ['SO2', 'HCHO', 'CO', 'NO2', 'O3']
        data_frames = {}

        for pollutant in pollutants:
            df = self.get_sate_pollutant_data(longitude, latitude, start_date, end_date, pollutant)
            data_frames[pollutant] = df

        merged_df = data_frames[pollutants[0]]
        for pollutant in pollutants[1:]:
            merged_df = pd.merge(merged_df, data_frames[pollutant], on='date', how='outer')

        merged_df['latitude'] = latitude
        merged_df['longitude'] = longitude
        merged_df = merged_df[['date', 'latitude', 'longitude'] + pollutants]
        return merged_df
