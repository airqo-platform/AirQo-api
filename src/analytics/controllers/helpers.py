from flask import Blueprint, request, jsonify, Response
import logging
import datetime as dt
from app import mongo
from helpers.clarity_api import ClarityApi
from bson import json_util, ObjectId
import json
import sys
from datetime import datetime,timedelta
from helpers import mongo_helpers
from helpers import helpers 
from flask_cors import CORS, cross_origin

_logger = logging.getLogger(__name__)

analytics_app = Blueprint('analytics_app', __name__)

#cors = CORS(analytics_app)
#analytics_app.config['CORS_HEADERS'] = 'Content-Type'



@analytics_app.route('/api/v1/device/codes', methods =['GET'])
def get_device_codes():
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    devices_codes_list=[]
    for device_code in devices_codes[0:2]:        
        last_time = mongo_helpers.get_last_time_from_device_hourly_measurements(device_code['code']) 
        start_time = helpers.date_to_str(helpers.str_to_date(last_time) + timedelta(hours=1)) 
        devices_codes_list.append({"code":device_code['code'],"start time":start_time, "last time": last_time})
    return jsonify({'device codes':devices_codes_list }), 200


@analytics_app.route('/api/v1/device/measurements/daily/save', methods =['GET'])
def get_and_save_daily_measurements():
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    clarity_api = ClarityApi()
    average='day'
    for code in devices_codes:
        clarity_api.save_clarity_device_daily_measurements_v2(average, code['code'] )
    return jsonify({'response': 'all daily measurements saved'}), 200


@analytics_app.route('/api/v1/device/measurements/daily/update', methods =['GET'])
def update_device_daily_measurements():
    clarity_api = ClarityApi() 
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    average='day'
    for device_code in devices_codes:
        code= device_code['code']            
        clarity_api.update_device_daily_measurements(code,average)
    return jsonify({'response': 'all new hourly measurements saved'}), 200  

@analytics_app.route('/api/v1/device/measurements/hourly/save', methods =['GET'])
def get_and_save_hourly_measurements():
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    clarity_api = ClarityApi()
    average='hour'
    for code in devices_codes:
        clarity_api.save_clarity_device_hourly_measurements_v2(average, code['code'])
    return jsonify({'response': 'all hourly measurements saved'}), 200

@analytics_app.route('/api/v1/device/measurements/hourly/update', methods =['GET'])
def update_device_hourly_measurements():
    clarity_api = ClarityApi() 
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    average='hour'
    for device_code in devices_codes:
        code= device_code['code']            
        clarity_api.update_device_hourly_measurements(code,average)
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
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    clarity_api = ClarityApi()
    for code in devices_codes:
        clarity_api.save_clarity_raw_device_measurements(code)
    return jsonify({'response': 'all raw measurements saved'}), 200

@analytics_app.route('/api/v1/device/measurements/raw/update', methods =['GET'])
def update_raw_measurements():
    devices_codes =  list(mongo.db.devices.find({},{"code": 1, "_id": 0}))
    clarity_api = ClarityApi()
    for code in devices_codes:
        clarity_api.update_clarity_data(code)
    return jsonify({'response': 'all new raw measurements saved'}), 200

@analytics_app.route('/api/v1/device/graph', methods=['GET','POST'])
@cross_origin()
def get_filtered_data():
    if request.method=='POST':
        print ('POST REQUEST MADE:', file=sys.stderr)
        json_data = request.get_json()
        if not json_data:
            print ('JSON DATA IS EMPTY:', file=sys.stderr)
            return jsonify({'response': 'No input data found'}), 200
        else:
            #device_code =json_data["device_code"]
            print('POST REQUEST MADE!', file=sys.stderr)
            device_code =json_data["location"]
            print('device code:',device_code, file=sys.stderr)
            start_date =json_data["start_date"]
            print('start date:',start_date, file=sys.stderr)
            start_time =json_data["start_time"]
            print('start time:',start_time, file=sys.stderr)
            end_date =json_data["end_date"]
            print(end_date, file=sys.stderr)
            end_time =json_data["end_time"]
            print(end_time, file=sys.stderr)
            chart_type =json_data["chart_type"]
            print('chart type:',chart_type, file=sys.stderr)
            frequency =json_data["frequency"]
            print(frequency, file=sys.stderr)
            pollutant =json_data["pollutant"]
            print(pollutant, file=sys.stderr)

            start = helpers.generate_datetime(start_date, start_time)
            end = helpers.generate_datetime(end_date, end_time)
            if chart_type==None:
                chart_type='bar graph'
            if chart_type=='bar graph' or chart_type =='line graph':
                records = mongo_helpers.get_filtered_data(device_code, start, end, frequency, pollutant)
            elif chart_type =='pie chart':
                records = mongo_helpers.get_piechart_data(device_code, start, end, frequency, pollutant)
            return jsonify(records)
       
        #else:
         #   records = mongo_helpers.get_filtered_data(device_code, start, end, frequency, pollutant )
          #  print('bar graph coming through', file=sys.stderr)
        #if len(records)==0:
         #   return jsonify({'response': 'No records'}), 200
        #else:
            #return Response(json.dumps(records), mimetype='application/json')
         #   return jsonify(records)
    else:
        return jsonify({'response': 'No request made'}), 200
    
    #response.headers.add("Access-Control-Allow-Origin", "*")
    #response.headers.add("Access-Control-Allow-Origin", "*")

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

        
@analytics_app.route('/health', methods=['GET'])
def health():
    if request.method == 'GET':
        _logger.info('health status OK')
        return 'ok'


       
        
        
        

        

