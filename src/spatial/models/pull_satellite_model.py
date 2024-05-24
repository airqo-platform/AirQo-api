import ee
import pandas as pd
from configure import Config  # Assuming this is a configuration file or object
from datetime import datetime, timedelta

class BasePM25Model:
    def __init__(self):
        self.data_path = None
        self.credentials = ee.ServiceAccountCredentials(
            key_file=Config.CREDENTIALS,
            email=Config.GOOGLE_APPLICATION_CREDENTIALS_EMAIL
        )
        self.initialize_earth_engine()

    def initialize_earth_engine(self):
        """Initialize Earth Engine with provided credentials."""
        try:
            ee.Initialize(credentials=self.credentials, project=Config.GOOGLE_CLOUD_PROJECT_ID)
        except Exception as e:
            print(f"Failed to initialize Earth Engine: ")

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
        try:
            aod_value = mean_aod.sample(point, 30).first().get('Optical_Depth_047').getInfo()
        except Exception as e:
            print(f"Error sampling AOD value:")
            aod_value = None

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
        if aod_value is not None:
            df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * df['aod']
        else:
            df['derived_pm2_5'] = None

        return df

class PM25ModelDaily(BasePM25Model):
    def get_aod_for_dates(self, longitude, latitude, start_date, end_date):
        """
        Fetches AOD data from the MODIS satellite for each day in a given time period.

        Args:
            longitude (float): Longitude of the location.
            latitude (float): Latitude of the location.
            start_date (str): Start date in the format 'YYYY-MM-DD'.
            end_date (str): End date in the format 'YYYY-MM-DD'.

        Returns:
            pandas.DataFrame: A DataFrame containing the daily AOD data and derived PM2.5 data.
        """
        # Define the geometry of the point
        point = ee.Geometry.Point(longitude, latitude)

        # Define the date range
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        # Load the MODIS data
        dataset = ee.ImageCollection('MODIS/061/MCD19A2_GRANULES') \
            .filterBounds(point) \
            .select('Optical_Depth_047')

        # Initialize an empty list to store the data
        data = []

        # Loop through each day in the date range
        current_date = start
        while current_date <= end:
            # Filter the dataset for the current date
            daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))

            # Calculate the mean AOD value for the day
            daily_aod = daily_dataset.mean()

            # Sample the mean AOD value at the point
            try:
                aod_value = daily_aod.sample(point, 500).first().get('Optical_Depth_047').getInfo()
            except Exception as e:
#                print(f"Error on {current_date.strftime('%Y-%m-%d')}: {e}")
                aod_value = None

            # Append the result to the data list
            data.append({
                'date': current_date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                'aod': aod_value
            })

            # Move to the next day
            current_date += timedelta(days=1)

        # Create a pandas DataFrame with the results
        df = pd.DataFrame(data)

        # Drop rows with NaN values in the 'aod' column
        df.dropna(subset=['aod'], inplace=True)

        # Calculate derived PM2.5
        df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * df['aod']

        return df

class Sentinel5PModel(BasePM25Model):
    def get_pollutant_data(self, longitude, latitude, start_date, end_date, pollutants):
        """
        Fetches pollutant data from the Sentinel-5P satellite for each day in a given time period.

        Args:
            longitude (float): Longitude of the location.
            latitude (float): Latitude of the location.
            start_date (str): Start date in the format 'YYYY-MM-DD'.
            end_date (str): End date in the format 'YYYY-MM-DD'.
            pollutants (list): List of pollutant names (e.g., ['SO2', 'HCHO', 'CO', 'NO2', 'O3']).

        Returns:
            pandas.DataFrame: A dataframe containing the daily pollutant data for all pollutants.
        """
        # Define the geometry of the point
        point = ee.Geometry.Point(longitude, latitude)

        # Define the date range
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        # Initialize an empty list to store the data
        data = []

        # Loop through each pollutant
        for pollutant in pollutants:
            # Load the Sentinel-5P data for the current pollutant
            dataset = self.get_dataset_for_pollutant(pollutant)

            # Loop through each day in the date range
            current_date = start
            while current_date <= end:
                # Filter the dataset for the current date
                daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))

                # Calculate the mean value for the day
                daily_mean = daily_dataset.mean()

                # Sample the mean value at the point
                try:
                    value = daily_mean.sample(point, 500).first().get(self.get_band_name_for_pollutant(pollutant)).getInfo()
                except Exception as e:
  #                  print(f"Error on {current_date.strftime('%Y-%m-%d')} for {pollutant}: {e}")
                    value = None

                # Append the result to the data list
                data.append({
                    'date': current_date.strftime('%Y-%m-%d'),
                    'longitude': longitude,
                    'latitude': latitude,
                    pollutant: value
                })

                # Move to the next day
                current_date += timedelta(days=1)

        # Create a pandas DataFrame with the results
        df = pd.DataFrame(data)

        # Drop rows with NaN values
#        df.dropna(inplace=True)

        return df

    def get_dataset_for_pollutant(self, pollutant):
        """
        Returns the Earth Engine dataset ID for the given pollutant.

        Args:
            pollutant (str): Name of the pollutant (e.g., 'SO2', 'HCHO', 'CO', 'NO2', 'O3').

        Returns:
            str: Dataset ID for the pollutant.
        """
        datasets = {
            'SO2': 'COPERNICUS/S5P/NRTI/L3_SO2',
            'HCHO': 'COPERNICUS/S5P/NRTI/L3_HCHO',
            'CO': 'COPERNICUS/S5P/NRTI/L3_CO',
            'NO2': 'COPERNICUS/S5P/NRTI/L3_NO2',
            'O3': 'COPERNICUS/S5P/NRTI/L3_O3',
            'AOD':'COPERNICUS/S5P/OFFL/L3_AER_AI',
            'CH4':'COPERNICUS/S5P/OFFL/L3_CH4'
        }
        return ee.ImageCollection(datasets[pollutant])

    def get_band_name_for_pollutant(self, pollutant):
        """
        Returns the Earth Engine band name for the given pollutant.

        Args:
            pollutant (str): Name of the pollutant (e.g.,'SO2','HCHO','CO','NO2','O3','AOD','CH4').

        Returns:
            str: Band name for the pollutant.
        """
        band_names = {
            'SO2': 'SO2_column_number_density',
            'HCHO': 'tropospheric_HCHO_column_number_density',
            'CO': 'CO_column_number_density',
            'NO2': 'NO2_column_number_density',
            'O3': 'O3_column_number_density',
            'AOD':'absorbing_aerosol_index',
            'CH4':'CH4_column_volume_mixing_ratio_dry_air'
        }

        return band_names[pollutant]
