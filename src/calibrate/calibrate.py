import pandas as pd
from flask import Blueprint, request, jsonify, make_response

from models import calibrate_tool as calibration_tool
from models import regression as rg
from models import train_calibrate_tool as training_tool
import api

calibrate_bp = Blueprint('calibrate_bp', __name__)


@calibrate_bp.route(api.route['calibrate'], methods=['POST'])
def calibrate():
    data = request.get_json()
    datetime = data.get('datetime')
    raw_values = data.get('raw_values')
    if not (datetime and raw_values):
        return jsonify({"message": "Please specify the datetime and raw_values values in the body. "
                                   "Refer to the API documentation for details.",
                        "success": False}), 400
    rg_model = rg.Regression()

    response = []
    for raw_value in raw_values:
        device_id = raw_value.get('device_id')
        pm2_5 = raw_value.get('sensor1_pm2.5')
        s2_pm2_5 = raw_value.get('sensor2_pm2.5')
        pm10 = raw_value.get('sensor1_pm10')
        s2_pm10 = raw_value.get('sensor2_pm10')
        temperature = raw_value.get('temperature')
        humidity = raw_value.get('humidity')

        if not (device_id and pm2_5 and s2_pm2_5 and pm10 and s2_pm10 and temperature and humidity):
            return jsonify({"message": "Please specify the device_id, datetime, sensor1 pm2.5, sensor2 pm2.5,"
                                       " sensor1 pm10, sensor1 pm10, temperature and humidity values in the body. "
                                       "Refer to the API documentation for details.",
                            "success": False}), 400

        calibrated_pm2_5, calibrated_pm10 = rg_model.compute_calibrated_val(
            pm2_5, s2_pm2_5, pm10, s2_pm10, temperature, humidity, datetime)

        response.append({'device_id': device_id, 'calibrated_PM2.5': calibrated_pm2_5,
                         'calibrated_PM10': calibrated_pm10})

    return jsonify(response), 200


@calibrate_bp.route(api.route['calibrate_tool'], methods=['POST'])
def calibrate_tool():
    if 'file' not in request.files:
        return jsonify({"message": "File missing. Refer to the API documentation for details.",
                        "success": False}), 400

    map_columns = request.form

    if not (map_columns.get("datetime") and map_columns.get("pm2_5") and map_columns.get("s2_pm2_5") and
            map_columns.get("pm10") and map_columns.get("s2_pm10") and map_columns.get("humidity") and
            map_columns.get("temperature")):
        return jsonify({"message": "Please specify the corresponding datetime, sensor1 pm2.5, sensor2 pm2.5, "
                                   "sensor1 pm10, sensor1 pm10, temperature and humidity values. "
                                   "Refer to the API documentation for details.",
                        "success": False}), 400

    file = request.files.get('file')
    df = pd.read_csv(file)

    if not set(list(map_columns.values())).issubset(set(list(df.columns))):
        return jsonify({"message": "One or more keys are missing in the uploaded file.", "success": False}), 400

    rg_model = calibration_tool.Regression()

    map_columns = {value: key for key, value in map_columns.items()}
    calibrated_data = rg_model.compute_calibrated_val(map_columns, df)
    resp = make_response(calibrated_data.to_csv())
    resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp


@calibrate_bp.route(api.route['train_calibrate_tool'], methods=['POST'])
def train_calibrate_tool():
    valid_pollutants = ("pm2_5", "pm10")
    pollutant = request.form['pollutant']
    pollutant = pollutant.lower()
    if pollutant not in valid_pollutants:
        return jsonify({"message": "Please specify valid pollutant (e.g pm2_5 or pm10)",
                        "success": False}), 400
    map_columns = request.form
    file = request.files['file']
    df = pd.read_csv(file)
    if (not file or not pollutant or not map_columns['ref_data'] or not map_columns['datetime'] or not map_columns[
        'pm2_5'] or not map_columns['s2_pm2_5'] or not map_columns['pm10'] or not map_columns['s2_pm10'] or not
    map_columns['temperature'] or not map_columns['humidity']):
        return jsonify({"message": "Please specify pollutant and upload CSV file with the following "
                                   "information datetime, sensor1 pm2.5, sensor2 pm2.5, sensor1 pm10,"
                                   " sensor1 pm10, temperature, humidity values and reference monitor PM."
                                   " Refer to the API documentation for details.",
                        "success": False}), 400

    rg_tool = training_tool.Train_calibrate_tool()

    map_columns = {value: key for key, value in map_columns.items()}
    calibrated_data_ext = rg_tool.train_calibration_model(pollutant, map_columns, df)
    resp = make_response(calibrated_data_ext.to_csv())
    resp.headers["Content-Disposition"] = "attachment; filename=calibrated_data_ext.csv"
    resp.headers["Content-Type"] = "text/csv"
    return resp
