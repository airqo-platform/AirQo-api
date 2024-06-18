import ee
import pandas as pd
from configure import Config  # Assuming this is a configuration file or object
from datetime import datetime, timedelta
from google.oauth2 import service_account
from concurrent.futures import ThreadPoolExecutor, as_completed
import concurrent.futures



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

    def get_pm25_for_multiple_locations(self, locations, start_date, end_date):
        """
        Fetch PM2.5 data for multiple locations concurrently.

        Args:
            locations (list of tuples): List of (longitude, latitude) tuples.
            start_date (str): Start date in the format 'YYYY-MM-DD'.
            end_date (str): End date in the format 'YYYY-MM-DD'.

        Returns:
            pandas.DataFrame: A DataFrame containing the PM2.5 data for all locations.
        """
        def fetch_data_for_location(location):
            longitude, latitude = location
            return self.get_pm25_from_satellite(longitude, latitude, start_date, end_date)

        results = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_data_for_location, location): location for location in locations}
            for future in as_completed(futures):
                location = futures[future]
                try:
                    data = future.result()
                    results.append(data)
                except Exception as e:
                    print(f"Error fetching data for location {location}: {e}")

        return pd.concat(results, ignore_index=True)
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

        def fetch_aod_for_date(current_date):
            """Fetch AOD for a single date."""
            daily_dataset = dataset.filterDate(current_date.strftime('%Y-%m-%d'), (current_date + timedelta(days=1)).strftime('%Y-%m-%d'))
            daily_aod = daily_dataset.mean()

            try:
                aod_value = daily_aod.sample(point, 500).first().get('Optical_Depth_047').getInfo()
            except Exception as e:
                aod_value = None

            return {
                'date': current_date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                'aod': aod_value
            }

        # Generate the list of dates
        date_range = [start + timedelta(days=i) for i in range((end - start).days + 1)]

        # Use ThreadPoolExecutor to fetch data concurrently
        data = []
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(fetch_aod_for_date, date): date for date in date_range}
            for future in as_completed(futures):
                try:
                    result = future.result()
                    data.append(result)
                except Exception as e:
                    print(f"Error fetching data: {e}")

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
        point = ee.Geometry.Point(longitude, latitude)
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        # Generate a list of dates between start_date and end_date
        dates = [start + timedelta(days=x) for x in range((end - start).days + 1)]

        # Define a helper function to fetch data for a single pollutant on a single date
        def fetch_pollutant_data(date, pollutant):
            dataset = self.get_dataset_for_pollutant(pollutant)
            daily_dataset = dataset.filterDate(date.strftime('%Y-%m-%d'), (date + timedelta(days=1)).strftime('%Y-%m-%d'))
            daily_mean = daily_dataset.mean()
            try:
                value = daily_mean.sample(point, 500).first().get(self.get_band_name_for_pollutant(pollutant)).getInfo()
            except Exception:
                value = None
            return {
                'date': date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                pollutant: value
            }

        # Use ThreadPoolExecutor to fetch data concurrently
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = []
            for date in dates:
                for pollutant in pollutants:
                    futures.append(executor.submit(fetch_pollutant_data, date, pollutant))

            # Collect the results as they complete
            data = []
            for future in concurrent.futures.as_completed(futures):
                result = future.result()
                data.append(result)

        # Create a pandas DataFrame with the results
        df = pd.DataFrame(data)
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
            'HCHO': 'COPERNICUS/S5P/NRTI/L3_HCHO',  # Formaldehyde
            'CO': 'COPERNICUS/S5P/NRTI/L3_CO',
            'NO2': 'COPERNICUS/S5P/NRTI/L3_NO2',
            'O3': 'COPERNICUS/S5P/NRTI/L3_O3',
            'AOD': 'COPERNICUS/S5P/OFFL/L3_AER_AI',
            'CH4': 'COPERNICUS/S5P/OFFL/L3_CH4',  # Methane
            'TEMP': 'MODIS/061/MOD21A1D'  # Land Surface Temperature
        }
        return ee.ImageCollection(datasets[pollutant])

    def get_band_name_for_pollutant(self, pollutant):
        """
        Returns the Earth Engine band name for the given pollutant.

        Args:
            pollutant (str): Name of the pollutant (e.g., 'SO2', 'HCHO', 'CO', 'NO2', 'O3', 'AOD', 'CH4', 'TEMP').

        Returns:
            str: Band name for the pollutant.
        """
        band_names = {
            'SO2': 'SO2_column_number_density',
            'HCHO': 'HCHO_column_number_density',
            'CO': 'CO_column_number_density',
            'NO2': 'NO2_column_number_density',
            'O3': 'O3_column_number_density',
            'AOD': 'absorbing_aerosol_index',
            'CH4': 'CH4_column_volume_mixing_ratio_dry_air',
            'TEMP': 'LST_1KM',
        }
        return band_names[pollutant]

 
