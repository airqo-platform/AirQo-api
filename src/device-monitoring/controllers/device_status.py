from flask import Blueprint, request, jsonify
import logging
import app
import json
from helpers import db_helpers
from models import device_status
from routes import api
from flask_cors import CORS

_logger = logging.getLogger(__name__)

device_status_bp = Blueprint('device_status', __name__)


@device_status_bp.route(api.route['device_status'], methods=['GET'])
def get_device_status():
    '''
    Get device status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_device_status()
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400
