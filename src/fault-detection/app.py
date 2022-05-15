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
    data = request.json
    lstm = classification.Classification()
    prediction = lstm.predict_faults(data)
    return jsonify(prediction.to_dict())

if __name__ == '__main__':
  
    # run() method of Flask class runs the application 
    # on the local development server.
    app.run()