class SatelliteData(BasePM25Model):
    def get_sate_pollutant_data(self, longitude, latitude, start_date, end_date, pollutant):
        # Define the geometry of the point
        point = ee.Geometry.Point(longitude, latitude)

        # Define the date range
        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        # Mapping pollutant to collection ID and band name
        pollutants_info = {
            'SO2': ('COPERNICUS/S5P/NRTI/L3_SO2', 'SO2_column_number_density'),
            'HCHO': ('COPERNICUS/S5P/NRTI/L3_HCHO', 'tropospheric_HCHO_column_number_density'),
            'CO': ('COPERNICUS/S5P/NRTI/L3_CO', 'CO_column_number_density'),
            'NO2': ('COPERNICUS/S5P/NRTI/L3_NO2', 'NO2_column_number_density'),
            'O3': ('COPERNICUS/S5P/NRTI/L3_O3', 'O3_column_number_density'),
            'CH4': ('COPERNICUS/S5P/OFFL/L3_CH4','CH4_column_volume_mixing_ratio_dry_air'),
        }

        if pollutant not in pollutants_info:
            raise ValueError("Invalid pollutant name")

        collection_id, band_name = pollutants_info[pollutant]

        # Load the Sentinel-5P data
        dataset = ee.ImageCollection(collection_id).filterBounds(point).select(band_name)

        # Initialize an empty list to store the data
        data = []

        # Loop through each day in the date range
        for single_date in (start + timedelta(days=n) for n in range((end - start).days + 1)):
            # Filter the dataset for the current date
            daily_dataset = dataset.filterDate(single_date.strftime('%Y-%m-%d'), 
                                               (single_date + timedelta(days=1)).strftime('%Y-%m-%d'))

            # Calculate the mean value for the day
            daily_mean = daily_dataset.mean()

            # Sample the mean value at the point
            try:
                value = daily_mean.sample(point, 500).first().get(band_name).getInfo()
            except Exception:
                value = None

            # Append the result to the data list
            data.append({
                'date': single_date.strftime('%Y-%m-%d'),
                'longitude': longitude,
                'latitude': latitude,
                pollutant: value
            })

        # Create a pandas DataFrame with the results
        df = pd.DataFrame(data)
        # Drop rows with NaN values
        df.dropna(subset=[pollutant], inplace=True)

        return df

    def get_merged_pollutant_data(self, longitude, latitude, start_date, end_date):
        """
        Fetches and merges pollutant data from the Sentinel-5P satellite for a given time period.

        Args:
            longitude (float): Longitude of the location.
            latitude (float): Latitude of the location.
            start_date (str): Start date in the format 'YYYY-MM-DD'.
            end_date (str): End date in the format 'YYYY-MM-DD'.

        Returns:
            pandas.DataFrame: A DataFrame containing the merged pollutant data.
        """
        pollutants = ['SO2', 'HCHO', 'CO', 'NO2', 'O3','CH4']
        data_frames = {}

        with ThreadPoolExecutor() as executor:
            future_to_pollutant = {
                executor.submit(self.get_sate_pollutant_data, longitude, latitude, start_date, end_date, pollutant): pollutant
                for pollutant in pollutants
            }

            for future in as_completed(future_to_pollutant):
                pollutant = future_to_pollutant[future]
                try:
                    df = future.result()
                    data_frames[pollutant] = df
                except Exception as e:
                    print(f"Error fetching data for {pollutant}: {e}")

        # Start merging with the first pollutant data frame
        merged_df = data_frames[pollutants[0]]
        for pollutant in pollutants[1:]:
            merged_df = pd.merge(merged_df, data_frames[pollutant], on=['date', 'latitude', 'longitude'], how='outer')

        # Reorder columns to ensure the format [date, latitude, longitude, SO2, HCHO, CO, NO2, O3]
        merged_df = merged_df[['date', 'latitude', 'longitude'] + pollutants]
        # Derived PM2.5
        merged_df['derived_pm2_5'] = 13.124535561712058 + 0.037990584629823805 * merged_df['O3'] + 0.03799 * merged_df['NO2'] + 0.00799 * merged_df['CO']
        
        return merged_df  
