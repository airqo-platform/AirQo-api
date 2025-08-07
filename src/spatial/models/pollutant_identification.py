# Standard Libraries
import math
import datetime
import warnings
from collections import defaultdict
# Data Processing
import numpy as np
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

# Image Processing and Machine Learning
import tensorflow as tf
from skimage.morphology import remove_small_objects, binary_closing, disk

# MongoDB
from configure import load_tflite_model_from_gcs, Config

#authentification
from google.oauth2 import service_account


# Ignore warnings
warnings.filterwarnings('ignore')

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
        image, image_profile = PredictionAndProcessing.load_tiff(image_path)
        # Check if the image has 4 channels (e.g., RGBA)
        if image.shape[-1] == 4:
            # Discard the alpha channel (keep only the first three channels: RGB)
            image = image[:, :, :3]
        image = PredictionAndProcessing.normalize_image(image)
        return image, image_profile

    @staticmethod 
    def predict_and_get_centroids(image, image_profile,interpreter):
        # Get input and output tensors
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        # Prepare input data
        # Assuming image_rgb is already defined and loaded
        image = np.array(image, dtype=np.float32)  # Ensure the image is float32 if required
        image = np.expand_dims(image, axis=0)  # Add batch dimension

        # Set the input tensor
        interpreter.set_tensor(input_details[0]['index'], image)

        # Run inference
        interpreter.invoke()

        # Get the output tensor and probabilities
        prediction_probabilities = interpreter.get_tensor(output_details[0]['index'])[0, :, :, 0]

        # Create a binary mask by thresholding the probabilities
        binary_mask = (prediction_probabilities > 0.5).astype(np.uint8)  # Convert to uint8

        # Post-process the binary mask
        binary_mask = remove_small_objects(binary_mask.astype(bool), min_size=500)
        binary_mask = binary_closing(binary_mask, disk(5))
        binary_mask = binary_mask.astype(np.uint8)  # Ensure binary mask is uint8


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
        gpd_polygonized_raster = gpd.GeoDataFrame.from_features(geoms, crs='epsg:3857')
        gpd_polygonized_raster = gpd_polygonized_raster[gpd_polygonized_raster['raster_val'] > 0]
        # Drop the raster_val column
        gpd_polygonized_raster = gpd_polygonized_raster.drop(columns=['raster_val'])

        # Convert to WGS84 coordinate system (EPSG:4326)
        gpd_polygonized_raster = gpd_polygonized_raster.to_crs(epsg=4326)

        # Calculate centroid of each polygon
        gpd_polygonized_raster['Centroid_lat'] = gpd_polygonized_raster['geometry'].centroid.y
        gpd_polygonized_raster['Centroid_lon'] = gpd_polygonized_raster['geometry'].centroid.x
        return gpd_polygonized_raster


