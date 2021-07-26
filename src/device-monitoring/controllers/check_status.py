from flask import Blueprint, request, jsonify
import logging
from helpers import convert_dates
from helpers.convert_object_ids import convert_model_ids
from helpers.group_by import group_by
from models import DeviceStatus
import routes

_logger = logging.getLogger(__name__)

device_status_bp = Blueprint('device_status', __name__)


@device_status_bp.route(routes.DEVICE_STATUS, methods=['GET'])
def get_device_status():
    tenant = request.args.get('tenant')

    model = DeviceStatus(tenant)
    documents = model.get_device_status()
    converted_documents = convert_model_ids(documents)

    response = dict(message="devices status query successful", data=converted_documents)
    return jsonify(response), 200


@device_status_bp.route(routes.LATEST_DEVICES_STATUS, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
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


@device_status_bp.route(routes.NETWORK_UPTIME, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_network_uptime():
    '''
    Get network uptime/downtime status
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        REQUIRED_ARGS = ['tenant', 'days']
        errors = {}

        for arg in REQUIRED_ARGS:
            if not request.args.get(arg):
                errors[arg] = f"'{arg}' is a required parameter"

        tenant = request.args.get('tenant')

        try:
            days = int(request.args.get('days'))
            if days <= 0:
                errors["days"] = f"'{request.args.get('days')}' must be greater than zero"
        except (ValueError, TypeError):
            errors["days"] = f"'{request.args.get('days')}' is not a valid integer"

        if errors:
            return jsonify(dict(
                message="Please specify one of the following query parameters. "
                        "Refer to the API documentation for details.",
                errors=errors
            )), 400

        result = model.get_network_uptime(tenant, days)
        result = convert_model_ids(result)
        response = dict(message="network uptime query successful", data=result)
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(routes.DEVICE_UPTIME, methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def get_device_uptime():
    '''
    Get device uptime
    '''
    model = device_status.DeviceStatus()
    if request.method == 'GET':
        REQUIRED_ARGS = ['tenant', 'device_name', 'days']
        errors = {}

        for arg in REQUIRED_ARGS:
            if not request.args.get(arg):
                errors[arg] = f"'{arg}' is a required parameter"

        tenant = request.args.get('tenant')
        device_name = request.args.get('device_name')
        try:
            days = int(request.args.get('days'))
            if days <= 0:
                errors["days"] = f"'{request.args.get('days')}' must be greater than zero"
        except (ValueError, TypeError):
            errors["days"] = f"'{request.args.get('days')}' is not a valid integer"


        if errors:
            return jsonify(dict(
                message="Please specify one of the following query parameters. "
                        "Refer to the API documentation for details.",
                errors=errors
            )), 400

        result = model.get_device_uptime(tenant, device_name, days)
        result = convert_model_ids(result)

        response = dict(message="device uptime query successful", data=result)
        return jsonify(response), 200
    else:
        return jsonify({"message": "Invalid request method. Please refer to the API documentation", "success": False}), 400


@device_status_bp.route(routes.ALL_DEVICE_UPTIME, methods=['GET'])
def get_all_devices_uptime():
    REQUIRED_ARGS = ['tenant', 'days']
    errors = {}

    for arg in REQUIRED_ARGS:
        if not request.args.get(arg):
            errors[arg] = f"'{arg}' is a required parameter"

    tenant = request.args.get('tenant')

    try:
        days = int(request.args.get('days'))
        if days <= 0:
            errors["days"] = f"'{request.args.get('days')}' must be greater than zero"
    except (ValueError, TypeError):
        errors["days"] = f"'{request.args.get('days')}' is not a valid integer"

    if errors:
        return jsonify(dict(
            message="Please specify one of the following query parameters. "
                    "Refer to the API documentation for details.",
            errors=errors
        )), 400
    model = device_status.DeviceStatus()
    result = model.get_all_devices_uptime(tenant, days)
    result = group_by('device_name', convert_model_ids(result))

    response = dict(message="device uptime query successful", data=result)
    return jsonify(response), 200
