import logging

from flask import Blueprint, request, jsonify

import routes
from helpers.convert_dates import validate_datetime
from helpers.convert_object_ids import convert_model_ids
from helpers.request_validators import validate_request_params
from models import DeviceStatus, NetworkUptime, DeviceUptime, DeviceBattery

_logger = logging.getLogger(__name__)

device_status_bp = Blueprint("device_status", __name__)


@device_status_bp.route(routes.DEVICE_STATUS, methods=["GET"])
def get_device_status():
    errors = {}
    tenant = request.args.get("tenant")
    try:
        limit = abs(int(request.args.get("limit", 0)))
    except Exception:
        errors["limit"] = "limit must be a valid integer"

    try:
        start_date = validate_datetime(request.args.get("startDate"))
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    try:
        end_date = validate_datetime(request.args.get("endDate"))
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = DeviceStatus(tenant)
    documents = model.get_device_status(start_date, end_date, limit)
    converted_documents = convert_model_ids(documents)

    response = dict(message="devices status query successful", data=converted_documents)
    return jsonify(response), 200


@device_status_bp.route(routes.NETWORK_UPTIME, methods=["GET"])
def get_network_uptime():
    errors = {}
    tenant = request.args.get("tenant")

    try:
        start_date = validate_datetime(request.args.get("startDate"))
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    try:
        end_date = validate_datetime(request.args.get("endDate"))
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = NetworkUptime(tenant)

    result = model.get_network_uptime(start_date, end_date)
    response = dict(message="network uptime query successful", data=result)
    return jsonify(response), 200


@device_status_bp.route(routes.DEVICE_UPTIME, methods=["GET"])
def get_device_uptime():
    errors = {}
    tenant = request.args.get("tenant")
    device_name = request.args.get("device_name")

    try:
        start_date = validate_datetime(request.args.get("startDate"))
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    try:
        end_date = validate_datetime(request.args.get("endDate"))
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = DeviceUptime(tenant)
    result = model.get_device_uptime(start_date, end_date, device_name)

    response = dict(message="device uptime query successful", data=result)
    return jsonify(response), 200


@device_status_bp.route(routes.DEVICE_BATTERY, methods=["GET"])
@validate_request_params(
    "startDate|required:datetime",
    "endDate|required:datetime",
    "deviceName|required:str",
    "rounding|optional:int",
    "deviceName|required:str",
)
def get_device_battery():
    device_name = request.args.get("deviceName")
    minutes_average = request.args.get("minutes_average", 30)
    rounding = request.args.get("rounding", 2)

    start_date = request.args.get("startDate")
    end_date = request.args.get("endDate")

    device_battery = DeviceBattery.get_device_battery(
        device=device_name, start_date_time=start_date, end_date_time=end_date
    )
    formatted_device_battery = DeviceBattery.format_device_battery(
        device_battery, rounding=int(rounding), minutes_average=int(minutes_average)
    )

    response = dict(
        message="device battery query successful", data=formatted_device_battery
    )
    return jsonify(response), 200


@device_status_bp.route(routes.DEVICE_UPTIME_LEADERBOARD, methods=["GET"])
def get_device_uptime_leaderboard():
    errors = {}
    tenant = request.args.get("tenant")

    try:
        start_date = validate_datetime(request.args.get("startDate"))
    except Exception:
        errors["startDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    try:
        end_date = validate_datetime(request.args.get("endDate"))
    except Exception:
        errors["endDate"] = (
            "This query param is required."
            "Please provide a valid ISO formatted datetime string (%Y-%m-%dT%H:%M:%S.%fZ)"
        )

    if errors:
        return (
            jsonify(
                {
                    "message": "Some errors occurred while processing this request",
                    "errors": errors,
                }
            ),
            400,
        )

    model = DeviceUptime(tenant)
    result = model.get_uptime_leaderboard(start_date, end_date)

    response = dict(message="uptime leaderboard query successful", data=result)
    return jsonify(response), 200
