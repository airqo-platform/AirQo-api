import app
from routes import api
from flask import Blueprint, request, jsonify
import logging
import app
import json
import os
from pymongo import MongoClient
from models import regression as rg
from models import calibrate as cb


calibrate_bp = Blueprint('calibrate_bp', __name__)


MONGO_URI = os.getenv('MONGO_URI')
client = MongoClient(MONGO_URI)
db = client['airqo_netmanager_staging_airqo']
col = db['calibration_ratios']

# @calibrate_bp.route(api.route['ratios'], methods=['POST', 'GET'])
# def save_ratios():
#     calibrateModel = cb.Calibrate() 
#     allcals = calibrateModel.allcals

#     ratio_list = []
#     for key, val in allcals.items():
#         id, timeidx = key
#         result_ratio = {"channel_index":int(id), "time_index":int(timeidx), "ratio":float(val)}
#         ratio_list.append(result_ratio)
    
#     col.insert_many(ratio_list)

#     return  jsonify(status="done", action="Data saved Succesfully",error="false")


@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate():

    if request.method == 'POST':
        data = request.get_json()
        datetime = data.get('datetime')
        raw_values = data.get('raw_values')
        
        if (not datetime or not raw_values):
            return jsonify({"message": "Please specify the datetime and raw_values in the body. Refer to the API documentation for details.", "success": False}), 400
    
        rgModel = rg.Regression()
        hourly_combined_dataset = rgModel.hourly_combined_dataset

        # calibrateModel = cb.Calibrate()
        response = []
        for raw_value in raw_values:
            # value = calibrateModel.calibrate_sensor_raw_data(datetime, raw_value.get('sensor_id'), raw_value.get('raw_value'))
            value = rgModel.simple_lr(raw_value.get('raw_value'), hourly_combined_dataset)
            response.append({'calibrated_value': value})
        return jsonify(response), 200

    

