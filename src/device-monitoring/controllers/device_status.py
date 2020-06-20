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


@device_status_bp.route(api.route['all_devices_latest_status'], methods=['GET'])
def get_all_devices_latest_status():
    '''
    Get all devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_all_devices_latest_status()
        response_ = []
        if documents:
            result = documents[0]
            response = {'online_devices_percentage':result['online_devices_percentage'],
             'offline_devices_percentage': result['offline_devices_percentage'], 'created_at':result['created_at']}
        else:
            response = {"message": "Device status data not available", "success":False }
        for document in documents:            
            response_.append(document)
        data = jsonify({'data':response, 'all_data':response_})
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@device_status_bp.route(api.route['devices'], methods=['GET'])
def get_all_devices():
    '''
    Get all devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_all_devices()
        response = []
        '''
        if documents:
            result = documents[0]
            response = {'online_devices_percentage':result['online_devices_percentage'],
             'offline_devices_percentage': result['offline_devices_percentage'], 'created_at':result['created_at']}
        else:
            response = {"message": "Device status not available", "success":False }
        '''
        for document in documents:            
            response.append(document)
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400
