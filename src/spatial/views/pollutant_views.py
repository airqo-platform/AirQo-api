import os
from configure import load_tflite_model_from_gcs, Config
from pymongo import MongoClient  
from models.pollutant_identification import PredictionAndProcessing

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename

# MongoDB
from pymongo import MongoClient
from bson import json_util

#processing results
import os
import time
import math
import datetime
import warnings
from collections import defaultdict
import json

#authentification
from google.oauth2 import service_account

import rasterio
from rasterio.features import shapes, geometry_mask
from rasterio.plot import reshape_as_image
from shapely.geometry import shape, Point, mapping
from shapely.ops import transform
from pyproj import Transformer, CRS
import osmnx as ox
import ee
import geemap


def connect_mongo():
    client = MongoClient(Config.MONGO_URI)
    db = client[Config.DB_NAME]
    return db
db = connect_mongo()
collection = db["combined_data"]

#For data upload
UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
interpreter = load_tflite_model_from_gcs(
                           Config.GOOGLE_CLOUD_PROJECT_ID, 
                           Config.PROJECT_BUCKET, 
                           "optimized_pollutant_model.tflite")
if interpreter:
    print("TFLite model loaded successfully.")
    # You can now use tflite_model_interpreter for inference.
else:
    print("Failed to load TFLite model.")

class PollutantApis:
    @staticmethod
    def upload_image():
        # Check if the file is in the request
        if 'file' not in request.files:
            return jsonify({"error": "No file part in the request"}), 400

        # Get the file from the request
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # Save the uploaded file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        file.save(file_path)

        # Extract months and radius from the request and validate
        try:
            months = int(request.form['months'])  # Expecting months to come from form-data
            radius = int(request.form['radius'])  # Expecting radius to come from form-data
        except (KeyError, ValueError):
            return jsonify({"error": "Both 'months' and 'radius' must be provided as valid integers"}), 400

        try:
            start_centroid_time = time.time()  # Record start time for centroids prediction

            # Preprocess the image and get centroids
            image, profile = PredictionAndProcessing.preprocess_image(file_path)
            print("This is the model path{tflite_model_path}")

            centroids = PredictionAndProcessing.predict_and_get_centroids(image, profile,interpreter)

            # Calculate duration for centroids prediction
            centroid_duration = time.time() - start_centroid_time
        except Exception as e:
            print(f"An error occurred while processing centroids: {str(e)}")
            # Optionally, return or continue depending on your application's needs
            return jsonify({"error": f"Error processing centroids: {str(e)}"}), 500
        # Start measuring time for centroids prediction


        # Handle case when no centroids are detected
        if centroids.empty:
            return jsonify({"error": "No centroids detected in the uploaded image."}), 404

        # Prepare GeoJSON-compliant records for MongoDB
        geojson_features = []
        current_time = datetime.datetime.now().isoformat()  # Get the current time in ISO format

        # Initialize durations
        total_location_duration = 0
        total_environment_duration = 0
        
       
        for _, centroid in centroids.iterrows():
            latitude = centroid['Centroid_lat']
            longitude = centroid['Centroid_lon']
            confidence_score = centroid["confidence_score"]
            """
            try:
                
                # Start measuring time for location processing
                start_location_time = time.time()  # Record start time for location processing
                location_data = PredictionAndProcessing.process_location(latitude, longitude, radius)
                location_duration = time.time() - start_location_time  # Calculate duration for location processing
                total_location_duration += location_duration  # Accumulate location processing duration

                
                # Start measuring time for environment data processing
                start_env_time = time.time()  # Record start time for environment data processing
                environment_data = PredictionAndProcessing.get_environment_profile(latitude, longitude, months, radius)
                environment_duration = time.time() - start_env_time  # Calculate duration for environment data processing
                total_environment_duration += environment_duration  # Accumulate environment processing duration

            except Exception as e:
                return jsonify({"error": f"Error processing data for centroid: {e}"}), 500
            """
            # Create a GeoJSON-compliant feature for MongoDB
            feature = {
                "type": "Feature",
                "geometry": mapping(centroid["geometry"]),  # Store geometry as GeoJSON
                "properties": {
                    "latitude": latitude,
                    "longitude": longitude,
                    "confidence_score": confidence_score,
                    "timestamp": current_time,  # Include the current time
                    #**location_data,  # Include location data as properties
                    #**environment_data  # Include environmental data as properties
                }
            }
            geojson_features.append(feature)

        # Insert all features into MongoDB as GeoJSON
        try:
           
            insert_result = collection.insert_many(geojson_features)
            #print(f"Inserted documents with IDs: {insert_result.inserted_ids}")
        except Exception as e:
            return jsonify({"error": f"Error inserting data into MongoDB: {e}"}), 500

        # Return a success response with durations
        return jsonify({
            "message": "Data successfully saved to MongoDB.",
            "inserted_ids": [str(id) for id in insert_result.inserted_ids],
            "current_time": current_time,  # Include current time in the response
            "centroid_processing_duration": centroid_duration,  # Duration for centroid prediction
            #"total_location_processing_duration": total_location_duration,  # Total duration for location data processing
            #"total_environment_processing_duration": total_environment_duration,  # Total duration for environment data processing
        }), 201

    @staticmethod
    def get_data_by_confidence():
        try:
            # Parse the minimum confidence score from query parameters
            min_confidence = float(request.args.get('min_confidence', 0))
            print(f"Querying with min_confidence: {min_confidence}")

            # Query documents where confidence_score is greater than or equal to min_confidence
            data = list(collection.find({
                "properties.confidence_score": {"$gte": min_confidence}
            }))

            # If no documents match, return an error message
            if not data:
                return jsonify({"error": "No data found for the given confidence score."}), 404

            # Convert the retrieved documents to a GeoJSON FeatureCollection
            geojson_data = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": doc["geometry"],
                        "properties": doc["properties"]
                    } for doc in data
                ]
            }

            # Return the GeoJSON data
            return Response(
                json.dumps(geojson_data, default=json_util.default),
                mimetype='application/geo+json'
            )

        except Exception as e:
            return jsonify({"error": f"Failed to fetch data: {e}"}), 500

    @staticmethod
    def get_all_data():
        try:
            # Retrieve all documents from the collection
            #data = list(collection.find({}))
            page = request.args.get('page', 1, type=int)
            per_page = request.args.get('per_page', 10, type=int)
            data = list(collection.find().skip((page - 1) * per_page).limit(per_page))

            # If no documents are found, return an error message
            if not data:
                return jsonify({"error": "No data found in the database."}), 404

            # Convert the retrieved documents to a GeoJSON FeatureCollection
            geojson_data = {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": doc["geometry"],
                        "properties": doc["properties"]
                    } for doc in data
                ]
            }

            # Return the GeoJSON data
            return Response(
                json.dumps(geojson_data, default=json_util.default),
                mimetype='application/geo+json'
            )

        except Exception as e:
            return jsonify({"error": f"Failed to fetch data: {e}"}), 500
