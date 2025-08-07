import os
from configure import Config
from pymongo import MongoClient  

from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from werkzeug.utils import secure_filename

# MongoDB
from bson import json_util

#processing results
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
import ee
import geemap
import osmnx as ox

import logging
from pyproj import Transformer, CRS
from shapely.geometry import Point
import osmnx as ox
import math
from collections import defaultdict
from models.pollutant_profile import GetLocationProfile,GetEnvironmentProfile, EnvironmentModel
 


def connect_mongo():
    client = MongoClient(Config.MONGO_URI)
    return client[Config.DB_NAME]

db = connect_mongo()
collection = db["combined_data"]
location_profile_collection = db["location_profile_data"]
environment_profile_collection = db["environment_profile_data"]
building_collection = db["buildings_and_landcover"]  # Variable name updated


class PollutantProfileApis:
        @staticmethod
        def get_all_data():
            try:
                # Retrieve all documents from the collection
                data = list(collection.find())

                # If no documents are found, return an error message
                if not data:
                    return jsonify({"error": "No data found in the database."}), 404

                # Convert the retrieved documents to a simplified JSON structure
                simplified_data = [
                    {
                        "item_id": str(doc["_id"]),  # Assuming _id is the unique identifier
                        "latitude": doc["properties"]["latitude"],
                        "longitude": doc["properties"]["longitude"],
                        "confidence_score": doc["properties"]["confidence_score"]
                    } for doc in data
                ]

                # Return the simplified data
                return simplified_data

            except Exception as e:
                return jsonify({"error": "Failed to fetch data"}), 500         
        @staticmethod
        def get_location_profile_data():
            try:
                # Retrieve all documents from the collection
                data = list(location_profile_collection.find())

                # If no documents are found, return an error message
                if not data:
                    return jsonify({"error": "No data found in the database."}), 404
                    
                return json_util.dumps({"data": data}), 200, {'ContentType':'application/json'}

                # Convert the retrieved documents to a simplified JSON structure

            except Exception as e:
                return jsonify({"error": "Failed to fetch data"}), 500   
                    
        @staticmethod
        def add_location_profile():
            radius = 500
            data = PollutantProfileApis.get_all_data()

            if isinstance(data, dict) and "error" in data:
                return jsonify(data), 404

            combined_data = []
            for i, item in enumerate(data):
                if not all(k in item for k in ['latitude', 'longitude', 'item_id', 'confidence_score']):
                    continue  # Skip items that do not have complete data

                try:
                    location_data = GetLocationProfile.process_location(float(item["latitude"]), float(item["longitude"]), radius) 

                    if "error" in location_data:
                        continue  # Consider whether to skip or handle differently

                    combined_item = {
                        "item_id": item["item_id"],
                        "latitude": item["latitude"],
                        "longitude": item["longitude"],
                        "confidence_score": item["confidence_score"],
                        "radius": radius,
                        **location_data
                    }
                    combined_data.append(combined_item)
                    if (i + 1) % 4 == 0:
                        try:
                            location_profile_collection.insert_many(combined_data)
                            combined_data = []  # Reset combined_data for the next batch
                        except Exception as e:
                            jsonify({"error": "Failed to save data"}), 400


                except Exception as e:
                    #logging.error(f"Error processing location for item {item['item_id']}: {e}")
                    continue

            if not combined_data:
                return jsonify({"error": "No data to process"}), 400

            try:
                
                location_profile_collection.insert_many(combined_data)
                
                return jsonify({"message": "Combined data saved to location_profile collection."})
            except Exception as e:
                return jsonify({"error": "An internal error has occurred"}), 500

        @staticmethod
        def add_environment_profile_data():

            radius = 500
            months = 6
            data = PollutantProfileApis.get_all_data()

            if isinstance(data, dict) and "error" in data:
                return jsonify(data), 404

            combined_data = []
            for i, item in enumerate(data):
                if not all(k in item for k in ['latitude', 'longitude', 'item_id', 'confidence_score']):
                    continue  # Skip items that do not have complete data

                try:
                    environment_data = GetEnvironmentProfile.get_environment_profile(float(item["latitude"]), float(item["longitude"]),months, radius)      
                    if isinstance(environment_data, dict) and "error" in environment_data:
                        combined_item = {
                            "item_id": item["item_id"],
                            "latitude": item["latitude"],
                            "longitude": item["longitude"],
                            "confidence_score": item["confidence_score"],
                            "radius": radius,
                            "mean_AOD": None,
                            "mean_CO": None,
                            "mean_NO2": None,

                                } # Consider whether to skip or handle differently
                    
                    else:
                        combined_item = {
                            "item_id": item["item_id"],
                            "latitude": item["latitude"],
                            "longitude": item["longitude"],
                            "confidence_score": item["confidence_score"],
                            "radius": radius,
                            "mean_AOD": environment_data.get('mean_AOD'),  # Use .get() for safety
                            "mean_CO": environment_data.get('mean_CO'),
                            "mean_NO2": environment_data.get('mean_NO2')
                        }
                    combined_data.append(combined_item)

                    if (i + 1) % 4 == 0:
                        try:
                            environment_profile_collection.insert_many(combined_data)
                            combined_data = []  # Reset combined_data for the next batch
                        except Exception as e:
                            return jsonify({"error": "An internal error has occurred"}), 500 


                except Exception as e:
                    continue

            if not combined_data:
                return jsonify({"error": "No data to process"}), 400

            try:
                
                environment_profile_collection.insert_many(combined_data)
                
                return jsonify({"message": "Combined data saved to location_profile collection."})
            except Exception as e:
                return jsonify({"error": "An internal error has occurred"}), 500
        
        
        @staticmethod
        def get_environment_profile_data():
            try:
                # Retrieve all documents from the collection
                data = list(PollutantProfileApis.environment_profile_collection.find())

                # If no documents are found, return an error message
                if not data:
                    return jsonify({"error": "No data found in the database."}), 404
                    
                return json_util.dumps({"data": data}), 200, {'ContentType':'application/json'}

                # Convert the retrieved documents to a simplified JSON structure

            except Exception as e:
                return jsonify({"error": "An internal error has occurred"}), 500   

        @staticmethod
        def add_building_landcover_profile_data():
            try:
                EnvironmentModel.ensure_initialized()
                lat = float(request.args.get("latitude"))
                lon = float(request.args.get("longitude"))
                radius = 500  # default radius in meters

                # Define EE geometry
                point = ee.Geometry.Point([lon, lat])
                buffer = point.buffer(radius)

                # Get EE-derived data
                buildings_data = EnvironmentModel.fetch_building_data(buffer)
                landcover_summary = EnvironmentModel.compute_landcover_summary(buffer)

                # Prepare document
                doc = {
                    "latitude": lat,
                    "longitude": lon,
                    "location": {
                        "type": "Point",
                        "coordinates": [lon, lat]
                    },
                    "radius_m": radius,
                    "timestamp": datetime.datetime.utcnow(),
                    "building_count": len(buildings_data),
                    "buildings": buildings_data,
                    "landcover_summary": landcover_summary
                }

                # Insert to MongoDB
                inserted_id = building_collection.insert_one(doc).inserted_id
                return jsonify({"status": "success", "id": str(inserted_id)})

            except Exception as e:
                logging.exception("Error in add_building_landcover_profile_data")
                return jsonify({"error": str(e)}), 500

        @staticmethod
        def add_bulk_building_landcover_profiles():
            radius = 500
            data = PollutantProfileApis.get_all_data()

            if isinstance(data, dict) and "error" in data:
                return jsonify(data), 404

            combined_data = []
            for i, item in enumerate(data):
                if not all(k in item for k in ['latitude', 'longitude', 'item_id', 'confidence_score']):
                    continue

                try:
                    EnvironmentModel.ensure_initialized()
                    point = ee.Geometry.Point([float(item["longitude"]), float(item["latitude"])])
                    buffer = point.buffer(radius)
                    buildings = EnvironmentModel.fetch_building_data(buffer)
                    landcover = EnvironmentModel.compute_landcover_summary(buffer)

                    record = {
                        "item_id": item["item_id"],
                        "latitude": item["latitude"],
                        "longitude": item["longitude"],
                        "confidence_score": item["confidence_score"],
                        "radius_m": radius,
                        "timestamp": datetime.datetime.utcnow(),
                        "building_count": len(buildings),
                        "buildings": buildings,
                        "landcover_summary": landcover
                    }

                    combined_data.append(record)

                    if (i + 1) % 4 == 0:
                        try:
                            building_collection.insert_many(combined_data)
                            combined_data = []
                        except Exception as e:
                            logging.exception("Error in insert_many")
                            return jsonify({"error": "An internal error has occurred"}), 500

                except Exception as e:
                    logging.warning(f"Skipping item due to error: {e}")
                    continue

            if not combined_data:
                return jsonify({"error": "No data to process"}), 400

            try:
                building_collection.insert_many(combined_data)
                return jsonify({"message": "Combined building-landcover data saved successfully."})
            except Exception as e:
                logging.exception("Final insert_many failed")
                return jsonify({"error": "An internal error has occurred"}), 500

        @staticmethod
        def get_building_landcover_profile_data_nojson():
            try:
                limit = int(request.args.get("limit", 10))
                docs = building_collection.find().sort("timestamp", -1).limit(limit)
                return json_util.dumps(list(docs)), 200
            except Exception as e:
                logging.exception("Error in get_building_landcover_profile_data")
                return jsonify({"error": str(e)}), 500
        @staticmethod
        def get_building_landcover_profile_data():
            try:
                limit = int(request.args.get("limit", 10))
                docs = building_collection.find().sort("timestamp", -1).limit(limit)

                features = []
                for doc in docs:
                    # Ensure geometry is in GeoJSON Point format
                    feature = {
                        "type": "Feature",
                        "geometry": doc.get("location"),
                        "properties": {k: v for k, v in doc.items() if k not in ["_id", "location"]}
                    }
                    feature["properties"]["_id"] = str(doc["_id"])  # Add ID as string
                    features.append(feature)

                geojson = {
                    "type": "FeatureCollection",
                    "features": features
                }

                return jsonify(geojson), 200

            except Exception as e:
                logging.exception("Error in get_building_landcover_profile_data")
                return jsonify({"error": str(e)}), 500
        @staticmethod
        def get_building_location_data():
            try:
                docs = building_collection.find({}, {
                    "_id": 1,
                    "latitude": 1,
                    "longitude": 1,
                    "timestamp": 1
                }).sort("timestamp", -1)
                return json_util.dumps(list(docs)), 200
            except Exception as e:
                logging.exception("Error in get_building_location_data")
                return jsonify({"error": str(e)}), 500