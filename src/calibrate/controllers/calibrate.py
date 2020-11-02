import app
from routes import api
from flask import Blueprint, request, jsonify
import logging
import app
import json
import uncertainties.unumpy as unp
from jobs import regression
import os
from pymongo import MongoClient
import uncertainties.unumpy as unp


calibrate_bp = Blueprint('calibrate_bp', __name__)


# MONGO_URI = os.getenv("MONGO_URI")
# client = MongoClient(MONGO_URI)
# db = client['airqo_netmanager_staging_airqo']


@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])

def calibrate_pm25_values():
    if request.method == 'GET':
        # raw_values_dict = db.events.find({'values.raw': {'$exists': 1}},{'_id':0, 'values.raw': 1})
        # raw_value_list = []
        # for value in raw_values_dict:
        #     raw_value_list.append(value)
        # raw_values = [pm['values'][0]['raw'] for pm in raw_value_list]  
        raw_values = request.args.get('raw_value')
        calibrated_value = regression.intercept + regression.slope * float(raw_values)
        calibrated_value = calibrated_value.tolist()
        performance_eval = regression.performance

        return jsonify({"calibrated Value": calibrated_value, "Performance Evaluation": performance_eval, "Confidence_intervals":confidence_int})
