from flask import Blueprint, request, jsonify
import logging
import datetime as dt
from app import mongo
from helpers.clarity_api import ClarityApi
from bson import json_util, ObjectId
import json

_logger = logging.getLogger(__name__)

analytics_app = Blueprint('analytics_app', __name__)


@analytics_app.route('/api/v1/device/measurements', methods=['GET'])
def get_and_save_device_measurements():
    if request.method == 'GET':
        code= request.args.get('code')
        startTime= request.args.get('startTime')
        average= request.args.get('average')
        limit= request.args.get('limit')

        clarity_api = ClarityApi()  
        if average=='hour': 
            clarity_api.save_clarity_device_measurements(average,code,startTime, limit)
            return jsonify({'response':'device measurements saved'}),200
        elif average=='day':
            clarity_api.save_clarity_device_daily_measurements(average,code,startTime, limit)
            return jsonify({'response':'device daily measurements saved'}),200

@analytics_app.route('/api/v1/save_devices', methods=['GET'])
def get_and_save_devices():
    if request.method == 'GET':
        clarity_api = ClarityApi()
        clarity_api.save_clarity_devices()
    return jsonify({'response':'devices saved'}),200

@analytics_app.route('/api/v1/divisions', methods=['GET'])
def get_divisions():
    divisions=[]
    division_cursor =  mongo.db.division.find()
    for division in division_cursor:
        divisions.append(division)

    results = json.loads(json_util.dumps(divisions))
    return jsonify({"divisions":results}), 200

@analytics_app.route('/api/v1/devices', methods=['GET'])
def get_devices():
    if request.method == 'GET':
        clarity_api = ClarityApi()
        devices, status_code =  clarity_api.get_all_devices()
        return jsonify(devices)

@analytics_app.route('/api/v1/locations', methods=['GET'])
def get_locations():
    if request.method == 'GET':
        all_locations = ['Kampala','Mukono']
        return jsonify({'locations': all_locations})
       
        
@analytics_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'


       
        
        
        

        

