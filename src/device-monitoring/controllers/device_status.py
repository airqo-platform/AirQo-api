from flask import Blueprint, request, jsonify
import logging
import app
import json
from helpers import db_helpers, utils
from models import device_status
from routes import api
from flask_cors import CORS
import sys
from datetime import datetime

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
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

# maintenance log
@device_status_bp.route(api.route['maintenance_logs'], methods=['GET'])
def get_device_maintenance_log():
    '''
    Get device maintenance_logs
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_device_maintenance_log()
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

# maintenance log
@device_status_bp.route(api.route['device_name_maintenance_log'], methods=['GET'])
def get_device_name_maintenance_log(device_name):
    '''
    Get device maintenance_logs
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_device_name_maintenance_log(device_name)
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


# maintenance log
@device_status_bp.route(api.route['device_power'], methods=['GET'])
def get_device_power():
    '''
    Get device status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_device_power()
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        data = jsonify(response)
        return data, 200
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
            response = {'online_devices_percentage': result['online_devices_percentage'],
                        'offline_devices_percentage': result['offline_devices_percentage'], 'created_at': utils.convert_GMT_time_to_EAT_local_time(result['created_at'])}
        else:
            response = {
                "message": "Device status data not available", "success": False}
        for document in documents:
            response_.append(document)
        data = jsonify({'data': response, 'all_data': response_})
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


@device_status_bp.route(api.route['latest_offline_devices'], methods=['GET'])
def get_all_latest_offline_devices():
    '''
    Get all latest offline devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_all_devices_latest_status()
        if documents:
            result = documents[0]
            response = result['offline_devices']
        else:
            response = {
                "message": "Offline devices data not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@device_status_bp.route(api.route['network_uptime'], methods=['GET'])
def get_network_uptime():
    '''
    Get network uptime/downtime status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        result = model.get_network_uptime_analysis_results()
        if result:
            response = result
        else:
            response = {
                "message": "Uptime data not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@device_status_bp.route(api.route['best_performing_devices'], methods=['GET'])
def get_best_performing_devices():
    '''
    Get best performing devices in terms of uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        result = model.get_device_rankings(sorting_order='desc')
        if result:
            response = result
        else:
            response = {
                "message": "besting perfoming devices data not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400


@device_status_bp.route(api.route['worst_performing_devices'], methods=['GET'])
def get_worst_performing_devices():
    '''
    Gets worst performing devices in terms of uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        result = model.get_device_rankings(sorting_order='asc')
        if result:
            response = result
        else:
            response = {
                "message": "worst perfoming devices data not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

@device_status_bp.route(api.route['device_uptime'], methods=['GET'])
def get_device_uptime(device_channel_id):
    '''
    Get device uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        if type(device_channel_id) is not str:
            device_channel_id = str(device_channel_id)           

        result = model.get_device_uptime_analysis_results(device_channel_id)
        if result:
            response = result
        else:
            response = {
                "message": "Uptime data not available for the specified device", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

@device_status_bp.route(api.route['online_offline'], methods=['GET'])
def get_all_online_offline():
    '''
    Get all latest devices online_offline
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        documents = model.get_all_devices_latest_status()
        if documents:
            result = documents[0]
            print(len(result['online_devices']), file=sys.stderr)
            devices_without_coordinates =[]
            devices_with_coordinates =[]
            for device in result['online_devices']:
                if (device['latitude'] is not None) or (device['longitude'] is not None) :
                    if "nextMaintenance" in device:
                        date_difference = datetime.now()-device['nextMaintenance']
                        print (date_difference.days, file=sys.stderr)
                        if date_difference.days<-14:
                            codeString = "codeGreen"
                        elif date_difference.days>=0:
                            codeString = "codeRed"
                        else:
                            codeString = "codeOrange"
                                        
                        mapped_device = {
                            'channelId':device['channelID'],
                            'latitude': device['latitude'],
                            'locationID': device['locationID'],
                            'longitude': device['longitude'],
                            'power': device['power'],
                            'productName': device['product_name'],
                            'phoneNumber': device['phoneNumber'],
                            'nextMaintenance': device['nextMaintenance'],
                            'isOnline': True,
                            'isDueMaintenance': codeString
                        }
                        devices_with_coordinates.append(mapped_device)

            for device in result['online_devices']:
                if (device['latitude'] is not None) or (device['longitude'] is not None) :
                    if "nextMaintenance" not in device:                   
                        mapped_device = {
                            'channelId':device['channelID'],
                            'latitude': device['latitude'],
                            'locationID': device['locationID'],
                            'longitude': device['longitude'],
                            'power': device['power'],
                            'productName': device['product_name'],
                            'phoneNumber': device['phoneNumber'],
                            'nextMaintenance': "null",
                            'isOnline': True,
                            'isDueMaintenance': "codeRed"
                        }
                        devices_with_coordinates.append(mapped_device)

            for device in result['offline_devices']:
                if (device['latitude'] is not None) or (device['longitude'] is not None) :
                     if "nextMaintenance" in device:
                        date_difference = datetime.now()-device['nextMaintenance']
                        if date_difference.days<-14:
                            codeString = "codeGreen"
                        elif date_difference.days>=0:
                            codeString = "codeRed"
                        else:
                            codeString = "codeOrange"
                    
                        mapped_device = {
                            'channelId':device['channelID'],
                            'latitude': device['latitude'],
                            'locationID': device['locationID'],
                            'longitude': device['longitude'],
                            'power': device['power'],
                            'productName': device['product_name'],
                            'phoneNumber': device['phoneNumber'],
                            'isOnline': False,
                            'nextMaintenance': device['nextMaintenance'],
                            'isDueMaintenance': codeString
                        }
                        devices_with_coordinates.append(mapped_device)  

            for device in result['offline_devices']:
                #if "true" in device['isActive'] :
                if "nextMaintenance" not in device:
                    if (device['latitude'] is not None) or (device['longitude'] is not None) :
                        if "nextMaintenance" not in device:
                    
                            mapped_device = {
                                'channelId':device['channelID'],
                                'latitude': device['latitude'],
                                'locationID': device['locationID'],
                                'longitude': device['longitude'],
                                'power': device['power'],
                                'productName': device['product_name'],
                                'phoneNumber': device['phoneNumber'],
                                'isOnline': False,
                                'nextMaintenance': "null",
                                'isDueMaintenance': "codeRed"
                            }
                            devices_with_coordinates.append(mapped_device)               
                    

            response = {'online_offline_devices': devices_with_coordinates}
            
        else:
            response = {
                "message": "devices data not available", "success": False}
        data = jsonify(response)
        return data, 201
    else:
        return jsonify({"message": "Invalid request method", "success": False}), 400

        
