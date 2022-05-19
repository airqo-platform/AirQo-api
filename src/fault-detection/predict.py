# -*- coding: utf-8 -*-


sample = {
    "datetime": "2020-07-15 13:00:00",
    "raw_values": [
        {
            "device_id":"aq_01", 
            "sensor1_pm2.5": 44.12 , 
            "sensor1_pm10":54.20, 
            "sensor2_pm2.5": 44.12 , 
            "sensor2_pm10":54.20,
            "temperature":25.3, 
            "humidity":62.0 
        },
        {
            "device_id": "aq_02",
            "sensor1_pm2.5": 44.12 , 
            "sensor1_pm10":54.20, 
            "sensor2_pm2.5": 44.12 , 
            "sensor2_pm10":54.20,
            "temperature":25.3, 
            "humidity":62.0 
        },
        {
            "device_id": "aq_03",
            "sensor1_pm2.5": 44.12 , 
            "sensor1_pm10":54.20, 
            "sensor2_pm2.5": 44.12 , 
            "sensor2_pm10":54.20,
            "temperature":25.3, 
            "humidity":62.0 
        }
    ]
}



"""
@author: Professor
"""

from flask import Flask,render_template,request, jsonify
from models.classification import Classification
import numpy as np
import pandas as pd

app = Flask(__name__)
@app.route('/')
def hello_world():
    return("Welcome, please smile more")

@app.route("/predict", methods=['GET', 'POST'])
def predict():
    raw_data = request.get_json(force=True)
    data = pd.DataFrame(raw_data["raw_values"])
    data["datetime"] = raw_data["datetime"]
    return Classification.compute_predictions(data)
if __name__ =="__main__":
    app.run()