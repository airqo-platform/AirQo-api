# Standard Libraries
import os
import time
import math
import datetime
import warnings
from collections import defaultdict
import json

# Data Processing
import numpy as np
import pandas as pd
import geopandas as gpd

# Geospatial and Mapping
import rasterio
from rasterio.features import shapes, geometry_mask
from rasterio.plot import reshape_as_image
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform
from pyproj import Transformer, CRS
import osmnx as ox
import ee
import geemap

# Image Processing and Machine Learning
import tensorflow as tf
from skimage.morphology import remove_small_objects, binary_closing, disk

# Visualization
from matplotlib.patches import Polygon as pltPolygon



# MongoDB
from pymongo import MongoClient
from bson import json_util



# Configure Warnings
warnings.filterwarnings('ignore')



# Initialize MongoDB Client and connect to the database



# Ignore warnings
warnings.filterwarnings('ignore')

h5file = get_trained_model_from_gcs(
                Config.GOOGLE_CLOUD_PROJECT_ID,
                Config.PROJECT_BUCKET,
                "paperunetmodel100-031-0.440052-0.500628.h5",
            )



# Load the model
model = tf.keras.models.load_model(h5file, compile=False)


@staticmethod
def initialize_earth_engine():
    ee.Initialize(credentials=service_account.Credentials.from_service_account_file(
        Config.CREDENTIALS,
        scopes=['https://www.googleapis.com/auth/earthengine']
    ), project=Config.GOOGLE_CLOUD_PROJECT_ID)
# Function to load TIFF file
class PredictionAndProcessing:
    @staticmethod 
    def load_tiff(file_path):
        with rasterio.open(file_path) as src:
            image = src.read()
            profile = src.profile
        return reshape_as_image(image), profile

    # Function to normalize the image
    @staticmethod 
    def normalize_image(image):
        return image / np.max(image)

    # Function to preprocess the image for prediction
    @staticmethod 
    def preprocess_image(image_path):
        image, image_profile = load_tiff(image_path)
        # Check if the image has 4 channels (e.g., RGBA)
        if image.shape[-1] == 4:
            # Discard the alpha channel (keep only the first three channels: RGB)
            image = image[:, :, :3]
        image = normalize_image(image)
        return image, image_profile
    @staticmethod 
    def predict_and_get_centroids(image, image_profile):
        # Predict the probability map
        prediction_probabilities = model.predict(image[tf.newaxis, ...])[0, :, :, 0]
        
        # Create a binary mask by thresholding the probabilities
        binary_mask = (prediction_probabilities > 0.5).astype(np.uint8)
        binary_mask = remove_small_objects(binary_mask.astype(bool), min_size=500)
        binary_mask = binary_closing(binary_mask, disk(5))
        binary_mask = binary_mask.astype(np.uint8)
        
        # Generate geometries
        results = (
            {'properties': {'raster_val': v}, 'geometry': s}
            for i, (s, v) in enumerate(shapes(binary_mask, mask=None, transform=image_profile['transform']))
        )
        
        geoms = list(results)
        
        # Calculate confidence scores for each geometry
        for geom in geoms:
            polygon = shape(geom['geometry'])
            mask = geometry_mask([polygon], transform=image_profile['transform'], invert=True, out_shape=binary_mask.shape)
            mean_confidence = np.mean(prediction_probabilities[mask])
            geom['properties']['confidence_score'] = mean_confidence
        
        # Create a GeoDataFrame from the geometries
        gpd_polygonized_raster = gp.GeoDataFrame.from_features(geoms, crs='epsg:3857')
        gpd_polygonized_raster = gpd_polygonized_raster[gpd_polygonized_raster['raster_val'] > 0]
        # Drop the raster_val column
        gpd_polygonized_raster = gpd_polygonized_raster.drop(columns=['raster_val'])
        
        # Convert to WGS84 coordinate system (EPSG:4326)
        gpd_polygonized_raster = gpd_polygonized_raster.to_crs(epsg=4326)
        
        # Calculate centroid of each polygon
        gpd_polygonized_raster['Centroid_lat'] = gpd_polygonized_raster['geometry'].centroid.y
        gpd_polygonized_raster['Centroid_lon'] = gpd_polygonized_raster['geometry'].centroid.x
        #print(gpd_polygonized_raster[['Centroid_lat', 'Centroid_lon']])
        
        #return gpd_polygonized_raster
        return gpd_polygonized_raster


    # Function to create a buffer circle
    @staticmethod
    def create_buffer(latitude, longitude, radius):
        transformer = Transformer.from_crs(CRS("epsg:4326"), CRS("epsg:3857"), always_xy=True)
        point = Point(longitude, latitude)
        point_transformed = transform(transformer.transform, point)
        buffer = point_transformed.buffer(radius)
        buffer_transformed_back = transform(Transformer.from_crs(CRS("epsg:3857"), CRS("epsg:4326"), always_xy=True).transform, buffer)
        return buffer_transformed_back

    # Function to flatten the highway list
    @staticmethod
    def flatten_highway(highway):
        if isinstance(highway, list):
            return highway
        return [highway]
    @staticmethod
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
                for road_type in flatten_highway(edge['highway']):
                    road_type_lengths[road_type] += edge['length']

            # Get buildings within the specified radius
            point = (latitude, longitude)
            try:
                buildings = ox.features_from_point(point, tags={'building': True}, dist=radius)
                number_of_buildings = len(buildings)
                building_density = number_of_buildings / buffer_area
                building_types = buildings['building'].unique() if 'building' in buildings.columns else []
            except Exception as e:
                number_of_buildings = 'Error'
                building_density = 'Error'
                building_types = 'Error'
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

            #print(result)

            # Convert any ndarrays or other non-serializable types to lists or simple types
            result.update(road_type_lengths)

            return result

        except Exception as e:
            return {'error': f"Error processing location: {e}"}
    @staticmethod
    def get_environment_profile(latitude, longitude, months, radius):
        today = datetime.date.today()
        start_date = ee.Date.fromYMD(today.year, today.month, today.day).advance(-months, 'month')
        end_date = ee.Date.fromYMD(today.year, today.month, today.day)
        point = ee.Geometry.Point(longitude, latitude)

        def get_mean(collection, band):
            collection = collection.filterDate(start_date, end_date).filterBounds(point).select(band)
            mean_value = collection.mean().reduceRegion(ee.Reducer.mean(), point.buffer(radius), scale=1000).get(band)
            return mean_value.getInfo() if mean_value else None

        return {
            'mean_AOD': get_mean(ee.ImageCollection('MODIS/061/MCD19A2_GRANULES'), 'Optical_Depth_047'),
            'mean_CO': get_mean(ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CO'), 'CO_column_number_density'),
            'mean_NO2': get_mean(ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_NO2'), 'tropospheric_NO2_column_number_density')
        }




if __name__ == '__main__':
    app.run(host="0.0.0.0", debug=True, port=5001)
