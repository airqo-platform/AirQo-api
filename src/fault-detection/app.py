from controllers.predict_faults import fault_detection
from flask import Flask, jsonify, request, make_response
import logging
import os
from routes import api
from models import classification
from dotenv import load_dotenv
load_dotenv()

_logger = logging.getLogger(__name__)

app = Flask(__name__)


# register blueprints
app.register_blueprint(fault_detection)
def predict_fault():
    data = request.get_json()
    datetime = data.get('datetime')
    raw_values = data.get('raw_values')       
    if (not datetime or not raw_values):
        return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400     
    
    lstm = classification.Classification()
    prediction = lstm.predict_faults(raw_values)
    return jsonify(prediction.to_dict(orient="records"))
