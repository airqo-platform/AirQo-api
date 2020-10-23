import app
from routes import api
from flask import Blueprint, request, jsonify
import logging
import app
import json
import uncertainties.unumpy as unp
from jobs import regression
import os
from pymongo import MongoClient


calibrate_bp = Blueprint('calibrate_bp', __name__)


MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client['airqo_netmanager']
col = db["sensors"] 
raw_value = col.quantityKind[0]



@calibrate_bp.route(api.route['calibrate'], methods=['POST', 'GET'])
def calibrate_pm25_values():
    #predicted_values = intercept +  slope * raw_value
   
    if request.method == 'GET':
        raw_value = request.args.get('raw_value')
        #calibrated_value = 0.469 + 0.686 * float(raw_value)
        calibrated_value = regression.intercept + regression.slope * float(raw_value) 
        calibrated_value = calibrated_value.tolist()
        uncertainty_value = 1.2*float(raw_value)
        std_value = 0.5*float(raw_value)
        return jsonify({"message": "caliiiii", "calibration": calibrated_value, "uncertainty_value": calibrated_value, "std_value": calibrated_value})
