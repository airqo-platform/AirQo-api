from flask import Blueprint, request, jsonify
import logging
import app
import json
from helpers import convert_dates
from helpers.convert_object_ids import convert_model_ids
from models import device_status, device_uptime
from routes import api
from flask_cors import CORS
import sys
from datetime import datetime

_logger = logging.getLogger(__name__)

device_status_bp = Blueprint('device_status', __name__)

"""
GET device uptime
GET device status
"""


@device_status_bp.route(api.route['device_status'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_status():
    '''
    Get device status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_device_status(tenant)
        if not documents:
            return jsonify({"message": "No device status report available for " + tenant + " organization. please make sure you have provided a valid organization name.", "success": False}), 400
        converted_document = convert_model_ids(documents[0])
        import pdb
        pdb.set_trace()
        # response = []
        # for document in documents:
        #     document['_id'] = str(document['_id'])
        #     response.append(document)
        return jsonify(converted_document), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400

# maintenance log


@device_status_bp.route(api.route['maintenance_logs'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_maintenance_log():
    '''
    Get device maintenance_logs
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_device_maintenance_log(tenant)
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        if len(response) == 0:
            return jsonify({"message": "No maintenance logs available for " + tenant + " organization. please make sure you have provided a valid organization name.", "success": False}), 400
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


# maintenance log
@device_status_bp.route(api.route['device_name_maintenance_log'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_name_maintenance_log(device_name):
    '''
    Get device maintenance_logs
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_device_name_maintenance_log(tenant, device_name)
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        if len(response) == 0:
            return jsonify({"message": "device '" + device_name + "' maintenance log is not available for " + tenant + " organization", "success": False}), 400
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


# maintenance log
@device_status_bp.route(api.route['device_power'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_power():
    '''
    Get device status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_device_power(tenant)
        response = []
        for document in documents:
            document['_id'] = str(document['_id'])
            response.append(document)
        if len(response) == 0:
            return jsonify({"message": "device power type is not available for " + tenant + " organization. please make sure you have provide a valid organization name.", "success": False}), 400
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['all_devices_latest_status'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_all_devices_latest_status():
    '''
    Get all devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_all_devices_latest_status(tenant)
        response_ = []
        if documents:
            result = documents[0]
            response = {'online_devices_percentage': result['online_devices_percentage'],
                        'offline_devices_percentage': result['offline_devices_percentage'], 'created_at': convert_dates.convert_GMT_time_to_EAT_local_time(result['created_at'])}
        else:
            response = {
                "message": "Device status data not available for " + tenant + " organization", "success": False}
        for document in documents:
            response_.append(document)
        data = jsonify({'data': response, 'all_data': response_})
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['devices'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_all_devices():
    '''
    Get all devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_all_devices(tenant)
        response = []
        '''
        if documents:
            result = documents[0]
            response = {'online_devices_percentage':result['online_devices_percentage'],
             'offline_devices_percentage': result['offline_devices_percentage'], 'created_at':result['created_at']}
        else:
            response = {
                "message": "Device status not available", "success":False }
        '''
        for document in documents:
            response.append(document)
        if len(response) == 0:
            return jsonify({"message": "No record available for " + tenant + " organization. please make sure you have provided a valid organization name.", "success": False}), 400
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['latest_offline_devices'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_all_latest_offline_devices():
    '''
    Get all latest offline devices latest status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        documents = model.get_all_devices_latest_status(tenant)
        if documents:
            result = documents[0]
            response = result['offline_devices']
        else:
            response = {
                "message": "Offline devices data not available for " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['network_uptime'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_network_uptime():
    '''
    Get network uptime/downtime status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        result = model.get_network_uptime_analysis_results(tenant)
        if result:
            response = result
        else:
            response = {
                "message": "Uptime data not available for " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['best_performing_devices'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_best_performing_devices():
    '''
    Get best performing devices in terms of uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        result = model.get_device_rankings(tenant, sorting_order='desc')
        if result:
            response = result
        else:
            response = {
                "message": "besting perfoming devices data not available for " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['worst_performing_devices'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_worst_performing_devices():
    '''
    Gets worst performing devices in terms of uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        result = model.get_device_rankings(tenant, sorting_order='asc')
        if result:
            response = result
        else:
            response = {
                "message": "worst perfoming devices data not available for " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['device_uptime'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_uptime():
    '''
    Get device uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        device_channel_id = request.args.get('channel_id')
        device_id = request.args.get('device_id')
        device_name = request.args.get('device_name')

        if (not device_id and not device_name and not device_channel_id):
            return jsonify({"message": "please specify one of the following query parameters i.e.device_channel_id , device_name ,device_id. Refer to the API documentation for details.", "success": False}), 400

        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        if device_channel_id and type(device_channel_id) is not int:
            device_channel_id = int(device_channel_id)
            filter_param = device_channel_id

        if not device_channel_id:
            if device_name:
                filter_param = device_name
            else:
                filter_param = device_id

        result = model.get_device_uptime_analysis_results(
            tenant, filter_param)
        if result:
            response = result
        else:
            response = {
                "message": "Uptime data not available for the specified device or " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['device_battery_voltage'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_battery_voltage():
    '''
    Get device uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        device_channel_id = request.args.get('channel_id')
        device_id = request.args.get('device_id')
        device_name = request.args.get('device_name')

        if (not device_id and not device_name and not device_channel_id):
            return jsonify({"message": "please specify one of the following query parameters i.e.device_channel_id , device_name ,device_id. Refer to the API documentation for details.", "success": False}), 400

        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        if type(device_channel_id) is not int and device_channel_id:
            device_channel_id = int(device_channel_id)
            filter_param = device_channel_id

        if not device_channel_id:
            if device_name:
                filter_param = device_name
            else:
                filter_param = device_id

        result = model.get_device_battery_voltage_results(
            tenant, filter_param)
        if result:
            response = result
        else:
            response = {
                "message": "battery voltage data not available for the specified device or " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['device_sensor_correlation'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_sensor_correlation():
    '''
    Get device uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        device_channel_id = request.args.get('channel_id')
        device_id = request.args.get('device_id')
        device_name = request.args.get('device_name')

        if (not device_id and not device_name and not device_channel_id):
            return jsonify({"message": "please specify one of the following query parameters i.e.device_channel_id , device_name ,device_id. Refer to the API documentation for details.", "success": False}), 400

        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400
        if device_channel_id and type(device_channel_id) is not int:
            device_channel_id = int(device_channel_id)
            filter_param = device_channel_id

        if not device_channel_id:
            if device_name:
                filter_param = device_name
            else:
                filter_param = device_id

        result = model.get_device_sensor_correlation_results(
            tenant, filter_param)
        if result:
            response = result
        else:
            response = {
                "message": "device sensor correlation data not available for the specified device or " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(api.route['online_offline'], methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_all_online_offline():
    '''
    Get all latest devices online_offline
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        tenant = request.args.get('tenant')
        if not tenant:
            return jsonify({"message": "please specify the organization name. Refer to the API documentation for details.", "success": False}), 400

        documents = model.get_all_devices_latest_status(tenant)
        if documents:
            result = documents[0]
            print(len(result['online_devices']), file=sys.stderr)
            devices_without_coordinates = []
            devices_with_coordinates = []
            for device in result['online_devices']:
                if (device['latitude'] is not None) or (device['longitude'] is not None):
                    if "nextMaintenance" in device:
                        date_difference = datetime.now() - \
                            device['nextMaintenance']
                        print(date_difference.days, file=sys.stderr)
                        if date_difference.days < -14:
                            codeString = "codeGreen"
                        elif date_difference.days >= 0:
                            codeString = "codeRed"
                        else:
                            codeString = "codeOrange"

                        mapped_device = {
                            'channelId': device['channelID'],
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
                if (device['latitude'] is not None) or (device['longitude'] is not None):
                    if "nextMaintenance" not in device:
                        mapped_device = {
                            'channelId': device['channelID'],
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
                if (device['latitude'] is not None) or (device['longitude'] is not None):
                    if "nextMaintenance" in device:
                        date_difference = datetime.now() - \
                            device['nextMaintenance']
                        if date_difference.days < -14:
                            codeString = "codeGreen"
                        elif date_difference.days >= 0:
                            codeString = "codeRed"
                        else:
                            codeString = "codeOrange"

                        mapped_device = {
                            'channelId': device['channelID'],
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
                # if "true" in device['isActive'] :
                if "nextMaintenance" not in device:
                    if (device['latitude'] is not None) or (device['longitude'] is not None):
                        if "nextMaintenance" not in device:

                            mapped_device = {
                                'channelId': device['channelID'],
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
                "message": "devices data not available of this " + tenant + " organization", "success": False}
        data = jsonify(response)
        return data, 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400
