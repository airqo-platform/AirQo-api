from flask import Blueprint, request, jsonify
import logging
import datetime as dt
from app import mongo
from helpers.clarity_api import ClarityApi
from bson import json_util, ObjectId
import json
from datetime import datetime,timedelta

_logger = logging.getLogger(__name__)

analytics_app = Blueprint('analytics_app', __name__)



@analytics_app.route('/api/v1/device/codes', methods =['GET'])
def get_device_codes():
    clarity_api = ClarityApi() 
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    devices_codes_list=[]
    for device_code in devices_codes[0:2]:        
        last_time = clarity_api.get_last_time_from_device_hourly_measurements(device_code['code']) 
        start_time = clarity_api.date_to_str(clarity_api.str_to_date(last_time) + timedelta(hours=1)) 
        devices_codes_list.append({"code":device_code['code'],"start time":start_time, "last time": last_time})
    return jsonify({'device codes':devices_codes_list }), 200


@analytics_app.route('/api/v1/device/measurements/hourly/update', methods =['GET'])
def update_device_hourly_measurements():
    clarity_api = ClarityApi() 
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    #end_time = clarity_api.date_to_str(datetime.now())        
    average='hour'
    limit= 20000

    for device_code in devices_codes[0:2]:
        code= device_code['code']
        last_time = clarity_api.get_last_time_from_device_hourly_measurements(code) 
        start_time = clarity_api.date_to_str(clarity_api.str_to_date(last_time) + timedelta(hours=1))    
        clarity_api.save_clarity_device_hourly_measurements(average,code,start_time, limit)
    return jsonify({'response': 'all new hourly measurements saved'}), 200  
        
   
@analytics_app.route('/api/v1/device/measurements', methods=['GET'])
def get_and_save_device_measurements():
    if request.method == 'GET':
        code= request.args.get('code')
        startTime= request.args.get('startTime')
        average= request.args.get('average')
        limit= request.args.get('limit')

        clarity_api = ClarityApi()  
        if average=='hour': 
            clarity_api.save_clarity_device_hourly_measurements(average,code,startTime, limit)
            return jsonify({'response':'device measurements saved'}),200
        elif average=='day':
            clarity_api.save_clarity_device_daily_measurements(average,code,startTime, limit)
            return jsonify({'response':'device daily measurements saved'}),200

@analytics_app.route('/api/v1/device/measurements/raw', methods =['GET'])
def get_and_save_raw_measurements():
    device_code = request.args.get('code')
    clarity_api = ClarityApi()
    clarity_api.save_clarity_raw_device_measurements(device_code)
    return jsonify({'response': 'all raw measurements saved'}), 200

@analytics_app.route('/api/v1/device/measurements/raw/update', methods =['GET'])
def update_raw_measurements():
    device_code = request.args.get('code')
    clarity_api = ClarityApi()
    clarity_api.update_clarity_data(device_code)
    return jsonify({'response': 'all new raw measurements saved'}), 200

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
        return jsonify(devices),status_code

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


       
        
        
        

        

