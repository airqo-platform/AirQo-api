import app
from routes import api
from flask import Blueprint, request, jsonify
import logging
import app
import json
import os
import numpy as np
import pandas as pd
import datetime
from pymongo import MongoClient
from models import regression as rg
from models import calibrate as cb
import pickle


calibrate_bp = Blueprint('calibrate_bp', __name__)

@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate():
    rgModel = rg.Regression()
    rf_regressor = rgModel.random_forest

    if request.method == 'POST':
        data = request.get_json()
        datetime = data.get('datetime')
        raw_values = data.get('raw_values')
        
        if (not datetime or not raw_values):
            return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400     

        # calibrateModel = cb.Calibrate()
        response = []
        for raw_value in raw_values:
            # value = calibrateModel.calibrate_sensor_raw_data(datetime, raw_value.get('sensor_id'), raw_value.get('raw_value'))
            device_id = raw_value.get('device_id')
            pm2_5 = raw_value.get('sensor1_pm2.5')
            s2_pm2_5 = raw_value.get('sensor2_pm2.5')
            pm10 = raw_value.get('sensor1_pm10')
            s2_pm10 = raw_value.get('sensor2_pm10')
            temperature = raw_value.get('temperature')
            humidity = raw_value.get('humidity')

            if (not device_id or not pm2_5 or not s2_pm2_5  or not pm10 or not s2_pm10 or not temperature or not humidity):
                return jsonify({"message": "Please specify the device_id, datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400
            
            # features from datetime and PM
            datetime = pd.to_datetime(datetime)
            hour = datetime.hour
            input_variables = pd.DataFrame([[pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity,hour]],
                                        columns=['pm2_5','s2_pm2_5','pm10','s2_pm10','temperature','humidity','hour'],
                                        dtype='float',
                                        index=['input'])
            input_variables["s2_pm2_5"]= np.where(input_variables["s2_pm2_5"]==0,input_variables["pm2_5"],input_variables["s2_pm2_5"])
            input_variables["s2_pm10"]= np.where(input_variables["s2_pm10"]==0,input_variables["pm10"],input_variables["s2_pm10"])
            input_variables["avg_pm2_5"] = input_variables[['pm2_5','s2_pm2_5']].mean(axis=1).round(2)
            input_variables["avg_pm10"] =  input_variables[['pm10','s2_pm10']].mean(axis=1).round(2)
            input_variables["error_pm2_5"]=input_variables["pm10"]-input_variables["s2_pm10"]
            input_variables["error_pm10"]=np.abs(input_variables["pm10"]-input_variables["s2_pm10"])
            input_variables["error_pm2_5"]=np.abs(input_variables["pm2_5"]-input_variables["s2_pm2_5"])
            input_variables["pm2_5_pm10"]=input_variables["avg_pm2_5"]-input_variables["avg_pm10"]
            input_variables["pm2_5_pm10_mod"]=input_variables["pm2_5_pm10"]/input_variables["avg_pm10"]
                
                
            # rf_reg = pickle.load(open('../jobs/rf_reg_model.sav', 'rb'))
            
            value = rf_regressor.predict(input_variables)[0]         
        
        response.append({'device_id': device_id, 'calibrated_value': value})
        return jsonify(response), 200


