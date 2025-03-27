import logging

from datetime import timezone, timedelta
from typing import Dict, Any, List

import ee
from google.oauth2 import service_account

from configure import Config
import osmnx as ox

import logging
from pyproj import Transformer, CRS
from shapely.geometry import Point
import osmnx as ox
import math
from collections import defaultdict
import requests

import datetime




class GetEnvironmentProfile:
    @staticmethod
    def initialize_earth_engine():
        ee.Initialize(
            credentials=service_account.Credentials.from_service_account_file(
                Config.CREDENTIALS,
                scopes=["https://www.googleapis.com/auth/earthengine"],
            ),
            project=Config.GOOGLE_CLOUD_PROJECT_ID,
        )
    @staticmethod
    def ensure_initialized():
        if not ee.data._initialized:  # Check if EE is already initialized
            GetEnvironmentProfile.initialize_earth_engine()

    @staticmethod
    def get_environment_profile(latitude, longitude, months, radius):
        GetEnvironmentProfile.ensure_initialized()
        today = datetime.date.today()
        start_date = ee.Date.fromYMD(today.year, today.month, today.day).advance(-months, 'month')
        end_date = ee.Date.fromYMD(today.year, today.month, today.day)
        point = ee.Geometry.Point(longitude, latitude)
        #print(f'start date{start_date} point {point}')
        """
        def get_mean(collection, band):
            try:
                collection = collection.filterDate(start_date, end_date).filterBounds(point).select(band)
                mean_value = collection.mean().reduceRegion(
                    ee.Reducer.mean(),
                    point.buffer(radius),
                    scale=1000
                ).get(band)
                print(f"This is the mean value{mean_value}")

                return mean_value.getInfo() if mean_value else None
            except ee.EEException as e:
                print(f"Error with Earth Engine API: {e}")
                return None
            except Exception as e:
                print(f"An unexpected error occurred: {e}")
                return None
        """
        def get_mean(collection, band):
            try:
                collection = collection.filterDate(start_date, end_date).filterBounds(point).select(band)
                if collection.size().getInfo() == 0:
                    # Check for empty collection
                    print(f"No data found for band {band} in the image collection.")
                    return None
                mean_value = collection.mean().reduceRegion(
                    ee.Reducer.mean(),
                    point.buffer(radius),
                    scale=1000
                ).get(band)
                if mean_value is None: 
                    # Added None check
                    print(f"No data returned by reduceRegion for band: {band}")
                    return None
                    
                mean_value_info = mean_value.getInfo() if mean_value else None
                print(f"Mean value for {band}: {mean_value_info}")  # Improved print statement for clarity
                return mean_value_info
            except ee.EEException as e:
                print(f"Error with Earth Engine API: {e}")
                return None
            except Exception as e:
                print(f"An unexpected error occurred: {e}")
                return None

        return {
            'mean_AOD': get_mean(ee.ImageCollection('MODIS/061/MCD19A2_GRANULES'), 'Optical_Depth_047'),
            'mean_CO': get_mean(ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CO'), 'CO_column_number_density'),
            'mean_NO2': get_mean(ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2'), 'tropospheric_NO2_column_number_density'),
            'date': end_date.format('YYYY-MM-dd').getInfo(),
            'months': months

        }

class GetLocationProfile:
    @staticmethod
    def create_buffer(latitude, longitude, radius):
        transformer = Transformer.from_crs(CRS("epsg:4326"), CRS("epsg:3857"), always_xy=True)
        point = Point(longitude, latitude)
        point_transformed = transformer.transform(point.x, point.y)
        buffer = point_transformed.buffer(radius)
        buffer_transformed_back = transformer.transform(buffer.x, buffer.y)
        return buffer_transformed_back  
    
    @staticmethod
    def flatten_highway(highway):
        if isinstance(highway, list):
            return highway
        return [highway]

    def process_location(latitude: float, longitude: float, radius: int):
        try:
            # Get the road network within the specified radius
            G = ox.graph_from_point((latitude, longitude), dist=radius, network_type='all')

            # Convert the graph to GeoDataFrames
            nodes, edges = ox.graph_to_gdfs(G, nodes=True, edges=True)

            # Calculate the total length of the road network
            total_length = edges['length'].sum()

            # Calculate the area of the buffer
            buffer_area = math.pi * (radius ** 2)

            # Calculate road density
            road_density = total_length / buffer_area

            # Count intersections
            intersection_count = len(nodes)

            # Initialize a dictionary for road type lengths
            road_type_lengths = defaultdict(float)
            # Calculate the length for each road type
            for _, edge in edges.iterrows():
                for road_type in GetLocationProfile.flatten_highway(edge['highway']):
                    road_type_lengths[road_type] += edge['length']

            # Get buildings within the specified radius
            point = (latitude, longitude)
            try:
                buildings = ox.features_from_point(point, tags={'building': True}, dist=radius)
                number_of_buildings = len(buildings)
                building_density = number_of_buildings / buffer_area
                building_types = buildings['building'].unique() if 'building' in buildings.columns else []
            except Exception as e:
                number_of_buildings = 0
                building_density = 0
                building_types = 0
            # Compile the result for the given location
            result = {
            'latitude': latitude,
            'longitude': longitude,
            'total_road_length': total_length,
            'road_density': road_density,
            'intersection_count': intersection_count,
            'number_of_buildings': number_of_buildings,
            'building_density': building_density,
            #'building_types': ', '.join(building_types) if isinstance(building_types, list) else building_types
            }


            # Convert any ndarrays or other non-serializable types to lists or simple types
            result.update(road_type_lengths)

            return result
        
        except requests.exceptions.RequestException as e:
            return {'error': f"Network-related error: {e}"}
        except ValueError as e:
            return {'error': f"Data format error: {e}"}
        except Exception as e:
            return {'error': f"Unexpected error: {e}"}
