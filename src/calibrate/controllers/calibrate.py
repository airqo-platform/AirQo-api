from routes import api
from flask import Blueprint, request, jsonify
from models import regression as rg
from models import calibrate_tool as calibration_tool
from models import train_calibrate_tool as training_tool
import pandas as pd
import csv

calibrate_bp = Blueprint('calibrate_bp', __name__)

@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate():    
    if request.method == 'POST': 
        data = request.get_json()
        datetime = data.get('datetime')
        raw_values = data.get('raw_values')       
        if (not datetime or not raw_values):
            return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400     
        rgModel = rg.Regression()

        response = []
        for raw_value in raw_values:
            device_id = raw_value.get('device_id')
            pm2_5 = raw_value.get('sensor1_pm2.5')
            s2_pm2_5 = raw_value.get('sensor2_pm2.5')
            pm10 = raw_value.get('sensor1_pm10')
            s2_pm10 = raw_value.get('sensor2_pm10')
            temperature = raw_value.get('temperature')
            humidity = raw_value.get('humidity')

            if (not device_id or not pm2_5 or not s2_pm2_5  or not pm10 or not s2_pm10 or not temperature or not humidity):
                return jsonify({"message": "Please specify the device_id, datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400
            calibrated_pm2_5, calibrated_pm10 = rgModel.compute_calibrated_val(pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime)           
            response.append({'device_id': device_id, 'calibrated_PM2.5': calibrated_pm2_5, 'calibrated_PM10': calibrated_pm10 })
        return jsonify(response), 200

@calibrate_bp.route(api.route['calibrate_tool'], methods=['POST', 'GET'])
def calibrate_tool():    
    if request.method == 'POST': # get headers to check content type eg json or csv
        map_columns = request.form
        file=request.files['file']
        df=pd.read_csv(file)
        if (not file):
            return jsonify({"message": "Please upload CSV file with the following information datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature and humidity values. Refer to the API documentation for details.", "success": False}), 400
        
        rgModel = calibration_tool.Regression()
        
        calibrated_data = rgModel.compute_calibrated_val(map_columns, df)  
        calibrated_data.to_csv('calibrated_data.csv')        
        
    return "Your data is ready for download", 200
        
@calibrate_bp.route(api.route['train_calibrate_tool'], methods=['POST', 'GET'])
def train_calibrate_tool(): 
    if request.method == 'POST': # get headers to check content type eg json or csv
            pollutant = request.form['pollutant']
            map_columns = request.form
            file=request.files['file']
            df=pd.read_csv(file)
            if (not file):
                return jsonify({"message": "Please upload CSV file with the following information datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature, humidity and collocated reference monitor PM values. Refer to the API documentation for details.", "success": False}), 400
            
            rgtool = training_tool.Train_calibrate_tool()
    
            calibrated_data_ext = rgtool.train_calibration_model(pollutant, map_columns, df)
            calibrated_data_ext.to_csv('calibrated_data_ext.csv')  
            
            return "Your data is ready for download", 200