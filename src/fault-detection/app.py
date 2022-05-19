from flask import Flask, jsonify, request, make_response
import logging
import os
from models import classification
from dotenv import load_dotenv
load_dotenv()


app = Flask(__name__)


# app.config["MONGO_URI"] = os.getenv("MONGO_URI")

@app.route("/predict_faults", methods=['POST', 'GET'])
def predict_fault():
    data = request.get_json()
    datetime = data.get('datetime')
    raw_values = data.get('raw_values')       
    if (not datetime or not raw_values):
        return jsonify({"message": "Please specify the datetime, pm2.5, pm10, temperature and humidity values in the body. Refer to the API documentation for details.", "success": False}), 400     
    
    lstm = classification.Classification()
    prediction = lstm.predict_faults(raw_values, datetime)
    return jsonify(prediction.to_dict(orient="records"))

if __name__ == '__main__':
  
    # run() method of Flask class runs the application 
    # on the local development server.
    app.run()