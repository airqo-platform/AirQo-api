from flask import jsonify, Blueprint, request

from models import classification as cat
from routes import api

fault_detection_bp = Blueprint("fault_detection_bp", __name__)


@fault_detection_bp.route(api.route["predict_faults_catboost"], methods=["POST"])
def predict_faults_catboost():
    request_data = request.get_json()
    raw_values = request_data.get("raw_values")

    try:
        pred = cat.Classification.predict_faults_catboost(raw_values)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    resp = {"datetime": request_data.get("datetime"), "values": pred.to_dict("records")}
    return resp


@fault_detection_bp.route(api.route["predict_faults_lstm"], methods=["POST"])
def predict_faults_lstm():
    request_data = request.get_json()
    raw_values = request_data.get("raw_values")

    try:
        pred = cat.Classification.predict_faults_lstm(raw_values)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    resp = {"datetime": request_data.get("datetime"), "values": pred.to_dict("records")}
    return resp
