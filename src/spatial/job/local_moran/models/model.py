import json
from datetime import datetime
import requests
import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account
import geopandas as gpd
from pysal.explore import esda
from libpysal.weights.contiguity import Queen
from esda.moran import Moran_Local, Moran
from configure import Config

class AirQualitySpatilaAnalyzer:
    def __init__(self):
        self.client = bigquery.Client()

    def fetch_air_quality_data(self, grid_id, start_time, end_time) -> list:
        start_time_iso = start_time.isoformat() + 'Z'
        end_time_iso = end_time.isoformat() + 'Z'

        grid_params = {
            "token": Config.AIRQO_API_TOKEN,
            "startTime": start_time_iso,
            "endTime": end_time_iso,
            "recent": "no"
        }

        grid_url = f"{Config.GRID_URL}{grid_id}"

        try:
            grid_response = requests.get(grid_url, params=grid_params)
            grid_response.raise_for_status()  

            data = grid_response.json()

            site_ids = [measurement.get('site_id') for measurement in data.get('measurements', [])]

            return site_ids
        except requests.exceptions.RequestException as e:
            print(f"Error fetching air quality data: {e}")
            return []

    def query_bigquery(self, site_ids, start_time, end_time):
        query = f"""
            SELECT site_id, timestamp, site_name, site_latitude, site_longitude,  pm2_5_raw_value,
            pm2_5_calibrated_value,  pm10_raw_value, pm10_calibrated_value, country, region, city, county
            FROM {Config.BIGQUERY_HOURLY_CONSOLIDATED}
            WHERE site_id IN UNNEST({site_ids})
            AND timestamp BETWEEN TIMESTAMP('{start_time.isoformat()}')
            AND TIMESTAMP('{end_time.isoformat()}')
            AND NOT pm2_5_raw_value IS NULL
        """

        try:
            query_job = self.client.query(query)
            data = query_job.to_dataframe()
            return data
        except Exception as e:
            print(f"Error querying BigQuery: {e}")
            return None

    def results_to_dataframe(self, results):
        df = (
            pd.DataFrame(results)
            .assign(timestamp=lambda x: pd.to_datetime(x['timestamp']))
            .assign(
                dates=lambda x: x['timestamp'].dt.date.astype(str),
                date=lambda x: pd.to_datetime(x['dates']),
                day=lambda x: x['timestamp'].dt.day_name(),
                hour=lambda x: x['timestamp'].dt.hour,
                year=lambda x: x['timestamp'].dt.year,
                month=lambda x: x['timestamp'].dt.month,
                month_name=lambda x: x['timestamp'].dt.month_name()
            )
            .dropna(subset=['site_latitude', 'site_longitude'])
        )
        return df

    def get_data_for_moran(self, df):
        features = []
        for index, row in df.iterrows():
            calibrated_value = row['pm2_5_calibrated_value']
            if pd.isnull(calibrated_value):
                calibrated_value = row['pm2_5_raw_value']
            latitude = row['site_latitude']
            longitude = row['site_longitude']
            features.append({'calibratedValue': calibrated_value, 'latitude': latitude, 'longitude': longitude})
        
        feature_df = pd.DataFrame(features)
        feature_df = feature_df.groupby(['latitude', 'longitude'])['calibratedValue'].mean().reset_index()
        gdf = gpd.GeoDataFrame(feature_df, geometry=gpd.points_from_xy(feature_df['longitude'], feature_df['latitude']))
        return gdf

    def create_spatial_weights(self, gdf):
        w = Queen.from_dataframe(gdf, use_index=False)
        return w

    def moran_local_regression(self, gdf):
        w = self.create_spatial_weights(gdf)
        y = gdf['calibratedValue'].values
        moran_loc = Moran_Local(y, w)
        return moran_loc

    def moran_statistics(self, gdf):
        w = self.create_spatial_weights(gdf)
        moran = Moran(gdf['calibratedValue'], w)    
        moran_table = pd.DataFrame({
            "Moran-Index": [moran.I],
            'Z-Value': [moran.z_sim],
            'P-value': [moran.p_sim]
        })    
        return moran_table

    def moran_local(self, moran_loc, gdf):
        gdf['cluster_category'] = ['HH' if c == 1 else 'LH' if c == 2 else 'LL' if c == 3 else 'HL' if c == 4 else 'NS' for c in moran_loc.q]
        return gdf['cluster_category']

    def moran_num_local(self, moran_loc, gdf):
        gdf['cluster_num_category'] = moran_loc.q
        return gdf['cluster_num_category']
