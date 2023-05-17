import decimal

from dotenv import load_dotenv
from flask import request, jsonify

from config.constants import connect_mongo
from models.predict import get_forecasts
from geojson import Feature, FeatureCollection, Point

import numpy as np
import datetime
import json
from bson import ObjectId
import multiprocessing

load_dotenv()
db = connect_mongo()


class CustomEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, datetime.datetime):
            return obj.isoformat()
        elif isinstance(obj, decimal.Decimal):
            return float(obj)
        elif isinstance(obj, ObjectId):
            return str(obj)
        elif isinstance(obj, np.int64):
            return int(obj)
        else:
            return super(CustomEncoder, self).default(obj)


def get_forecasts_helper(db_name):
    """
    Helper function to get forecasts for a given site_id and db_name
    """
    if request.method == 'GET':
        site_id = request.args.get('site_id')
        if site_id is None or not isinstance(site_id, str):
            return jsonify({"message": "Please specify a site_id", "success": False}), 400
        if len(site_id) != 24:
            return jsonify({"message": "Please enter a valid site_id", "success": False}), 400
        result = get_forecasts(site_id, db_name)
        if result:
            response = result
        else:
            response = {
                "message": "forecasts for this site are not available", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


def get_gp_predictions(airqloud, aq_id):
    """Returns PM 2.5 predictions for a particular airqloud name or id."""
    if airqloud:
        query = {'airqloud': airqloud.lower()}
    elif aq_id:
        query = {'airqloud_id': aq_id}
    else:
        query = {}

    projection = {
        '_id': 0,
        'latitude': 1,
        'longitude': 1,
        'predicted_value': 1,
        'variance': 1,
        'interval': 1,
        'airqloud': 1,
        'created_at': 1,
        'airqloud_id': 1,
        'values': 1
    }
    records = list(db.gp_predictions.find(query, projection))
    return records


def convert_to_geojson(records):
    """Converts the records to GeoJSON format."""
    features = []
    for record in records:
        point = Point((record['longitude'], record['latitude']))
        properties = {
            'predicted_value': record['predicted_value'],
            'variance': record['variance'],
            'interval': record['interval'],
            'airqloud': record['airqloud'],
            'created_at': record['created_at'],
            'airqloud_id': record['airqloud_id']
        }
        feature = Feature(geometry=point, properties=properties)
        features.append(feature)

    feature_collection = FeatureCollection(features)
    return feature_collection
