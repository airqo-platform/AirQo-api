from flask import jsonify, Blueprint, request,make_response, Flask
import pandas
from models import classification
from routes import api


fault_detection = Blueprint('fault_detection', __name__)

@fault_detection.route(api.route['predict_faults'], methods=['POST'])
def predict_faults():
    request_data = request.get_json()
    cat = classification.Classification()
    try:
        pred = cat.predict_faults(request_data)
    except Exception as e:
        return jsonify({"error": str(e)})

    return jsonify(pred.to_dict("records"))

