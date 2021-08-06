from flask import Blueprint, request, jsonify
import logging
import app
import json
from helpers import db_helpers, utils
from models import load
from routes import api
from flask_cors import CORS
import sys
from datetime import datetime

_logger = logging.getLogger(__name__)

load_bp = Blueprint('load', __name__)


@load_bp.route(api.route['load'], methods=['POST'])
def get_device_status():
    '''
    Get device status
    '''
    model = load.Exceedance()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_device_status(tenant)

        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        if len(response) == 0:
            return jsonify({"message": "No device status report available for " + tenant + " organization. please make sure you have provided a valid organization name.", "success": False}), 400
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400
