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
from models import calibrate as cb


calibrate_bp = Blueprint('calibrate_bp', __name__)


# MONGO_URI = os.getenv("MONGO_URI")
# client = MongoClient(MONGO_URI)
# db = client['airqo_netmanager_staging_airqo']
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

        return jsonify({"calibrated Value": calibrated_value, "Performance Evaluation": performance_eval})



@calibrate_bp.route(api.route['mobilecalibrate'], methods=['POST', 'GET'])
def calibrate():
    if request.method == 'GET':
        datetime = request.args.get('datetime')
        sensor_id = request.args.get('sensorid')
        raw_value = request.args.get('raw_value')

        if (not raw_value or not datetime or not sensor_id):
            return jsonify({"message": "please specify all the query parameters i.e.raw_value , datetime ,sensorid. Refer to the API documentation for details.", "success": False}), 400
        
        calibrateModel = cb.Calibrate()
        response = calibrateModel.calibrate_sensor_raw_data(raw_value, datetime, sensor_id)
        return jsonify(response), 200


