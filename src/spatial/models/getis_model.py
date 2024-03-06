import json
from datetime import datetime
import requests
import pandas as pd
from google.cloud import bigquery
from google.oauth2 import service_account
import geopandas as gpd
from libpysal.weights import KNN
from esda import G_Local
import numpy as np
from configure import Config

class AirQualitySpatialAnalyzer_getis:
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
            print(f"Error fetching air quality data:  ")
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

    def get_data_for_getis(self, df):
        features = []
        for index, row in df.iterrows():
            calibrated_value = row['pm2_5_calibrated_value']
            if pd.isnull(calibrated_value):
                calibrated_value = row['pm2_5_raw_value']
            latitude = row['site_latitude']
            longitude = row['site_longitude']
            features.append({'PM2_5_Value': calibrated_value, 'latitude': latitude, 'longitude': longitude})
        
        feature_df = pd.DataFrame(features)
        feature_df = feature_df.groupby(['latitude', 'longitude'])['PM2_5_Value'].mean().reset_index()
        gdf = gpd.GeoDataFrame(feature_df, geometry=gpd.points_from_xy(feature_df['longitude'], feature_df['latitude']))
        return gdf

    def Getis_ord_GI(self, gdf, k=4): 
        pm2_5 = gdf['PM2_5_Value'].values
        w = KNN.from_dataframe(gdf, k=k) 
        g_local = G_Local(pm2_5, w)
        p_values = g_local.p_sim
        z_scores = g_local.Zs
        alpha = 0.05
        significant_hot_spots = (p_values < alpha) & (z_scores > 0)
        significant_cold_spots = (p_values < alpha) & (z_scores < 0)
        not_significant = p_values >= alpha
        return significant_hot_spots, significant_cold_spots, not_significant 
    
    def Getis_ord_GI_confidence(self, gdf, k=4): 
        pm2_5 = gdf['PM2_5_Value'].values
        w = KNN.from_dataframe(gdf, k=k) 
        g_local = G_Local(pm2_5, w)
        p_values = g_local.p_sim
        z_scores = g_local.Zs
        alpha_99 = 0.01  # 99% confidence level
        alpha_95 = 0.05  # 95% confidence level
        alpha_90 = 0.10  # 90% confidence level
        significant_hot_spots_99 = (p_values < alpha_99) & (z_scores > 0)
        significant_hot_spots_95 = (p_values < alpha_95) & (z_scores > 0)
        significant_hot_spots_90 = (p_values < alpha_90) & (z_scores > 0)

        significant_cold_spots_99 = (p_values < alpha_99) & (z_scores < 0)
        significant_cold_spots_95 = (p_values < alpha_95) & (z_scores < 0)
        significant_cold_spots_90 = (p_values < alpha_90) & (z_scores < 0)
        not_significant = ~(
        significant_hot_spots_99 | significant_hot_spots_95 | significant_hot_spots_90 |
        significant_cold_spots_99 | significant_cold_spots_95 | significant_cold_spots_90
    )

        return (significant_hot_spots_99,significant_hot_spots_95,
                significant_hot_spots_90, significant_cold_spots_99,
                significant_cold_spots_95,significant_cold_spots_90,
                not_significant)