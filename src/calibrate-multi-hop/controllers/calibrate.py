from routes import api
from flask import Blueprint, request, jsonify
import json
import os
import logging
from config.config import connect_mongo
from models import calibrate as cb

_logger = logging.getLogger(__name__)

calibrate_bp = Blueprint('calibrate_bp', __name__)


# MONGO_URI = os.getenv('MONGO_URI')
# client = MongoClient(MONGO_URI)
# db = client['airqo_netmanager_staging_airqo']
# col = db['calibration_ratios']

@calibrate_bp.route(api.route['ratios'], methods=['POST', 'GET'])
def save_ratios():
    '''
        save log ratios
    '''
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify(
                {
                    "message": "please specify the organization name. Refer to the API documentation for details.",
                    "success": False
                }), 400
        calibrateModel = cb.Calibrate(tenant)
        allcals = calibrateModel.allcals
        
        ratio_list = []
        for key, val in allcals.items():
            id, timeidx = key
            result_ratio = {"channel_index":int(id), "time_index":int(timeidx), "ratio":float(val)}
            ratio_list.append(result_ratio)
    
        calibrateModel.save_ratios(ratio_list)

        return  jsonify(status="done", action="Data saved Succesfully",error="false")
    else:
        return jsonify(
            {
                "message": "Invalid request method. Please refer to the API documentation",
                "success": False
            }), 400


@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate():

    if request.method == 'POST':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify(
                {
                    "message": "please specify the organization name. Refer to the API documentation for details.",
                    "success": False
                }), 400

        calibrateModel = cb.Calibrate(tenant) 

        data = request.get_json()
        if not data:
            return jsonify(
                {
                    "message": "please specify the request body. Refer to the API documentation for details.",
                    "success": False
                }), 400

        datetime = data.get('datetime')
        raw_values = data.get('raw_values')
        
        if (not datetime or not raw_values):
            return jsonify(
                {
                    "message": "Please specify the datetime and raw_values in the body. Refer to the API documentation for details.", 
                    "success": False
                }), 400

        response = []
        for raw_value in raw_values:
            value = calibrateModel.calibrate_sensor_raw_data(datetime, raw_value.get('sensor_id'), raw_value.get('raw_value'))
            response.append({'Sensor_id':raw_value.get('sensor_id'),'calibrated_value': value})
        return jsonify(response), 200
    else:
        return jsonify(
            {
                "message": "Invalid request method. Please refer to the API documentation",
                "success": False
            }), 400

    

