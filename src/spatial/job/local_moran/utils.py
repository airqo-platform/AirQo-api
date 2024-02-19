#utils.py
import json
from datetime import datetime
import requests
import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account
from configure import Config
import geopandas as gpd
import pytz
from pysal.explore import esda
from libpysal.weights.contiguity import Queen
from esda.moran import Moran_Local
from esda.moran import Moran

def fetch_air_quality_data(grid_id, start_time, end_time) -> list:
    # Convert start_time and end_time to ISO format
    start_time_iso = start_time.isoformat() + 'Z'
    end_time_iso = end_time.isoformat() + 'Z'

    grid_params = {
        "token": Config.AIRQO_API_TOKEN,
        "startTime": start_time_iso,
        "endTime": end_time_iso,
        "recent": "no"
    }

    grid_url = f"https://platform.airqo.net/api/v2/devices/measurements/grids/{grid_id}"

    try:
        grid_response = requests.get(grid_url, params=grid_params)
        grid_response.raise_for_status()  # Raise an exception for 4xx and 5xx status codes

        data = grid_response.json()

        # Extracting only the 'site_id' from each measurement
        site_ids = [measurement.get('site_id') for measurement in data.get('measurements', [])]

        return site_ids
    except requests.exceptions.RequestException as e:
        print(f"Error fetching air quality data: {e}")
        return []

# Create a BigQuery client
client = bigquery.Client()

def query_bigquery(site_ids, start_time, end_time):
    # Construct the BigQuery SQL query
    query = f"""
        SELECT site_id, timestamp, site_name, site_latitude, site_longitude, pm2_5, pm2_5_raw_value,
        pm2_5_calibrated_value, pm10, pm10_raw_value, pm10_calibrated_value, country, region, city, county
        FROM `airqo-250220.consolidated_data.hourly_device_measurements`
        WHERE site_id IN UNNEST({site_ids})
        AND timestamp BETWEEN TIMESTAMP('{start_time.isoformat()}')
        AND TIMESTAMP('{end_time.isoformat()}')
        AND NOT pm2_5 IS NULL
    """

    try:
        # Execute the query
        query_job = client.query(query)

        # Fetch and return the results as a Pandas DataFrame
        data = query_job.to_dataframe()
                # Convert timestamp to local time based on latitude and longitude
    
        return data
    except Exception as e:
        print(f"Error querying BigQuery: {e}")
        return None
    
def results_to_dataframe(results):
    # Convert 'timestamp' to datetime format
    df = pd.DataFrame(results)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    # Create additional columns using dt accessor
    df['dates'] = df['timestamp'].dt.date.astype(str)
    df['date'] = pd.to_datetime(df['dates'])
    df['day'] = df['timestamp'].dt.day_name()
    df['hour'] = df['timestamp'].dt.hour
    df['year'] = df['timestamp'].dt.year
    df['month'] = df['timestamp'].dt.month
    df['month_name'] = df['timestamp'].dt.month_name()   
    df=df.dropna(subset='site_latitude')

    return df

def get_data_for_moran(df):
    # Extract relevant data for Local Moran's I
    features = []
    
    for index, row in df.iterrows():
        calibrated_value = row['pm2_5_calibrated_value']
        
        if pd.isnull(calibrated_value):  # Check for NaN values
            calibrated_value = row['pm2_5']
            
        latitude = row['site_latitude']
        longitude = row['site_longitude']
        
        features.append({'calibratedValue': calibrated_value, 'latitude': latitude, 'longitude': longitude})
        
    # Create a DataFrame from the list of features
    feature_df = pd.DataFrame(features)
    
    # Group by latitude and longitude, calculating the mean of calibratedValue
    feature_df = feature_df.groupby(['latitude', 'longitude'])['calibratedValue'].mean().reset_index()
    
    # Create a GeoDataFrame
    gdf = gpd.GeoDataFrame(feature_df, geometry=gpd.points_from_xy(feature_df['longitude'], feature_df['latitude']))
    
    return gdf


def create_spatial_weights(gdf):
    w = Queen.from_dataframe(gdf, use_index=False)
    return w

def moran_local_regression(gdf):
    w = create_spatial_weights(gdf)
    y = gdf['calibratedValue'].values
    moran_loc = Moran_Local(y, w)
    return moran_loc

def moran_statistics(gdf):
    w = create_spatial_weights(gdf)
    moran = Moran(gdf['calibratedValue'], w)    
    moran_table = pd.DataFrame({
        "Moran-Index": [moran.I],
        'Z-Value': [moran.z_sim],
        'P-value': [moran.p_sim]
    })    
    return moran_table


def moran_local(moran_loc, gdf):
    # Create a new category column based on cluster types
    gdf['cluster_category'] = ['HH' if c == 1 else 'LH' if c == 2 else 'LL' if c == 3 else 'HL' if c == 4 else 'NS' for c in moran_loc.q]
    return gdf['cluster_category']

def moran_num_local(moran_loc, gdf):
    # Create a new category column based on cluster types
    gdf['cluster_num_category'] = moran_loc.q
    return gdf['cluster_num_category']


