from routes import api
from flask import Blueprint, request, jsonify
from models import regression as rg
from models import calibrate_tool as tool

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
    
    if request.method == 'POST':
        data = request.get_json()
        sensor_data = data.get('sensor_data')
        
        if (not sensor_data):
            return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature, humidity and reference monitor PM2.5 or reference monitor PM10 values in the body. Refer to the API documentation for details.", "success": False}), 400     

        rgtool = tool.Calibrate_tool()

        response = []
        for sensor_data in sensor_data:
            datetime = sensor_data.get('datetime')

            device_id = sensor_data.get('device_id')
            pm2_5 = sensor_data.get('sensor1_pm2.5')
            s2_pm2_5 = sensor_data.get('sensor2_pm2.5')
            pm10 = sensor_data.get('sensor1_pm10')
            s2_pm10 = sensor_data.get('sensor2_pm10')
            temperature = sensor_data.get('temperature')
            humidity = sensor_data.get('humidity')
            reference_data = sensor_data.get('reference_data')

            if (not datetime or not device_id or not pm2_5 or not s2_pm2_5  or not pm10 or not s2_pm10 or not temperature or not humidity or not reference_data):
                return jsonify({"message": "Please specify the device_id, datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature, humidity and reference monitor PM2.5 or reference monitor PM10 values in the body. Refer to the API documentation for details.", "success": False}), 400
            
            model_pm2_5, model_pm10 = rgtool.train_calibration_model(pm2_5,s2_pm2_5,pm10,s2_pm10,temperature,humidity, datetime, reference_data)           
        
            response.append({'device_id': device_id,'model_PM2.5': model_pm2_5, 'model_PM10': model_pm10 })
        return jsonify(response), 200


