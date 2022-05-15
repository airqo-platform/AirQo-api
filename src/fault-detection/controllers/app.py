from flask import jsonify, Blueprint, request,make_response, Flask
# from models import classification 

import sys
sys.path.append(r"/Users/paul/Documents/github_airqo/AirQo-api/src/fault-detection/")

from models import classification

app = Flask(__name__)


@app.route("/predict_fault", methods = ["POST"])
def predict_fault():
    request_data = request.get_json()
    cat = classification.Classification()
    try:
        pred = cat.predict_faults(request_data)
    except Exception as e:
        return jsonify({"error": str(e)})

    return jsonify(pred.to_dict("records"))