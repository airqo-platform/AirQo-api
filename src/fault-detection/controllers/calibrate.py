from routes import api
from flask import Blueprint, request, jsonify, make_response
from models import regression as rg
from models import calibrate_tool as calibration_tool
from models import train_calibrate_tool as training_tool
import pandas as pd

calibrate_bp = Blueprint('calibrate_bp', __name__)

@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate():    
    if request.method == 'POST': 
        data = request.get_json()
        datetime = data.get('datetime')
        raw_values = data.get('raw_values')       
        if (not datetime or not raw_values):
            return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400     
        model = rg.Regression()

        response = []
        for raw_value in raw_values:
            device_id = raw_value.get('device_id')
            s1_pm2_5 = raw_value.get('sensor1_pm2.5')
            s2_pm2_5 = raw_value.get('sensor2_pm2.5')

            if (not device_id or not s1_pm2_5 or not s2_pm2_5):
                return jsonify({"message": "Please specify the device_id, datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400
            calibrated_pm2_5, calibrated_pm10 = model.compute_calibrated_val(s1_pm2_5,s2_pm2_5)           
            response.append({'device_id': device_id, 'calibrated_PM2.5': calibrated_pm2_5, 'calibrated_PM10': calibrated_pm10 })
        return jsonify(response), 200


@calibrate_bp.route(api.route['calibrate_tool'], methods=['POST'])
def calibrate_tool():
    if 'file' not in request.files:
        return jsonify({"message": "File missing. Refer to the API documentation for details.",
                        "success": False}), 400

    map_columns = request.form
    form_keys = map_columns.keys()
    if not ("datetime" in form_keys and "pm2_5" in form_keys and "s2_pm2_5"):
        return jsonify({"message": "Please specify the corresponding datetime, sensor1 pm2.5, sensor2 pm2.5, "
                                   "sensor1 pm10, sensor1 pm10, temperature and humidity values. "
                                   "Refer to the API documentation for details.",
                        "success": False}), 400

    file = request.files.get('file')
    df = pd.read_csv(file)

    if not set(list(map_columns.values())).issubset(set(list(df.columns))):
        return jsonify({"message": "One or more keys are missing in the uploaded file.", "success": False}), 400

    model = calibration_tool.Regression()

    map_columns = {value: key for key, value in map_columns.items()}
    calibrated_data = model.compute_calibrated_val(map_columns, df)
    resp = make_response(calibrated_data.to_csv())
    resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp

@calibrate_bp.route(api.route['train_calibrate_tool'], methods=['POST', 'GET'])
def train_calibrate_tool(): 
    if request.method == 'POST': # get headers to check content type eg json or csv
            pollutant = request.form['pollutant']
            map_columns = request.form
            file=request.files['file']
            df=pd.read_csv(file)
            if (not file or not pollutant or not map_columns['ref_data'] or not map_columns['datetime'] or not map_columns['pm2_5'] or not map_columns['s2_pm2_5'] or not map_columns['pm10'] or not map_columns['s2_pm10'] or not map_columns['temperature'] or not map_columns['humidity']):
                return jsonify({"message": "Please specify pollutant and upload CSV file with the following information datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10, sensor1 pm10, temperature, humidity values and reference monitor PM. Refer to the API documentation for details.", "success": False}), 400
           
            rgtool = training_tool.Train_calibrate_tool()

            map_columns = {value: key for key, value in map_columns.items()}
            calibrated_data_ext = rgtool.train_calibration_model(pollutant, map_columns, df) 
            resp = make_response(calibrated_data_ext.to_csv())
            resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data_ext.csv"
            resp.headers["Content-Type"] = "text/csv"
    return resp
            