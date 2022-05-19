from flask import jsonify, Blueprint, request,make_response, Flask
import pandas
from models import classification
from routes import api


fault_detection = Blueprint('fault_detection', __name__)

@fault_detection.route(api.route['predict_faults'], methods=['POST'])
def predict_faults():
    request_data = request.get_json()

    raw_values = request_data.get('raw_values')

    cat = classification.Classification()
    try:
        pred = cat.predict_faults(raw_values)
    except Exception as e:
        return jsonify({"error": str(e)})

    resp = {
    "datetime": request_data.get('datetime'),
    "values": pred.to_dict("records")
    }
    return resp

