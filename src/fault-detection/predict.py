# -*- coding: utf-8 -*-
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