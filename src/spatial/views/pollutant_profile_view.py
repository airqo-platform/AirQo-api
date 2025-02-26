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

from models.pollutant_profile import GetLocationProfile,GetEnviromentProfile

def connect_mongo():
    client = MongoClient(Config.MONGO_URI)
    return client[Config.DB_NAME]

db = connect_mongo()
collection = db["combined_data"]


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
                return jsonify(simplified_data)

            except Exception as e:
                return jsonify({"error": f"Failed to fetch data: {e}"}), 500
            
